<?php

use App\Http\Controllers\LegacyApiController;
use Illuminate\Support\Facades\Route;

Route::any('/backend/api/{endpoint}', LegacyApiController::class)
    ->where('endpoint', '[A-Za-z0-9_-]+\.php');

