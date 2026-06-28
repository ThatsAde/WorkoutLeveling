<?php

Auth::guard();
$_wUserId = Auth::userId();

// ── GET /workouts ─────────────────────────────────────────────────────────────
if ($method === 'GET' && $id === null) {
    $where  = ['w.user_id = ?'];
    $params = [$_wUserId];

    if (!empty($_GET['category_id'])) {
        $where[]  = 'w.category_id = ?';
        $params[] = (int) $_GET['category_id'];
    }
    if (!empty($_GET['search'])) {
        $where[]  = 'w.name LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $workouts = Database::query(
        "SELECT w.*, wc.name as category_name,
                (SELECT COUNT(*) FROM workout_exercises WHERE workout_id = w.id) as exercise_count
         FROM workouts w
         LEFT JOIN workout_categories wc ON wc.id = w.category_id
         $whereClause
         ORDER BY w.updated_at DESC",
        $params
    );

    Response::json($workouts);
}

// ── GET /workouts/:id ─────────────────────────────────────────────────────────
if ($method === 'GET' && $id !== null && $sub === null) {
    $w = _fetchWorkout($id);
    if (!$w || $w['user_id'] != $_wUserId) Response::notFound('Workout not found');
    Response::json($w);
}

// ── POST /workouts ────────────────────────────────────────────────────────────
if ($method === 'POST' && $id === null) {
    Validator::make($body)
        ->required('name')
        ->string('name', 200)
        ->integer('category_id', 1, null, true)
        ->integer('estimated_duration_min', 1, null, true)
        ->validate();

    $newId = Database::execute(
        'INSERT INTO workouts (name, category_id, description, estimated_duration_min, user_id) VALUES (?, ?, ?, ?, ?)',
        [
            $body['name'],
            isset($body['category_id']) && $body['category_id'] !== '' ? (int) $body['category_id'] : null,
            $body['description'] ?? null,
            isset($body['estimated_duration_min']) && $body['estimated_duration_min'] !== '' ? (int) $body['estimated_duration_min'] : null,
            $_wUserId,
        ]
    );

    // Optionally add exercises inline
    if (!empty($body['exercises'])) {
        _saveWorkoutExercises($newId, $body['exercises']);
    }

    Response::json(_fetchWorkout($newId), 201);
}

// ── PUT /workouts/:id ─────────────────────────────────────────────────────────
if ($method === 'PUT' && $id !== null && $sub === null) {
    $existing = Database::queryOne('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [$id, $_wUserId]);
    if (!$existing) Response::notFound('Workout not found');

    Validator::make($body)
        ->string('name', 200)
        ->integer('category_id', 1, null, true)
        ->integer('estimated_duration_min', 1, null, true)
        ->validate();

    Database::run(
        'UPDATE workouts SET
            name                    = COALESCE(?, name),
            category_id             = ?,
            description             = ?,
            estimated_duration_min  = ?,
            updated_at              = datetime(\'now\')
         WHERE id = ?',
        [
            $body['name'] ?? null,
            array_key_exists('category_id', $body) ? (isset($body['category_id']) && $body['category_id'] !== '' ? (int) $body['category_id'] : null) : Database::queryOne('SELECT category_id FROM workouts WHERE id=?', [$id])['category_id'],
            array_key_exists('description', $body) ? $body['description'] : Database::queryOne('SELECT description FROM workouts WHERE id=?', [$id])['description'],
            array_key_exists('estimated_duration_min', $body) ? (isset($body['estimated_duration_min']) && $body['estimated_duration_min'] !== '' ? (int) $body['estimated_duration_min'] : null) : Database::queryOne('SELECT estimated_duration_min FROM workouts WHERE id=?', [$id])['estimated_duration_min'],
            $id,
        ]
    );

    Response::json(_fetchWorkout($id));
}

// ── DELETE /workouts/:id ──────────────────────────────────────────────────────
if ($method === 'DELETE' && $id !== null && $sub === null) {
    $existing = Database::queryOne('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [$id, $_wUserId]);
    if (!$existing) Response::notFound('Workout not found');
    Database::run('DELETE FROM workouts WHERE id = ?', [$id]);
    Response::noContent();
}

// ── POST /workouts/:id/exercises ──────────────────────────────────────────────
if ($method === 'POST' && $id !== null && $sub === 'exercises') {
    $existing = Database::queryOne('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [$id, $_wUserId]);
    if (!$existing) Response::notFound('Workout not found');

    Validator::make($body)
        ->required('exercise_id')
        ->integer('exercise_id', 1)
        ->integer('sets', 1, null, true)
        ->integer('target_reps', 1, null, true)
        ->integer('target_time_s', 1, null, true)
        ->integer('rest_s', 0, null, true)
        ->validate();

    $maxPos = Database::queryOne(
        'SELECT COALESCE(MAX(position), 0) as m FROM workout_exercises WHERE workout_id = ?', [$id]
    )['m'];

    $weId = Database::execute(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position, sets, target_reps, target_time_s, rest_s, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $id,
            (int) $body['exercise_id'],
            $maxPos + 1,
            (int) ($body['sets'] ?? 3),
            isset($body['target_reps']) && $body['target_reps'] !== '' ? (int) $body['target_reps'] : null,
            isset($body['target_time_s']) && $body['target_time_s'] !== '' ? (int) $body['target_time_s'] : null,
            (int) ($body['rest_s'] ?? 90),
            $body['notes'] ?? null,
        ]
    );

    Response::json(_fetchWorkout($id), 201);
}

// ── PUT /workouts/:id/exercises/:subId ────────────────────────────────────────
if ($method === 'PUT' && $id !== null && $sub === 'exercises' && $subId !== null) {
    $we = Database::queryOne('SELECT id FROM workout_exercises WHERE id = ? AND workout_id = ?', [$subId, $id]);
    if (!$we) Response::notFound('Workout exercise not found');

    Database::run(
        'UPDATE workout_exercises SET
            sets          = COALESCE(?, sets),
            target_reps   = ?,
            target_time_s = ?,
            rest_s        = COALESCE(?, rest_s),
            notes         = ?
         WHERE id = ?',
        [
            isset($body['sets']) ? (int) $body['sets'] : null,
            array_key_exists('target_reps', $body) ? (isset($body['target_reps']) && $body['target_reps'] !== '' ? (int) $body['target_reps'] : null) : Database::queryOne('SELECT target_reps FROM workout_exercises WHERE id=?', [$subId])['target_reps'],
            array_key_exists('target_time_s', $body) ? (isset($body['target_time_s']) && $body['target_time_s'] !== '' ? (int) $body['target_time_s'] : null) : Database::queryOne('SELECT target_time_s FROM workout_exercises WHERE id=?', [$subId])['target_time_s'],
            isset($body['rest_s']) ? (int) $body['rest_s'] : null,
            array_key_exists('notes', $body) ? $body['notes'] : Database::queryOne('SELECT notes FROM workout_exercises WHERE id=?', [$subId])['notes'],
            $subId,
        ]
    );

    Response::json(_fetchWorkout($id));
}

// ── DELETE /workouts/:id/exercises/:subId ─────────────────────────────────────
if ($method === 'DELETE' && $id !== null && $sub === 'exercises' && $subId !== null) {
    $we = Database::queryOne('SELECT id FROM workout_exercises WHERE id = ? AND workout_id = ?', [$subId, $id]);
    if (!$we) Response::notFound('Workout exercise not found');

    Database::run('DELETE FROM workout_exercises WHERE id = ?', [$subId]);
    // Re-order positions
    $exercises = Database::query(
        'SELECT id FROM workout_exercises WHERE workout_id = ? ORDER BY position', [$id]
    );
    foreach ($exercises as $i => $we2) {
        Database::run('UPDATE workout_exercises SET position = ? WHERE id = ?', [$i + 1, $we2['id']]);
    }

    Response::json(_fetchWorkout($id));
}

// ── PUT /workouts/:id/reorder ─────────────────────────────────────────────────
if ($method === 'PUT' && $id !== null && $sub === 'reorder') {
    if (!is_array($body)) Response::error('INVALID_BODY', 'Expected array of {id, position}', 400);

    Database::beginTransaction();
    try {
        foreach ($body as $item) {
            if (!isset($item['id'], $item['position'])) continue;
            Database::run(
                'UPDATE workout_exercises SET position = ? WHERE id = ? AND workout_id = ?',
                [(int) $item['position'], (int) $item['id'], $id]
            );
        }
        Database::commit();
    } catch (Throwable $e) {
        Database::rollback();
        throw $e;
    }

    Response::json(_fetchWorkout($id));
}

Response::notFound();

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fetchWorkout(int $id): ?array {
    $w = Database::queryOne(
        'SELECT w.*, wc.name as category_name
         FROM workouts w
         LEFT JOIN workout_categories wc ON wc.id = w.category_id
         WHERE w.id = ?',
        [$id]
    );
    if (!$w) return null;

    $w['exercises'] = Database::query(
        'SELECT we.*, e.name as exercise_name, e.is_timed, e.is_weighted,
                mt.name as movement_type_name
         FROM workout_exercises we
         JOIN exercises e ON e.id = we.exercise_id
         JOIN movement_types mt ON mt.id = e.movement_type_id
         WHERE we.workout_id = ?
         ORDER BY we.position',
        [$id]
    );

    return $w;
}

function _saveWorkoutExercises(int $workoutId, array $exercises): void {
    foreach ($exercises as $i => $ex) {
        if (empty($ex['exercise_id'])) continue;
        Database::execute(
            'INSERT INTO workout_exercises (workout_id, exercise_id, position, sets, target_reps, target_time_s, rest_s, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $workoutId,
                (int) $ex['exercise_id'],
                $i + 1,
                (int) ($ex['sets'] ?? 3),
                isset($ex['target_reps']) && $ex['target_reps'] !== '' ? (int) $ex['target_reps'] : null,
                isset($ex['target_time_s']) && $ex['target_time_s'] !== '' ? (int) $ex['target_time_s'] : null,
                (int) ($ex['rest_s'] ?? 90),
                $ex['notes'] ?? null,
            ]
        );
    }
}
