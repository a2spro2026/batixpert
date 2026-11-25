<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\GhitaAssistant;
use Illuminate\Http\Request;

class GhitaApiController extends Controller
{
    public function intro()
    {
        return response()->json((new GhitaAssistant)->intro());
    }

    public function ask(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string|max:2000',
            'module' => 'nullable|string|max:40',
            'pending' => 'nullable|array',
            'context' => 'nullable|array',
            'context.client_id' => 'nullable|integer',
            'context.supplier_id' => 'nullable|integer',
            'context.focus' => 'nullable|string|max:20',
            'context.client_name' => 'nullable|string|max:255',
            'context.supplier_name' => 'nullable|string|max:255',
        ]);

        return response()->json((new GhitaAssistant)->reply(
            $data['message'],
            $request->user(),
            $data['module'] ?? null,
            $data['pending'] ?? null,
            $data['context'] ?? [],
        ));
    }
}
