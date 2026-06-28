<?php

Auth::guard();

// ── POST /exercises/upload-media ──────────────────────────────────────────────
// Multipart upload of an image / gif / video. Returns { url, type }.
if ($method === 'POST' && $action === 'upload-media') {
    if (empty($_FILES['file'])) {
        Response::json(['error' => ['code' => 'NO_FILE', 'message' => 'No file uploaded']], 400);
    }
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        Response::json(['error' => ['code' => 'UPLOAD_ERROR', 'message' => 'Upload failed', 'php_error' => $file['error']]], 400);
    }

    // Limits: 25 MB
    $maxBytes = 25 * 1024 * 1024;
    if ($file['size'] > $maxBytes) {
        Response::json(['error' => ['code' => 'FILE_TOO_LARGE', 'message' => 'Max 25 MB']], 413);
    }

    // Sniff MIME type
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
        'image/webp' => 'webp',
        'video/mp4'  => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
    ];
    if (!isset($allowed[$mime])) {
        Response::json(['error' => ['code' => 'INVALID_TYPE', 'message' => 'Allowed: jpg, png, gif, webp, mp4, webm, mov']], 415);
    }

    $ext = $allowed[$mime];
    $kind = str_starts_with($mime, 'video/') ? 'video' : 'image';

    // Build hashed filename to avoid collisions / leak of original name
    $hash = bin2hex(random_bytes(12));
    $fileName = $hash . '.' . $ext;
    $destDir  = __DIR__ . '/../../data/uploads/exercises';
    if (!is_dir($destDir)) {
        mkdir($destDir, 0775, true);
    }
    $destPath = $destDir . '/' . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        Response::json(['error' => ['code' => 'WRITE_FAILED', 'message' => 'Could not save file']], 500);
    }

    $url = '/uploads/exercises/' . $fileName;
    Response::json(['url' => $url, 'type' => $kind, 'mime' => $mime], 201);
}

// ── GET /exercises ────────────────────────────────────────────────────────────
if ($method === 'GET' && $id === null) {
    $page  = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int) ($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $where  = [];
    $params = [];

    if (!empty($_GET['movement_type'])) {
        $where[]  = 'mt.name = ?';
        $params[] = $_GET['movement_type'];
    }
    if (isset($_GET['difficulty']) && $_GET['difficulty'] !== '') {
        $where[]  = 'e.difficulty = ?';
        $params[] = (int) $_GET['difficulty'];
    }
    if (!empty($_GET['search'])) {
        $where[]  = 'e.name LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }
    if (isset($_GET['is_weighted']) && $_GET['is_weighted'] !== '') {
        $where[]  = 'e.is_weighted = ?';
        $params[] = (int) $_GET['is_weighted'];
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $total = Database::queryOne(
        "SELECT COUNT(*) as c FROM exercises e
         JOIN movement_types mt ON mt.id = e.movement_type_id
         $whereClause",
        $params
    )['c'];

    $exercises = Database::query(
        "SELECT e.*, mt.name as movement_type_name
         FROM exercises e
         JOIN movement_types mt ON mt.id = e.movement_type_id
         $whereClause
         ORDER BY e.name ASC
         LIMIT ? OFFSET ?",
        [...$params, $limit, $offset]
    );

    // Attach muscles
    foreach ($exercises as &$ex) {
        $ex['muscles']  = _fetchMuscles($ex['id']);
        $ex['tendons']  = _fetchTendons($ex['id']);
        $ex['is_weighted'] = (bool) $ex['is_weighted'];
        $ex['is_timed']    = (bool) $ex['is_timed'];
    }

    Response::paginated($exercises, (int) $total, $page, $limit);
}

// ── GET /exercises/:id ────────────────────────────────────────────────────────
if ($method === 'GET' && $id !== null) {
    $ex = _fetchExercise($id);
    if (!$ex) Response::notFound('Exercise not found');
    Response::json($ex);
}

// ── POST /exercises ───────────────────────────────────────────────────────────
if ($method === 'POST' && $id === null) {
    Validator::make($body)
        ->required('name')
        ->required('movement_type_id')
        ->string('name', 200)
        ->integer('movement_type_id', 1)
        ->integer('difficulty', 1, 5, true)
        ->boolean('is_weighted', true)
        ->boolean('is_timed', true)
        ->float('default_weight', true)
        ->url('video_url', true)
        ->url('image_url', true)
        ->validate();

    Database::beginTransaction();
    try {
        $newId = Database::execute(
            'INSERT INTO exercises (name, movement_type_id, is_weighted, default_weight, difficulty, description, video_url, image_url, is_timed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $body['name'],
                (int) $body['movement_type_id'],
                (int) ($body['is_weighted'] ?? 0),
                isset($body['default_weight']) && $body['default_weight'] !== '' ? (float) $body['default_weight'] : null,
                (int) ($body['difficulty'] ?? 3),
                $body['description'] ?? null,
                $body['video_url']   ?? null,
                $body['image_url']   ?? null,
                (int) ($body['is_timed'] ?? 0),
            ]
        );

        _saveMuscles($newId, $body['muscles'] ?? []);
        _saveTendons($newId, $body['tendons'] ?? []);

        Database::commit();
    } catch (Throwable $e) {
        Database::rollback();
        throw $e;
    }

    $ex = _fetchExercise($newId);
    Response::json($ex, 201);
}

// ── PUT /exercises/:id ────────────────────────────────────────────────────────
if ($method === 'PUT' && $id !== null) {
    $existing = _fetchExercise($id);
    if (!$existing) Response::notFound('Exercise not found');

    Validator::make($body)
        ->string('name', 200)
        ->integer('movement_type_id', 1, null, true)
        ->integer('difficulty', 1, 5, true)
        ->boolean('is_weighted', true)
        ->boolean('is_timed', true)
        ->float('default_weight', true)
        ->url('video_url', true)
        ->url('image_url', true)
        ->validate();

    Database::beginTransaction();
    try {
        Database::run(
            'UPDATE exercises SET
                name             = COALESCE(?, name),
                movement_type_id = COALESCE(?, movement_type_id),
                is_weighted      = COALESCE(?, is_weighted),
                default_weight   = ?,
                difficulty       = COALESCE(?, difficulty),
                description      = ?,
                video_url        = ?,
                image_url        = ?,
                is_timed         = COALESCE(?, is_timed),
                updated_at       = datetime(\'now\')
             WHERE id = ?',
            [
                $body['name']             ?? null,
                isset($body['movement_type_id']) ? (int) $body['movement_type_id'] : null,
                isset($body['is_weighted'])      ? (int) $body['is_weighted']      : null,
                isset($body['default_weight']) && $body['default_weight'] !== '' ? (float) $body['default_weight'] : null,
                isset($body['difficulty'])       ? (int) $body['difficulty']       : null,
                array_key_exists('description', $body) ? $body['description'] : $existing['description'],
                array_key_exists('video_url', $body)   ? $body['video_url']   : $existing['video_url'],
                array_key_exists('image_url', $body)   ? $body['image_url']   : $existing['image_url'],
                isset($body['is_timed'])         ? (int) $body['is_timed']         : null,
                $id,
            ]
        );

        if (isset($body['muscles'])) {
            Database::run('DELETE FROM exercise_muscles WHERE exercise_id = ?', [$id]);
            _saveMuscles($id, $body['muscles']);
        }
        if (isset($body['tendons'])) {
            Database::run('DELETE FROM exercise_tendons WHERE exercise_id = ?', [$id]);
            _saveTendons($id, $body['tendons']);
        }

        Database::commit();
    } catch (Throwable $e) {
        Database::rollback();
        throw $e;
    }

    Response::json(_fetchExercise($id));
}

// ── DELETE /exercises/:id ─────────────────────────────────────────────────────
if ($method === 'DELETE' && $id !== null) {
    $existing = Database::queryOne('SELECT id FROM exercises WHERE id = ?', [$id]);
    if (!$existing) Response::notFound('Exercise not found');

    Database::run('DELETE FROM exercises WHERE id = ?', [$id]);
    Response::noContent();
}

Response::notFound();

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fetchExercise(int $id): ?array {
    $ex = Database::queryOne(
        'SELECT e.*, mt.name as movement_type_name
         FROM exercises e
         JOIN movement_types mt ON mt.id = e.movement_type_id
         WHERE e.id = ?',
        [$id]
    );
    if (!$ex) return null;
    $ex['muscles']     = _fetchMuscles($id);
    $ex['tendons']     = _fetchTendons($id);
    $ex['is_weighted'] = (bool) $ex['is_weighted'];
    $ex['is_timed']    = (bool) $ex['is_timed'];
    return $ex;
}

function _fetchMuscles(int $exerciseId): array {
    return Database::query(
        'SELECT m.id, m.name, m.group_name, em.role
         FROM exercise_muscles em
         JOIN muscles m ON m.id = em.muscle_id
         WHERE em.exercise_id = ?
         ORDER BY em.role, m.name',
        [$exerciseId]
    );
}

function _fetchTendons(int $exerciseId): array {
    $rows = Database::query(
        'SELECT tendon_name FROM exercise_tendons WHERE exercise_id = ? ORDER BY tendon_name',
        [$exerciseId]
    );
    return array_column($rows, 'tendon_name');
}

function _saveMuscles(int $exerciseId, array $muscles): void {
    foreach ($muscles as $m) {
        if (empty($m['id']) || empty($m['role'])) continue;
        Database::execute(
            'INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id, role) VALUES (?, ?, ?)',
            [$exerciseId, (int) $m['id'], $m['role']]
        );
    }
}

function _saveTendons(int $exerciseId, array $tendons): void {
    foreach ($tendons as $t) {
        if (empty($t)) continue;
        Database::execute(
            'INSERT INTO exercise_tendons (exercise_id, tendon_name) VALUES (?, ?)',
            [$exerciseId, trim($t)]
        );
    }
}
