<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Routes the existing JSON API through Laravel while its handlers are migrated.
 * The allowlist prevents request paths from being used as filesystem paths.
 */
class LegacyApiController extends Controller
{
    private const ENDPOINTS = [
        'asrama_rooms.php',
        'auth.php',
        'bookings.php',
        'facilities.php',
        'messages.php',
        'pics.php',
        'receipts.php',
        'users.php',
    ];

    public function __invoke(Request $request, string $endpoint): never
    {
        if (! in_array($endpoint, self::ENDPOINTS, true)) {
            throw new NotFoundHttpException;
        }

        require base_path('backend/api/'.$endpoint);

        // Existing API scripts terminate after writing their JSON response.
        exit;
    }
}

