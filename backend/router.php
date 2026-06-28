<?php
// Router for PHP built-in server
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Route /api/* to the backend
if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/index.php';
    return true;
}

$mimeTypes = [
    'html' => 'text/html',
    'css'  => 'text/css',
    'js'   => 'application/javascript',
    'json' => 'application/json',
    'svg'  => 'image/svg+xml',
    'png'  => 'image/png',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'gif'  => 'image/gif',
    'webp' => 'image/webp',
    'mp4'  => 'video/mp4',
    'webm' => 'video/webm',
    'mov'  => 'video/quicktime',
    'woff2'=> 'font/woff2',
    'map'  => 'application/json',
];

// Serve uploaded media from backend/data/uploads (e.g. /uploads/exercises/abc.gif)
if (str_starts_with($uri, '/uploads/')) {
    // Strip leading /uploads/ and prevent path traversal
    $rel = ltrim(substr($uri, strlen('/uploads/')), '/');
    if (str_contains($rel, '..')) { http_response_code(403); return true; }
    $uploadsPath = __DIR__ . '/data/uploads/' . $rel;
    if (is_file($uploadsPath)) {
        $ext = strtolower(pathinfo($uploadsPath, PATHINFO_EXTENSION));
        if (isset($mimeTypes[$ext])) {
            header('Content-Type: ' . $mimeTypes[$ext]);
        }
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($uploadsPath);
        return true;
    }
    http_response_code(404);
    return true;
}

// Serve frontend static files
$frontendRoot = __DIR__ . '/../frontend/public';
$filePath = $frontendRoot . $uri;

if ($uri !== '/' && is_file($filePath)) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
    }
    readfile($filePath);
    return true;
}

// Fallback: serve index.html (SPA)
header('Content-Type: text/html');
readfile($frontendRoot . '/index.html');
return true;
