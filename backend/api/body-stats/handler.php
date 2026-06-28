<?php

Auth::guard();
$_bsUserId = Auth::userId();

if ($method === 'GET' && $id === null) {
    $from = $_GET['from'] ?? date('Y-m-d', strtotime('-1 year'));
    $to   = $_GET['to']   ?? date('Y-m-d');

    $rows = Database::query(
        'SELECT * FROM body_stats WHERE user_id = ? AND recorded_date BETWEEN ? AND ? ORDER BY recorded_date ASC',
        [$_bsUserId, $from, $to]
    );
    Response::json($rows);
}

if ($method === 'POST' && $id === null) {
    Validator::make($body)
        ->required('recorded_date')
        ->float('weight_kg', true)
        ->float('body_fat_pct', true)
        ->validate();

    // UPSERT: INSERT OR REPLACE with user_id + recorded_date composite
    $existing = Database::queryOne(
        'SELECT id FROM body_stats WHERE user_id = ? AND recorded_date = ?',
        [$_bsUserId, $body['recorded_date']]
    );

    if ($existing) {
        Database::execute(
            'UPDATE body_stats SET weight_kg = ?, body_fat_pct = ?, notes = ? WHERE id = ?',
            [
                isset($body['weight_kg'])    && $body['weight_kg']    !== '' ? (float) $body['weight_kg']    : null,
                isset($body['body_fat_pct']) && $body['body_fat_pct'] !== '' ? (float) $body['body_fat_pct'] : null,
                $body['notes'] ?? null,
                $existing['id'],
            ]
        );
        $row = Database::queryOne('SELECT * FROM body_stats WHERE id = ?', [$existing['id']]);
        Response::json($row, 200);
    } else {
        $newId = Database::execute(
            'INSERT INTO body_stats (user_id, recorded_date, weight_kg, body_fat_pct, notes) VALUES (?, ?, ?, ?, ?)',
            [
                $_bsUserId,
                $body['recorded_date'],
                isset($body['weight_kg'])    && $body['weight_kg']    !== '' ? (float) $body['weight_kg']    : null,
                isset($body['body_fat_pct']) && $body['body_fat_pct'] !== '' ? (float) $body['body_fat_pct'] : null,
                $body['notes'] ?? null,
            ]
        );
        $row = Database::queryOne('SELECT * FROM body_stats WHERE id = ?', [$newId]);
        Response::json($row, 201);
    }
}

if ($method === 'PUT' && $id !== null) {
    $existing = Database::queryOne('SELECT id FROM body_stats WHERE id = ? AND user_id = ?', [$id, $_bsUserId]);
    if (!$existing) Response::notFound('Body stat not found');

    Validator::make($body)
        ->float('weight_kg', true)
        ->float('body_fat_pct', true)
        ->validate();

    Database::run(
        'UPDATE body_stats SET
            weight_kg    = ?,
            body_fat_pct = ?,
            notes        = ?
         WHERE id = ?',
        [
            isset($body['weight_kg'])    && $body['weight_kg']    !== '' ? (float) $body['weight_kg']    : null,
            isset($body['body_fat_pct']) && $body['body_fat_pct'] !== '' ? (float) $body['body_fat_pct'] : null,
            array_key_exists('notes', $body) ? $body['notes'] : Database::queryOne('SELECT notes FROM body_stats WHERE id=?', [$id])['notes'],
            $id,
        ]
    );

    Response::json(Database::queryOne('SELECT * FROM body_stats WHERE id = ?', [$id]));
}

if ($method === 'DELETE' && $id !== null) {
    $existing = Database::queryOne('SELECT id FROM body_stats WHERE id = ? AND user_id = ?', [$id, $_bsUserId]);
    if (!$existing) Response::notFound('Body stat not found');
    Database::run('DELETE FROM body_stats WHERE id = ?', [$id]);
    Response::noContent();
}

Response::notFound();
