<?php

class Auth {
    public static function start(): void {
        if (session_status() === PHP_SESSION_NONE) {
            session_name(SESSION_NAME);
            session_set_cookie_params([
                'lifetime' => 86400,
                'path'     => '/',
                'domain'   => '',
                'secure'   => APP_ENV !== 'development',
                'httponly'  => true,
                'samesite'  => APP_ENV !== 'development' ? 'None' : 'Lax',
            ]);
            session_start();
        }
    }

    // ── Token-based auth ──────────────────────────────────────────────────────

    public static function createToken(int $userId): string {
        $token = bin2hex(random_bytes(32));
        Database::execute(
            'INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+30 days"))',
            [$userId, $token]
        );
        return $token;
    }

    public static function validateToken(): ?int {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!str_starts_with($header, 'Bearer ')) {
            return null;
        }
        $token = substr($header, 7);
        if (empty($token)) {
            return null;
        }
        $row = Database::queryOne(
            'SELECT user_id FROM auth_tokens WHERE token = ? AND expires_at > datetime("now")',
            [$token]
        );
        return $row ? (int) $row['user_id'] : null;
    }

    public static function deleteToken(string $token): void {
        Database::execute('DELETE FROM auth_tokens WHERE token = ?', [$token]);
    }

    public static function deleteAllUserTokens(int $userId): void {
        Database::execute('DELETE FROM auth_tokens WHERE user_id = ?', [$userId]);
    }

    // ── Session-based auth (fallback for browser) ─────────────────────────────

    public static function start_session(): void {
        self::start();
    }

    public static function loginSession(int $userId): void {
        self::start();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
    }

    public static function logout(): void {
        // Clear session
        self::start();
        $_SESSION = [];
        session_destroy();
        // Token cleanup handled by the caller (needs the token string)
    }

    // ── Unified guards ────────────────────────────────────────────────────────

    /**
     * Returns user ID from token header first, then falls back to session.
     */
    public static function resolveUserId(): ?int {
        // Try token first (mobile / PWA)
        $userId = self::validateToken();
        if ($userId !== null) {
            return $userId;
        }
        // Fall back to session (browser)
        self::start();
        return !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    }

    public static function guard(): void {
        $userId = self::resolveUserId();
        if ($userId === null) {
            Response::unauthorized();
        }
    }

    /**
     * Guard with minimum role check. Role hierarchy: user < moderator < admin
     */
    public static function guardRole(string $minRole): void {
        self::guard();
        $hierarchy = ['user' => 0, 'moderator' => 1, 'admin' => 2];
        $user = Database::queryOne('SELECT role FROM users WHERE id = ?', [self::userId()]);
        $userLevel = $hierarchy[$user['role'] ?? 'user'] ?? 0;
        $required  = $hierarchy[$minRole] ?? 0;
        if ($userLevel < $required) {
            Response::error('FORBIDDEN', 'Insufficient permissions', 403);
        }
    }

    /**
     * Get current user's role
     */
    public static function role(): string {
        $user = Database::queryOne('SELECT role FROM users WHERE id = ?', [self::userId()]);
        return $user['role'] ?? 'user';
    }

    public static function userId(): ?int {
        return self::resolveUserId();
    }

    public static function login(int $userId): void {
        self::loginSession($userId);
    }

    public static function isAuthenticated(): bool {
        return self::resolveUserId() !== null;
    }
}
