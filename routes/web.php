<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect('/app'));
Route::redirect('/login', '/app/login');

Route::get('/app/{any?}', fn () => response()
    ->view('spa')
    ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'))
    ->where('any', '.*')
    ->name('spa');

require __DIR__.'/auth.php';
