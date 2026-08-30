<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\User;
use App\Support\AuthorizationMenu;
use Illuminate\Http\Request;

class UserAuthorizationApiController extends Controller
{
    public function menu()
    {
        return response()->json([
            'data' => AuthorizationMenu::sections(),
        ]);
    }

    public function index()
    {
        $users = User::with(['permissions', 'role'])
            ->orderBy('id')
            ->get()
            ->map(fn (User $user) => $this->formatUserAuthorizations($user));

        return response()->json(['data' => $users]);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'permissions' => 'nullable|array',
            'permissions.*' => 'string',
        ]);

        $slugs = collect($validated['permissions'] ?? [])
            ->filter()
            ->unique()
            ->values();

        $allowed = AuthorizationMenu::allPermissionSlugs();
        $invalid = $slugs->diff($allowed);
        if ($invalid->isNotEmpty()) {
            return response()->json(['message' => 'Autorisation invalide.'], 422);
        }

        $permissionIds = Permission::whereIn('slug', $slugs)->pluck('id');
        $user->permissions()->sync($permissionIds);

        return response()->json([
            'message' => 'Autorisations enregistrées.',
            'data' => $this->formatUserAuthorizations($user->fresh(['permissions', 'role'])),
        ]);
    }

    private function formatUserAuthorizations(User $user): array
    {
        $direct = $user->permissions->pluck('slug')->values()->all();
        $role = $user->role?->permissions()->pluck('slug')->all() ?? [];

        return [
            'id' => $user->id,
            'name' => $user->name,
            'statut' => $user->statut,
            'statut_label' => UserApiController::STATUTS[$user->statut] ?? $user->statut,
            'is_active' => (bool) $user->is_active,
            'permissions' => $direct,
            'role_permissions' => $role,
            'effective_permissions' => collect($direct)->merge($role)->unique()->values()->all(),
        ];
    }
}
