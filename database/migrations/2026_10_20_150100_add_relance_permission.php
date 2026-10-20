<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Permission::firstOrCreate(
            ['slug' => 'nav.clients.relance'],
            ['name' => 'clients — relance', 'module' => 'clients']
        );
    }

    public function down(): void
    {
        Permission::where('slug', 'nav.clients.relance')->delete();
    }
};
