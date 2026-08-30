<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required_without:email|string',
            'email' => 'required_without:login|string',
            'password' => 'required',
            'statut' => 'required|in:'.implode(',', array_keys(UserApiController::STATUTS)),
        ]);

        $login = trim((string) $request->input('login', $request->email));

        $user = User::with('role.permissions')
            ->where(function ($query) use ($login) {
                $query->where('email', $login)
                    ->orWhere('email', 'like', $login.'@%')
                    ->orWhereRaw('LOWER(name) = ?', [mb_strtolower($login)]);
            })
            ->where('statut', $request->statut)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Identifiants incorrects.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'login' => ['Compte désactivé.'],
            ]);
        }

        $token = $user->createToken('batixpert-spa')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnecté']);
    }

    public function user(Request $request)
    {
        $user = $request->user()->load('role.permissions');

        return response()->json($this->formatUser($user));
    }

    private function formatUser(User $user): array
    {
        $statutLabel = UserApiController::STATUTS[$user->statut] ?? $user->statut;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'statut' => $user->statut,
            'statut_label' => $statutLabel,
            'role' => $user->role?->only(['id', 'name', 'slug']),
            'permissions' => $user->role?->permissions->pluck('slug') ?? [],
            'is_admin' => $user->isAdmin(),
            'title' => $statutLabel ?: ($user->isAdmin() ? 'Directeur Général' : ($user->role?->name ?? '')),
        ];
    }
}
