<?php

class Database {
    private static ?PDO $instance = null;

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $dsn = 'sqlite:' . DB_PATH;
            self::$instance = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            self::$instance->exec('PRAGMA journal_mode=WAL');
            self::$instance->exec('PRAGMA foreign_keys=ON');
        }
        return self::$instance;
    }

    public static function query(string $sql, array $params = []): array {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function queryOne(string $sql, array $params = []): ?array {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function execute(string $sql, array $params = []): int {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return (int) self::getInstance()->lastInsertId();
    }

    public static function run(string $sql, array $params = []): int {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public static function beginTransaction(): void {
        self::getInstance()->beginTransaction();
    }

    public static function commit(): void {
        self::getInstance()->commit();
    }

    public static function rollback(): void {
        self::getInstance()->rollBack();
    }
}
