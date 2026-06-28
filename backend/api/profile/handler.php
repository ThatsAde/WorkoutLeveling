<?php

// ── GET /profile (own profile) ────────────────────────────────────────────────
if ($method === 'GET' && $uri === '/profile') {
    Auth::guard();
    $user = Database::queryOne(
        'SELECT id, username, email, email_verified_at, role, pfp_url, bio, tutorial_completed_at, created_at FROM users WHERE id = ?',
        [Auth::userId()]
    );
    Response::json($user);
}

// ── PUT /profile ──────────────────────────────────────────────────────────────
if ($method === 'PUT' && $uri === '/profile') {
    Auth::guard();
    $userId = Auth::userId();

    Validator::make($body)
        ->string('bio', 500, true)
        ->validate();

    $user = Database::queryOne('SELECT email, password_hash FROM users WHERE id = ?', [$userId]);

    // Handle email change
    $newEmail = null;
    if (array_key_exists('email', $body)) {
        $newEmail = $body['email'] !== '' ? trim($body['email']) : null;
        if ($newEmail !== null && !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            Response::error('VALIDATION_ERROR', 'Invalid email address', 422);
        }
        if ($newEmail !== null) {
            $conflict = Database::queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [$newEmail, $userId]);
            if ($conflict) {
                Response::error('EMAIL_TAKEN', 'Email already registered', 409);
            }
        }
    }

    // Handle password change
    if (array_key_exists('new_password', $body) && $body['new_password'] !== '') {
        if (empty($body['current_password'])) {
            Response::error('VALIDATION_ERROR', 'Current password required', 422);
        }
        if (!password_verify($body['current_password'], $user['password_hash'])) {
            Response::error('INVALID_CREDENTIALS', 'Current password is incorrect', 401);
        }
        if (strlen($body['new_password']) < 8) {
            Response::error('VALIDATION_ERROR', 'New password must be at least 8 characters', 422);
        }
        $newHash = password_hash($body['new_password'], PASSWORD_BCRYPT);
        Database::execute('UPDATE users SET password_hash = ? WHERE id = ?', [$newHash, $userId]);
    }

    // Build update
    $updates = [];
    $params  = [];

    if (array_key_exists('bio', $body)) {
        $updates[] = 'bio = ?';
        $params[]  = $body['bio'] !== '' ? $body['bio'] : null;
    }
    if ($newEmail !== null || (array_key_exists('email', $body) && $body['email'] === '')) {
        $updates[] = 'email = ?';
        $params[]  = $newEmail;
        // Reset email verification if email changed
        $updates[] = 'email_verified_at = NULL';
    }
    if (array_key_exists('tutorial_completed', $body) && $body['tutorial_completed']) {
        $updates[] = 'tutorial_completed_at = datetime("now")';
    }

    if (!empty($updates)) {
        $params[] = $userId;
        Database::execute(
            'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?',
            $params
        );
    }

    $updated = Database::queryOne(
        'SELECT id, username, email, email_verified_at, role, pfp_url, bio, tutorial_completed_at, created_at FROM users WHERE id = ?',
        [$userId]
    );
    Response::json($updated);
}

// ── POST /profile/pfp ─────────────────────────────────────────────────────────
if ($method === 'POST' && $uri === '/profile/pfp') {
    Auth::guard();
    $userId = Auth::userId();

    if (empty($_FILES['file'])) {
        Response::error('NO_FILE', 'No file uploaded', 422);
    }

    $file = $_FILES['file'];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!in_array($mime, $allowed)) {
        Response::error('INVALID_FILE', 'Only JPEG, PNG, WebP and GIF are allowed', 422);
    }

    if ($file['size'] > 5 * 1024 * 1024) {
        Response::error('FILE_TOO_LARGE', 'Max file size is 5MB', 422);
    }

    $ext      = match ($mime) {
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
        default      => 'jpg',
    };

    $uploadDir = __DIR__ . '/../../../frontend/public/uploads/pfp/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $filename = 'pfp_' . $userId . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $destPath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        Response::error('UPLOAD_FAILED', 'Failed to save file', 500);
    }

    // Delete old pfp if exists
    $old = Database::queryOne('SELECT pfp_url FROM users WHERE id = ?', [$userId]);
    if ($old && $old['pfp_url']) {
        $oldFile = __DIR__ . '/../../../frontend/public' . $old['pfp_url'];
        if (file_exists($oldFile)) {
            unlink($oldFile);
        }
    }

    $pfpUrl = '/uploads/pfp/' . $filename;
    Database::execute('UPDATE users SET pfp_url = ? WHERE id = ?', [$pfpUrl, $userId]);

    Response::json(['pfp_url' => $pfpUrl]);
}

// ── GET /profile/:username (public profile) ───────────────────────────────────
if ($method === 'GET' && $action !== null) {
    $username = $action; // /profile/:username — action holds the username
    $user = Database::queryOne(
        'SELECT id, username, pfp_url, bio, created_at FROM users WHERE username = ?',
        [$username]
    );
    if (!$user) Response::notFound('User not found');
    Response::json($user);
}

Response::notFound();
