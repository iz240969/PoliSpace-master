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

        // Legacy handlers read query parameters from $_GET. Some hosting
        // FastCGI setups omit them from PHP's globals and QUERY_STRING, so
        // also recover the original query from REQUEST_URI when needed.
        $queryString = (string) $request->server('QUERY_STRING', '');
        if ($queryString === '') {
            $requestUri = (string) $request->server('REQUEST_URI', '');
            $queryString = (string) (parse_url($requestUri, PHP_URL_QUERY) ?? '');
        }

        $queryParameters = [];
        if ($queryString !== '') {
            parse_str($queryString, $queryParameters);
        }
        $queryParameters = array_replace($queryParameters, $request->query->all());
        $_GET = array_replace($_GET, $queryParameters);

        require base_path('backend/api/'.$endpoint);

        // Existing API scripts terminate after writing their JSON response.
        exit;
    }
}

