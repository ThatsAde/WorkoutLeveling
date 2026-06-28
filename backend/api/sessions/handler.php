<?php

Auth::guard();
$_sUserId = Auth::userId();

// ── GET /sessions ─────────────────────────────────────────────────────────────
if ($method === 'GET' && $id === null) {
    $page   = max(1, (int) ($_GET['page'] ?? 1));
    $limit  = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $where  = ['s.user_id = ?'];
    $params = [$_sUserId];

    if (!empty($_GET['from'])) {
        $where[]  = 's.started_at >= ?';
        $params[] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $where[]  = 's.started_at <= ?';
        $params[] = $_GET['to'];
    }
    if (!empty($_GET['workout_id'])) {
        $where[]  = 's.workout_id = ?';
        $params[] = (int) $_GET['workout_id'];
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $total = Database::queryOne(
        "SELECT COUNT(*) as c FROM sessions s $whereClause", $params
    )['c'];

    $sessions = Database::query(
        "SELECT s.*, w.name as workout_name,
                (SELECT COUNT(*) FROM session_sets WHERE session_id = s.id) as set_count
         FROM sessions s
         LEFT JOIN workouts w ON w.id = s.workout_id
         $whereClause
         ORDER BY s.started_at DESC
         LIMIT ? OFFSET ?",
        [...$params, $limit, $offset]
    );

    Response::paginated($sessions, (int) $total, $page, $limit);
}

// ── GET /sessions/:id ─────────────────────────────────────────────────────────
if ($method === 'GET' && $id !== null && $sub === null) {
    $s = _fetchSession($id);
    if (!$s || $s['user_id'] != $_sUserId) Response::notFound('Session not found');
    Response::json($s);
}

// ── POST /sessions (start a new session) ─────────────────────────────────────
if ($method === 'POST' && $id === null) {
    Validator::make($body)
        ->integer('workout_id', 1, null, true)
        ->string('name', 200)
        ->validate();

    $startedAt = $body['started_at'] ?? date('Y-m-d H:i:s');
    $name      = $body['name'] ?? null;

    // If workout_id provided and no name, use workout name
    if (!$name && !empty($body['workout_id'])) {
        $w = Database::queryOne('SELECT name FROM workouts WHERE id = ?', [(int) $body['workout_id']]);
        $name = $w ? $w['name'] : null;
    }

    $newId = Database::execute(
        'INSERT INTO sessions (workout_id, name, started_at, user_id) VALUES (?, ?, ?, ?)',
        [
            isset($body['workout_id']) && $body['workout_id'] !== '' ? (int) $body['workout_id'] : null,
            $name,
            $startedAt,
            $_sUserId,
        ]
    );

    // If workout_id given, scaffold sets from workout_exercises
    if (!empty($body['workout_id'])) {
        $wExercises = Database::query(
            'SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position',
            [(int) $body['workout_id']]
        );
        // Don't auto-insert sets — let the user log them manually
        // Just return session with the workout context
    }

    Response::json(_fetchSession($newId), 201);
}

// ── PUT /sessions/:id ─────────────────────────────────────────────────────────
if ($method === 'PUT' && $id !== null && $sub === null) {
    $existing = Database::queryOne('SELECT id FROM sessions WHERE id = ? AND user_id = ?', [$id, $_sUserId]);
    if (!$existing) Response::notFound('Session not found');

    Validator::make($body)
        ->integer('overall_rpe', 1, 10, true)
        ->validate();

    Database::run(
        'UPDATE sessions SET
            ended_at    = COALESCE(?, ended_at),
            notes       = ?,
            overall_rpe = COALESCE(?, overall_rpe),
            name        = COALESCE(?, name)
         WHERE id = ?',
        [
            $body['ended_at']    ?? null,
            array_key_exists('notes', $body) ? $body['notes'] : Database::queryOne('SELECT notes FROM sessions WHERE id=?', [$id])['notes'],
            isset($body['overall_rpe']) && $body['overall_rpe'] !== '' ? (int) $body['overall_rpe'] : null,
            $body['name']        ?? null,
            $id,
        ]
    );

    Response::json(_fetchSession($id));
}

// ── DELETE /sessions/:id ──────────────────────────────────────────────────────
if ($method === 'DELETE' && $id !== null && $sub === null) {
    $existing = Database::queryOne('SELECT id FROM sessions WHERE id = ? AND user_id = ?', [$id, $_sUserId]);
    if (!$existing) Response::notFound('Session not found');
    Database::run('DELETE FROM sessions WHERE id = ?', [$id]);
    Response::noContent();
}

// ── POST /sessions/:id/sets ───────────────────────────────────────────────────
if ($method === 'POST' && $id !== null && $sub === 'sets') {
    $existing = Database::queryOne('SELECT id FROM sessions WHERE id = ? AND user_id = ?', [$id, $_sUserId]);
    if (!$existing) Response::notFound('Session not found');

    Validator::make($body)
        ->required('exercise_id')
        ->required('set_number')
        ->integer('exercise_id', 1)
        ->integer('set_number', 1)
        ->integer('reps', 0, null, true)
        ->integer('duration_s', 0, null, true)
        ->float('weight', true)
        ->integer('rpe', 1, 10, true)
        ->boolean('completed', true)
        ->validate();

    $setId = Database::execute(
        'INSERT INTO session_sets (session_id, exercise_id, set_number, reps, duration_s, weight, rpe, notes, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $id,
            (int) $body['exercise_id'],
            (int) $body['set_number'],
            isset($body['reps'])       && $body['reps']       !== '' ? (int) $body['reps']       : null,
            isset($body['duration_s']) && $body['duration_s'] !== '' ? (int) $body['duration_s'] : null,
            isset($body['weight'])     && $body['weight']     !== '' ? (float) $body['weight']   : null,
            isset($body['rpe'])        && $body['rpe']        !== '' ? (int) $body['rpe']        : null,
            $body['notes']    ?? null,
            (int) ($body['completed'] ?? 1),
        ]
    );

    Response::json(_fetchSet($setId), 201);
}

// ── PUT /sessions/:id/sets/:subId ─────────────────────────────────────────────
if ($method === 'PUT' && $id !== null && $sub === 'sets' && $subId !== null) {
    // Verify session ownership before updating set
    $sessionOwn = Database::queryOne('SELECT id FROM sessions WHERE id = ? AND user_id = ?', [$id, $_sUserId]);
    if (!$sessionOwn) Response::notFound('Session not found');
    $set = Database::queryOne('SELECT id FROM session_sets WHERE id = ? AND session_id = ?', [$subId, $id]);
    if (!$set) Response::notFound('Set not found');

    Database::run(
        'UPDATE session_sets SET
            reps       = ?,
            duration_s = ?,
            weight     = ?,
            rpe        = ?,
            notes      = ?,
            completed  = COALESCE(?, completed)
         WHERE id = ?',
        [
            isset($body['reps'])       && $body['reps']       !== '' ? (int) $body['reps']       : null,
            isset($body['duration_s']) && $body['duration_s'] !== '' ? (int) $body['duration_s'] : null,
            isset($body['weight'])     && $body['weight']     !== '' ? (float) $body['weight']   : null,
            isset($body['rpe'])        && $body['rpe']        !== '' ? (int) $body['rpe']        : null,
            array_key_exists('notes', $body) ? $body['notes'] : Database::queryOne('SELECT notes FROM session_sets WHERE id=?', [$subId])['notes'],
            isset($body['completed']) ? (int) $body['completed'] : null,
            $subId,
        ]
    );

    Response::json(_fetchSet($subId));
}

// ── DELETE /sessions/:id/sets/:subId ──────────────────────────────────────────
if ($method === 'DELETE' && $id !== null && $sub === 'sets' && $subId !== null) {
    $sessionOwn = Database::queryOne('SELECT id FROM sessions WHERE id = ? AND user_id = ?', [$id, $_sUserId]);
    if (!$sessionOwn) Response::notFound('Session not found');
    $set = Database::queryOne('SELECT id FROM session_sets WHERE id = ? AND session_id = ?', [$subId, $id]);
    if (!$set) Response::notFound('Set not found');
    Database::run('DELETE FROM session_sets WHERE id = ?', [$subId]);
    Response::noContent();
}

Response::notFound();

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fetchSession(int $id): ?array {
    $s = Database::queryOne(
        'SELECT s.*, w.name as workout_template_name
         FROM sessions s
         LEFT JOIN workouts w ON w.id = s.workout_id
         WHERE s.id = ?',
        [$id]
    );
    if (!$s) return null;

    $s['sets'] = Database::query(
        'SELECT ss.*, e.name as exercise_name, e.is_timed, e.is_weighted,
                mt.name as movement_type_name
         FROM session_sets ss
         JOIN exercises e ON e.id = ss.exercise_id
         JOIN movement_types mt ON mt.id = e.movement_type_id
         WHERE ss.session_id = ?
         ORDER BY ss.exercise_id, ss.set_number',
        [$id]
    );

    foreach ($s['sets'] as &$set) {
        $set['completed']  = (bool) $set['completed'];
        $set['is_timed']   = (bool) $set['is_timed'];
        $set['is_weighted']= (bool) $set['is_weighted'];
    }

    return $s;
}

function _fetchSet(int $id): ?array {
    $set = Database::queryOne(
        'SELECT ss.*, e.name as exercise_name, e.is_timed, e.is_weighted
         FROM session_sets ss
         JOIN exercises e ON e.id = ss.exercise_id
         WHERE ss.id = ?',
        [$id]
    );
    if (!$set) return null;
    $set['completed']   = (bool) $set['completed'];
    $set['is_timed']    = (bool) $set['is_timed'];
    $set['is_weighted'] = (bool) $set['is_weighted'];
    return $set;
}
