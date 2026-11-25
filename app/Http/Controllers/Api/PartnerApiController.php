<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Support\PartnerMenu;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class PartnerApiController extends Controller
{
    public function index()
    {
        $partners = Client::query()
            ->whereNotNull('portal_login')
            ->orderBy('name')
            ->get()
            ->map(fn (Client $client) => $this->format($client));

        $clients = Client::query()
            ->orderBy('name')
            ->get(['id', 'name', 'phone', 'city', 'portal_login']);

        return response()->json([
            'data' => $partners,
            'meta' => [
                'clients' => $clients,
                'sections' => PartnerMenu::sections(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);

        $client = Client::findOrFail($validated['client_id']);
        $this->apply($client, $validated, true);

        return response()->json([
            'data' => $this->format($client->fresh()),
            'message' => 'Partenaire enregistré.',
        ], 201);
    }

    public function update(Request $request, Client $client)
    {
        $validated = $this->validated($request, $client);
        $this->apply($client, $validated, false);

        return response()->json([
            'data' => $this->format($client->fresh()),
            'message' => 'Partenaire mis à jour.',
        ]);
    }

    public function suspend(Client $client)
    {
        if (! filled($client->portal_login)) {
            return response()->json(['message' => 'Ce client n’a pas d’accès partenaire.'], 422);
        }

        $client->update(['portal_enabled' => ! $client->portal_enabled]);

        return response()->json([
            'data' => $this->format($client->fresh()),
            'message' => $client->portal_enabled ? 'Accès réactivé.' : 'Accès suspendu.',
        ]);
    }

    public function destroy(Client $client)
    {
        $client->update([
            'portal_login' => null,
            'portal_password' => null,
            'portal_enabled' => false,
            'portal_permissions' => null,
        ]);
        $client->tokens()->where('name', 'batixpert-client-portal')->delete();

        return response()->json(['message' => 'Accès partenaire retiré.']);
    }

    private function validated(Request $request, ?Client $client = null): array
    {
        return $request->validate([
            'client_id' => [
                'required',
                'integer',
                'exists:clients,id',
                Rule::unique('clients', 'id')->where(fn ($q) => $q->whereNotNull('portal_login'))->ignore($client?->id),
            ],
            'login' => [
                'required',
                'string',
                'max:100',
                Rule::unique('clients', 'portal_login')->ignore($client?->id),
            ],
            'password' => [$client ? 'nullable' : 'required', 'string', 'min:4', 'max:100'],
            'permissions' => 'array',
            'permissions.*' => 'string|in:'.implode(',', PartnerMenu::slugs()),
        ], [
            'client_id.unique' => 'Ce client a déjà un accès partenaire.',
            'login.unique' => 'Ce login est déjà utilisé.',
        ]);
    }

    private function apply(Client $client, array $validated, bool $creating): void
    {
        $data = [
            'portal_login' => trim($validated['login']),
            'portal_enabled' => true,
            'portal_permissions' => array_values(array_unique($validated['permissions'] ?? [])),
        ];

        if ($creating || filled($validated['password'] ?? null)) {
            $data['portal_password'] = Hash::make($validated['password']);
        }

        $client->update($data);
        $client->tokens()->where('name', 'batixpert-client-portal')->delete();
    }

    private function format(Client $client): array
    {
        $permissions = $client->portal_permissions ?? [];
        $labels = collect(PartnerMenu::sections())
            ->whereIn('slug', $permissions)
            ->pluck('label')
            ->values()
            ->all();

        return [
            'id' => $client->id,
            'client_id' => $client->id,
            'name' => $client->name,
            'phone' => $client->phone,
            'city' => $client->city,
            'login' => $client->portal_login,
            'password_mask' => '••••••••',
            'has_password' => filled($client->portal_password),
            'is_active' => (bool) $client->portal_enabled,
            'permissions' => $permissions,
            'access_labels' => $labels,
        ];
    }
}
