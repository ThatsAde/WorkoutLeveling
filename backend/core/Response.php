<?php

class Response {
    public static function json(mixed $data, int $status = 200): never {
        http_response_code($status);
        echo json_encode(['data' => $data]);
        exit;
    }

    public static function paginated(array $data, int $total, int $page, int $limit): never {
        http_response_code(200);
        echo json_encode([
            'data' => $data,
            'meta' => [
                'total'       => $total,
                'page'        => $page,
                'limit'       => $limit,
                'total_pages' => (int) ceil($total / $limit),
            ],
        ]);
        exit;
    }

    public static function error(string $code, string $message, int $status = 400): never {
        http_response_code($status);
        echo json_encode(['error' => ['code' => $code, 'message' => $message]]);
        exit;
    }

    public static function notFound(string $message = 'Resource not found'): never {
        self::error('NOT_FOUND', $message, 404);
    }

    public static function unauthorized(): never {
        self::error('UNAUTHORIZED', 'Authentication required', 401);
    }

    public static function forbidden(): never {
        self::error('FORBIDDEN', 'Access denied', 403);
    }

    public static function noContent(): never {
        http_response_code(204);
        exit;
    }
}
