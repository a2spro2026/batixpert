<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const STATUTS = [
        'Gerant' => 'Gérant',
        'Assistant' => 'Assistant(e)',
        'Commercial' => 'Commercial',
        'Facturation' => 'Facturation',
    ];

    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required_without:email|string',
            'email' => 'required_without:login|string',
            'password' => 'required|string',
            'statut' => 'required|in:'.implode(',', array_keys(self::STATUTS)),
        ]);

        $login = trim((string) $request->input('login', $request->email));

        $user = User::with(['role.permissions', 'permissions'])
            ->where(function ($query) use ($login) {
                $query->where('email', $login)
                    ->orWhere('email', 'like', $login.'@%')
                    ->orWhereRaw('LOWER(name) = ?', [mb_strtolower($login)]);
            })
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Statut, login ou mot de passe incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'login' => ['Compte suspendu.'],
            ]);
        }

        if (($user->statut ?? '') !== $request->statut) {
            throw ValidationException::withMessages([
                'statut' => ['Le statut ne correspond pas à ce compte.'],
            ]);
        }

        $token = $user->createToken('batixpert-spa')->plainTextToken;
        $statut = $user->statut;
        $statutLabel = self::STATUTS[$statut] ?? $statut;

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user, $statut, $statutLabel),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Déconnecté']);
    }

    public function user(Request $request)
    {
        $auth = $request->user();

        if ($auth instanceof Client) {
            return response()->json($this->formatClient($auth));
        }

        $user = $auth->load(['role.permissions', 'permissions']);
        $statut = $user->statut;
        $statutLabel = $statut ? (self::STATUTS[$statut] ?? $statut) : null;

        return response()->json($this->formatUser($user, $statut, $statutLabel));
    }

    private function formatClient(Client $client): array
    {
        return [
            'id' => $client->id,
            'client_id' => $client->id,
            'name' => $client->name,
            'email' => $client->email,
            'login' => $client->portal_login ?: $client->name,
            'phone' => $client->phone,
            'city' => $client->city,
            'statut' => 'Client',
            'statut_label' => 'Client',
            'role' => null,
            'permissions' => [],
            'is_admin' => false,
            'is_client_portal' => true,
            'title' => 'Client',
        ];
    }

    private function formatUser(User $user, ?string $statut = null, ?string $statutLabel = null): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'login' => $user->email,
            'phone' => $user->phone,
            'statut' => $statut ?? $user->statut,
            'statut_label' => $statutLabel ?? (self::STATUTS[$user->statut] ?? $user->statut),
            'role' => $user->role?->only(['id', 'name', 'slug']),
            'permissions' => $user->permissions->pluck('slug')
                ->merge($user->role?->permissions->pluck('slug') ?? collect())
                ->unique()
                ->values()
                ->all(),
            'is_admin' => $user->isAdmin(),
            'is_client_portal' => false,
            'avatar' => $user->isAdmin() ? '/images/admin-profile.jpg' : null,
            'title' => $statutLabel
                ?? (self::STATUTS[$user->statut] ?? null)
                ?? ($user->isAdmin() ? 'Directeur Général' : ($user->role?->name ?? '')),
        ];
    }
}
