<?php

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Validator.php';
require_once __DIR__ . '/core/Auth.php';

// ── CORS ──────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

define('ALLOWED_ORIGINS', [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://192.168.1.243:3000',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
]);

if (in_array($origin, ALLOWED_ORIGINS)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, Authorization');
header('Content-Type: application/json; charset=utf-8');


if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Bootstrap DB (run migrations if needed) ───────────────────────────────────
$dbFile = DB_PATH;
$needsInit = !file_exists($dbFile);
if ($needsInit) {
    $sql = file_get_contents(__DIR__ . '/migrations/001_initial_schema.sql');
    Database::getInstance()->exec($sql);
    $sql = file_get_contents(__DIR__ . '/migrations/002_seed_data.sql');
    Database::getInstance()->exec($sql);
}
// Run auth_tokens migration if table doesn't exist yet
$tokenTableExists = Database::queryOne(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='auth_tokens'"
);
if (!$tokenTableExists) {
    $sql = file_get_contents(__DIR__ . '/migrations/003_auth_tokens.sql');
    Database::getInstance()->exec($sql);
}

// Run accounts migration 004 if users.email column doesn't exist yet
$emailColExists = array_filter(
    Database::query("PRAGMA table_info(users)"),
    fn($col) => $col['name'] === 'email'
);
if (empty($emailColExists)) {
    $sql = file_get_contents(__DIR__ . '/migrations/004_accounts.sql');
    Database::getInstance()->exec($sql);
}

// ── Ban middleware ─────────────────────────────────────────────────────────────
// If authenticated user is banned, reject all non-auth requests
$_authUserId = Auth::resolveUserId();
if ($_authUserId !== null) {
    $uri_check = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $uri_check = rtrim(preg_replace('#^/api#', '', $uri_check), '/');
    $isAuthRoute = str_starts_with($uri_check, '/auth');
    if (!$isAuthRoute) {
        $bannedCheck = Database::queryOne('SELECT banned_at FROM users WHERE id = ?', [$_authUserId]);
        if ($bannedCheck && $bannedCheck['banned_at'] !== null) {
            Response::error('BANNED', 'Your account has been suspended', 403);
        }
    }
}

// ── Error Handling ────────────────────────────────────────────────────────────
set_exception_handler(function (Throwable $e) {
    if ($e instanceof ValidationException) {
        http_response_code(422);
        echo json_encode(['error' => ['code' => 'VALIDATION_ERROR', 'errors' => $e->errors]]);
        exit;
    }
    $status = 500;
    $message = APP_ENV === 'development' ? $e->getMessage() : 'Internal server error';
    http_response_code($status);
    echo json_encode(['error' => ['code' => 'SERVER_ERROR', 'message' => $message]]);
    exit;
});

// ── Router ────────────────────────────────────────────────────────────────────
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = rtrim(preg_replace('#^/api#', '', $uri), '/');
$method = $_SERVER['REQUEST_METHOD'];

// Parse request body
$body = [];
$raw  = file_get_contents('php://input');
if ($raw) {
    $body = json_decode($raw, true) ?? [];
}

// Helper to extract path segments and IDs
$segments = array_values(array_filter(explode('/', $uri)));
$resource = $segments[0] ?? '';
$id       = isset($segments[1]) && is_numeric($segments[1]) ? (int) $segments[1] : null;
$action   = isset($segments[1]) && !is_numeric($segments[1]) ? $segments[1] : null;
$sub      = $segments[2] ?? null;
$subId    = isset($segments[3]) && is_numeric($segments[3]) ? (int) $segments[3] : null;

// ── Route Dispatch ────────────────────────────────────────────────────────────
match ($resource) {
    'auth'        => include __DIR__ . '/api/auth/handler.php',
    'profile'     => include __DIR__ . '/api/profile/handler.php',
    'exercises'   => include __DIR__ . '/api/exercises/handler.php',
    'muscles'     => include __DIR__ . '/api/muscles/handler.php',
    'movement-types'     => include __DIR__ . '/api/muscles/movement_types.php',
    'workout-categories' => include __DIR__ . '/api/muscles/categories.php',
    'workouts'    => include __DIR__ . '/api/workouts/handler.php',
    'sessions'    => include __DIR__ . '/api/sessions/handler.php',
    'stats'       => include __DIR__ . '/api/stats/handler.php',
    'body-stats'  => include __DIR__ . '/api/body-stats/handler.php',
    default       => Response::notFound("Unknown endpoint: $resource"),
};
