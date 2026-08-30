<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserApiController extends Controller
{
    public const STATUTS = [
        'Gerant' => 'Gérant',
        'Assistant' => 'Assistant(e)',
        'Commercial' => 'Commercial',
        'Facturation' => 'Facturation',
    ];

    public function index()
    {
        $users = User::with('role')
            ->orderBy('id')
            ->get()
            ->map(fn (User $user) => $this->formatUser($user));

        return response()->json([
            'data' => $users,
            'meta' => [
                'statuts' => self::STATUTS,
                'next_id' => (int) User::max('id') + 1,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);

        $adminRole = Role::where('slug', 'administrateur')->first();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['login'],
            'phone' => $validated['phone'] ?? null,
            'statut' => $validated['statut'],
            'password' => Hash::make($validated['password']),
            'role_id' => $adminRole?->id,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        return response()->json([
            'data' => $this->formatUser($user->load('role')),
            'message' => 'Utilisateur créé.',
        ], 201);
    }

    public function show(User $user)
    {
        return response()->json([
            'data' => $this->formatUser($user->load('role')),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $validated = $this->validated($request, $user);

        $data = [
            'name' => $validated['name'],
            'email' => $validated['login'],
            'phone' => $validated['phone'] ?? null,
            'statut' => $validated['statut'],
        ];

        if (! empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        return response()->json([
            'data' => $this->formatUser($user->fresh('role')),
            'message' => 'Utilisateur mis à jour.',
        ]);
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }

        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé.']);
    }

    public function suspend(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas suspendre votre propre compte.'], 422);
        }

        $user->update(['is_active' => ! $user->is_active]);

        return response()->json([
            'data' => $this->formatUser($user->fresh('role')),
            'message' => $user->is_active ? 'Compte réactivé.' : 'Compte suspendu.',
        ]);
    }

    private function validated(Request $request, ?User $user = null): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:30',
            'statut' => 'required|in:'.implode(',', array_keys(self::STATUTS)),
            'login' => [
                'required',
                'string',
                'max:255',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'password' => [
                $user ? 'nullable' : 'required',
                'string',
                'min:4',
                'max:255',
            ],
        ]);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'phone' => $user->phone,
            'contact' => $user->phone,
            'statut' => $user->statut,
            'statut_label' => self::STATUTS[$user->statut] ?? $user->statut,
            'login' => $user->email,
            'email' => $user->email,
            'password_mask' => '••••••••',
            'is_active' => (bool) $user->is_active,
            'role' => $user->role?->only(['id', 'name', 'slug']),
        ];
    }
}
