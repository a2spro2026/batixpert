<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_relances', function (Blueprint $table) {
            $table->string('motif', 20)->nullable()->after('remarque');
            $table->text('reponse')->nullable()->after('motif');
        });
    }

    public function down(): void
    {
        Schema::table('client_relances', function (Blueprint $table) {
            $table->dropColumn(['motif', 'reponse']);
        });
    }
};
