<?php

namespace App\Http\Middleware;

use App\Models\Client;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureClientPortal
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() instanceof Client) {
            return response()->json(['message' => 'Accès réservé au portail client.'], 403);
        }

        return $next($request);
    }
}
