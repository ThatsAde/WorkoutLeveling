<?php

Auth::guard();

if ($method === 'GET') {
    $muscles = Database::query('SELECT * FROM muscles ORDER BY group_name, name');
    Response::json($muscles);
}

Response::notFound();
