<?php

define('DB_PATH', __DIR__ . '/../data/workout.db');
define('APP_ENV', getenv('APP_ENV') ?: 'development');
define('SESSION_NAME', 'wl_session');

// CORS - adjust for production
if (!defined('ALLOWED_ORIGINS')) {
    define('ALLOWED_ORIGINS', [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]);
}
