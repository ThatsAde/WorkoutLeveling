<?php

Auth::guard();

if ($method === 'GET') {
    $cats = Database::query('SELECT * FROM workout_categories ORDER BY name');
    Response::json($cats);
}

Response::notFound();
