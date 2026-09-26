<?php

use Illuminate\Support\Facades\Route;

$legacyPages = [
    '/' => 'legacy.welcome',
    '/index.html' => 'legacy.welcome',
    '/resources/views/welcome.html' => 'legacy.welcome',
    '/booking.html' => 'legacy.booking.index',
    '/resources/views/booking/index.html' => 'legacy.booking.index',
    '/status.html' => 'legacy.status.index',
    '/resources/views/status/index.html' => 'legacy.status.index',
    '/login.html' => 'legacy.auth.login',
    '/resources/views/auth/login.html' => 'legacy.auth.login',
    '/signup.html' => 'legacy.auth.signup',
    '/resources/views/auth/signup.html' => 'legacy.auth.signup',
    '/dashboard.html' => 'legacy.dashboard.index',
    '/resources/views/dashboard/index.html' => 'legacy.dashboard.index',
    '/admin-login.html' => 'legacy.admin.login',
    '/resources/views/admin/login.html' => 'legacy.admin.login',
    '/admin-dashboard.html' => 'legacy.admin.dashboard',
    '/resources/views/admin/dashboard.html' => 'legacy.admin.dashboard',
    '/admin-create-booking.html' => 'legacy.admin.create-booking',
    '/resources/views/admin/create-booking.html' => 'legacy.admin.create-booking',
    '/admin-asrama.html' => 'legacy.admin.asrama',
    '/resources/views/admin/asrama.html' => 'legacy.admin.asrama',
];

foreach ($legacyPages as $path => $view) {
    Route::view($path, $view);
}

