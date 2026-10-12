<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Permission::firstOrCreate(
            ['slug' => 'nav.fournisseurs.etat-reliquat'],
            ['name' => 'fournisseurs — etat-reliquat', 'module' => 'fournisseurs']
        );
    }

    public function down(): void
    {
        Permission::where('slug', 'nav.fournisseurs.etat-reliquat')->delete();
    }
};
