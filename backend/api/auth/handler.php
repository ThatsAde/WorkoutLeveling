<?php

Auth::start();

// ── POST /auth/login ──────────────────────────────────────────────────────────
if ($method === 'POST' && $uri === '/auth/login') {
    $v = Validator::make($body)
        ->required('username')
        ->required('password')
        ->validate();

    $user = Database::queryOne(
        'SELECT id, username, password_hash, email, email_verified_at, role, pfp_url, bio FROM users WHERE username = ?',
        [$body['username']]
    );

    if (!$user || !password_verify($body['password'], $user['password_hash'])) {
        Response::error('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }

    Auth::loginSession($user['id']);
    $token = Auth::createToken($user['id']);

    unset($user['password_hash']);
    $user['token'] = $token;
    Response::json($user);
}

// ── POST /auth/logout ─────────────────────────────────────────────────────────
if ($method === 'POST' && $uri === '/auth/logout') {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($header, 'Bearer ')) {
        $token = substr($header, 7);
        Auth::deleteToken($token);
    }
    Auth::logout();
    Response::noContent();
}

// ── POST /auth/register ───────────────────────────────────────────────────────
if ($method === 'POST' && $uri === '/auth/register') {
    $v = Validator::make($body)
        ->required('username')
        ->required('password')
        ->string('username', 50)
        ->validate();

    if (strlen($body['password']) < 8) {
        Response::error('VALIDATION_ERROR', 'Password must be at least 8 characters', 422);
    }

    // Validate email if provided
    $email = isset($body['email']) && $body['email'] !== '' ? trim($body['email']) : null;
    if ($email !== null) {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('VALIDATION_ERROR', 'Invalid email address', 422);
        }
        $emailExists = Database::queryOne('SELECT id FROM users WHERE email = ?', [$email]);
        if ($emailExists) {
            Response::error('EMAIL_TAKEN', 'Email already registered', 409);
        }
    }

    // Check username uniqueness
    $usernameExists = Database::queryOne('SELECT id FROM users WHERE username = ?', [$body['username']]);
    if ($usernameExists) {
        Response::error('USERNAME_TAKEN', 'Username already taken', 409);
    }

    $hash = password_hash($body['password'], PASSWORD_BCRYPT);
    $id   = Database::execute(
        'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
        [$body['username'], $hash, $email]
    );

    Auth::loginSession($id);
    $token = Auth::createToken($id);

    // Generate email verification token if email provided
    if ($email !== null) {
        $verifyToken = bin2hex(random_bytes(32));
        Database::execute(
            'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+24 hours"))',
            [$id, $verifyToken]
        );
        // In future: send email. For now, token stored in DB only.
    }

    Response::json([
        'id'                => $id,
        'username'          => $body['username'],
        'email'             => $email,
        'email_verified_at' => null,
        'role'              => 'user',
        'pfp_url'           => null,
        'bio'               => null,
        'token'             => $token,
    ], 201);
}

// ── GET /auth/me ──────────────────────────────────────────────────────────────
if ($method === 'GET' && $uri === '/auth/me') {
    if (!Auth::isAuthenticated()) {
        Response::json(null);
    }
    $user = Database::queryOne(
        'SELECT id, username, email, email_verified_at, role, pfp_url, bio, tutorial_completed_at FROM users WHERE id = ?',
        [Auth::userId()]
    );
    Response::json($user);
}

// ── POST /auth/verify-email/request ──────────────────────────────────────────
if ($method === 'POST' && $uri === '/auth/verify-email/request') {
    Auth::guard();
    $userId = Auth::userId();
    $user = Database::queryOne('SELECT email, email_verified_at FROM users WHERE id = ?', [$userId]);

    if (!$user || !$user['email']) {
        Response::error('NO_EMAIL', 'No email address on file', 422);
    }
    if ($user['email_verified_at']) {
        Response::error('ALREADY_VERIFIED', 'Email already verified', 422);
    }

    // Invalidate old tokens
    Database::execute('DELETE FROM email_verifications WHERE user_id = ?', [$userId]);

    $verifyToken = bin2hex(random_bytes(32));
    Database::execute(
        'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+24 hours"))',
        [$userId, $verifyToken]
    );
    // Future: send email with $verifyToken
    Response::noContent();
}

// ── POST /auth/verify-email/confirm ──────────────────────────────────────────
if ($method === 'POST' && $uri === '/auth/verify-email/confirm') {
    $v = Validator::make($body)->required('token')->validate();

    $row = Database::queryOne(
        'SELECT id, user_id FROM email_verifications WHERE token = ? AND used_at IS NULL AND expires_at > datetime("now")',
        [$body['token']]
    );

    if (!$row) {
        Response::error('INVALID_TOKEN', 'Token invalid or expired', 422);
    }

    Database::execute(
        'UPDATE email_verifications SET used_at = datetime("now") WHERE id = ?',
        [$row['id']]
    );
    Database::execute(
        'UPDATE users SET email_verified_at = datetime("now") WHERE id = ?',
        [$row['user_id']]
    );

    Response::noContent();
}

// ── POST /auth/forgot-password ────────────────────────────────────────────────
if ($method === 'POST' && $uri === '/auth/forgot-password') {
    // Always return 204 — no user enumeration
    $v = Validator::make($body)->required('email')->validate();
    $email = trim($body['email']);

    $user = Database::queryOne('SELECT id FROM users WHERE email = ?', [$email]);
    if ($user) {
        // Invalidate old tokens
        Database::execute('DELETE FROM password_resets WHERE user_id = ?', [$user['id']]);
        $resetToken = bin2hex(random_bytes(32));
        Database::execute(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+1 hour"))',
            [$user['id'], $resetToken]
        );
        // Future: send email with $resetToken
    }

    Response::noContent();
}

// ── POST /auth/reset-password ─────────────────────────────────────────────────
if ($method === 'POST' && $uri === '/auth/reset-password') {
    $v = Validator::make($body)
        ->required('token')
        ->required('new_password')
        ->validate();

    if (strlen($body['new_password']) < 8) {
        Response::error('VALIDATION_ERROR', 'Password must be at least 8 characters', 422);
    }

    $row = Database::queryOne(
        'SELECT id, user_id FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > datetime("now")',
        [$body['token']]
    );

    if (!$row) {
        Response::error('INVALID_TOKEN', 'Token invalid or expired', 422);
    }

    $hash = password_hash($body['new_password'], PASSWORD_BCRYPT);
    Database::execute('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $row['user_id']]);
    Database::execute(
        'UPDATE password_resets SET used_at = datetime("now") WHERE id = ?',
        [$row['id']]
    );
    // Invalidate all sessions
    Auth::deleteAllUserTokens($row['user_id']);

    Response::noContent();
}

Response::notFound();
