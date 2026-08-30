<?php

use App\Models\Permission;
use App\Support\AuthorizationMenu;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permission_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['user_id', 'permission_id']);
        });

        foreach (AuthorizationMenu::allPermissionSlugs() as $slug) {
            $module = explode('.', str_replace('nav.', '', $slug))[0] ?? 'navigation';
            Permission::firstOrCreate(
                ['slug' => $slug],
                ['name' => str_replace(['nav.', '.'], ['', ' — '], $slug), 'module' => $module]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_user');
    }
};
