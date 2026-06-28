<?php

Auth::guard();

if ($method === 'GET') {
    $types = Database::query('SELECT * FROM movement_types ORDER BY name');
    Response::json($types);
}

Response::notFound();
