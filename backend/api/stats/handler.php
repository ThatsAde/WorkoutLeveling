<?php

Auth::guard();
$_stUserId = Auth::userId();

$statType = $segments[1] ?? '';

// ── GET /stats/volume ─────────────────────────────────────────────────────────
if ($method === 'GET' && $statType === 'volume') {
    $from    = $_GET['from']    ?? date('Y-m-d', strtotime('-90 days'));
    $to      = $_GET['to']      ?? date('Y-m-d H:i:s');
    $groupBy = $_GET['group_by'] ?? 'week';

    $format = match ($groupBy) {
        'month' => '%Y-%m',
        'day'   => '%Y-%m-%d',
        default => '%Y-%W',
    };

    $where  = ['s.started_at BETWEEN ? AND ?', 's.user_id = ?'];
    $params = [$from, $to, $_stUserId];

    if (!empty($_GET['exercise_id'])) {
        $where[]  = 'ss.exercise_id = ?';
        $params[] = (int) $_GET['exercise_id'];
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $rows = Database::query(
        "SELECT
            strftime('$format', s.started_at) AS period,
            e.id AS exercise_id,
            e.name AS exercise_name,
            mt.name AS movement_type,
            SUM(COALESCE(ss.reps, ss.duration_s, 0)) AS total_reps,
            SUM(COALESCE(ss.reps, ss.duration_s, 0) * COALESCE(ss.weight, 0)) AS volume,
            COUNT(DISTINCT s.id) AS session_count
         FROM session_sets ss
         JOIN sessions s  ON s.id  = ss.session_id
         JOIN exercises e ON e.id  = ss.exercise_id
         JOIN movement_types mt ON mt.id = e.movement_type_id
         $whereClause
         GROUP BY period, ss.exercise_id
         ORDER BY period ASC, e.name ASC",
        $params
    );

    Response::json($rows);
}

// ── GET /stats/frequency ──────────────────────────────────────────────────────
if ($method === 'GET' && $statType === 'frequency') {
    $from = $_GET['from'] ?? date('Y-m-d', strtotime('-90 days'));
    $to   = $_GET['to']   ?? date('Y-m-d H:i:s');

    $rows = Database::query(
        "SELECT
            m.id AS muscle_id,
            m.name AS muscle_name,
            m.group_name,
            em.role,
            COUNT(DISTINCT s.id) AS session_count,
            COUNT(ss.id) AS set_count
         FROM session_sets ss
         JOIN sessions s ON s.id = ss.session_id
         JOIN exercise_muscles em ON em.exercise_id = ss.exercise_id
         JOIN muscles m ON m.id = em.muscle_id
         WHERE s.started_at BETWEEN ? AND ? AND s.user_id = ?
         GROUP BY m.id, em.role
         ORDER BY session_count DESC",
        [$from, $to, $_stUserId]
    );

    Response::json($rows);
}

// ── GET /stats/progression ────────────────────────────────────────────────────
if ($method === 'GET' && $statType === 'progression') {
    if (empty($_GET['exercise_id'])) {
        Response::error('MISSING_PARAM', 'exercise_id is required', 400);
    }

    $exerciseId = (int) $_GET['exercise_id'];
    $metric     = $_GET['metric'] ?? 'max_weight';
    $from       = $_GET['from']   ?? date('Y-m-d', strtotime('-1 year'));
    $to         = $_GET['to']     ?? date('Y-m-d H:i:s');

    $selectMetric = match ($metric) {
        'max_reps'   => 'MAX(ss.reps)',
        'total_reps' => 'SUM(ss.reps)',
        'volume'     => 'SUM(COALESCE(ss.reps, ss.duration_s, 0) * COALESCE(ss.weight, 1))',
        default      => 'MAX(ss.weight)',
    };

    $rows = Database::query(
        "SELECT
            date(s.started_at) AS date,
            $selectMetric AS value,
            COUNT(ss.id) AS set_count
         FROM session_sets ss
         JOIN sessions s ON s.id = ss.session_id
         WHERE ss.exercise_id = ?
           AND s.started_at BETWEEN ? AND ?
           AND ss.completed = 1
           AND s.user_id = ?
         GROUP BY date(s.started_at)
         ORDER BY date ASC",
        [$exerciseId, $from, $to, $_stUserId]
    );

    $exercise = Database::queryOne('SELECT name FROM exercises WHERE id = ?', [$exerciseId]);
    Response::json(['exercise' => $exercise, 'metric' => $metric, 'data' => $rows]);
}

// ── GET /stats/calendar ───────────────────────────────────────────────────────
if ($method === 'GET' && $statType === 'calendar') {
    $year  = (int) ($_GET['year']  ?? date('Y'));
    $month = isset($_GET['month']) ? (int) $_GET['month'] : null;

    if ($month) {
        $from = sprintf('%04d-%02d-01', $year, $month);
        $to   = date('Y-m-t', strtotime($from));
    } else {
        $from = "$year-01-01";
        $to   = "$year-12-31";
    }

    $rows = Database::query(
        "SELECT
            date(started_at) AS date,
            COUNT(*) AS session_count,
            GROUP_CONCAT(COALESCE(name, 'Workout'), ', ') AS session_names
         FROM sessions
         WHERE date(started_at) BETWEEN ? AND ? AND user_id = ?
         GROUP BY date(started_at)
         ORDER BY date ASC",
        [$from, $to, $_stUserId]
    );

    Response::json($rows);
}

// ── GET /stats/summary ────────────────────────────────────────────────────────
if ($method === 'GET' && $statType === 'summary') {
    $days = (int) ($_GET['days'] ?? 30);
    $from = date('Y-m-d', strtotime("-$days days"));
    $to   = date('Y-m-d H:i:s');

    $sessions = Database::queryOne(
        "SELECT COUNT(*) as c FROM sessions WHERE started_at BETWEEN ? AND ? AND user_id = ?",
        [$from, $to, $_stUserId]
    )['c'];

    $totalSets = Database::queryOne(
        "SELECT COUNT(*) as c FROM session_sets ss
         JOIN sessions s ON s.id = ss.session_id
         WHERE s.started_at BETWEEN ? AND ? AND ss.completed = 1 AND s.user_id = ?",
        [$from, $to, $_stUserId]
    )['c'];

    $topExercises = Database::query(
        "SELECT e.name, COUNT(ss.id) as set_count
         FROM session_sets ss
         JOIN sessions s ON s.id = ss.session_id
         JOIN exercises e ON e.id = ss.exercise_id
         WHERE s.started_at BETWEEN ? AND ? AND s.user_id = ?
         GROUP BY ss.exercise_id
         ORDER BY set_count DESC
         LIMIT 5",
        [$from, $to, $_stUserId]
    );

    $streak = _calculateStreak($_stUserId);

    Response::json([
        'period_days'   => $days,
        'sessions'      => (int) $sessions,
        'total_sets'    => (int) $totalSets,
        'top_exercises' => $topExercises,
        'current_streak'=> $streak,
    ]);
}

Response::notFound();

// ── Helpers ───────────────────────────────────────────────────────────────────

function _calculateStreak(int $userId): int {
    $dates = Database::query(
        "SELECT DISTINCT date(started_at) as d FROM sessions WHERE user_id = ? ORDER BY d DESC",
        [$userId]
    );
    if (empty($dates)) return 0;

    $streak   = 0;
    $today    = new DateTime('today');
    $expected = clone $today;

    foreach ($dates as $row) {
        $d = new DateTime($row['d']);
        $diff = $expected->diff($d)->days;
        if ($diff === 0) {
            $streak++;
            $expected->modify('-1 day');
        } elseif ($diff === 1 && $streak === 0) {
            // Allow today to be missed (yesterday was last)
            $expected = clone $d;
            $streak++;
            $expected->modify('-1 day');
        } else {
            break;
        }
    }

    return $streak;
}
