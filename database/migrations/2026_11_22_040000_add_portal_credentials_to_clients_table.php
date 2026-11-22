<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('portal_login')->nullable()->unique()->after('phone');
            $table->string('portal_password')->nullable()->after('portal_login');
            $table->boolean('portal_enabled')->default(false)->after('portal_password');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['portal_login', 'portal_password', 'portal_enabled']);
        });
    }
};
