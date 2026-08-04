<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (! Schema::hasColumn('suppliers', 'initial_balance_paid')) {
                $table->decimal('initial_balance_paid', 14, 2)->default(0)->after('initial_balance');
            }
        });

        Schema::table('clients', function (Blueprint $table) {
            if (! Schema::hasColumn('clients', 'initial_balance_paid')) {
                $table->decimal('initial_balance_paid', 14, 2)->default(0)->after('budget');
            }
        });

        Schema::table('supplier_payment_allocations', function (Blueprint $table) {
            if (! Schema::hasColumn('supplier_payment_allocations', 'allocation_type')) {
                $table->string('allocation_type', 30)->default('order')->after('supplier_payment_id');
            }
        });

        Schema::table('client_payment_allocations', function (Blueprint $table) {
            if (! Schema::hasColumn('client_payment_allocations', 'allocation_type')) {
                $table->string('allocation_type', 30)->default('order')->after('client_payment_id');
            }
        });

        try {
            DB::statement('ALTER TABLE supplier_payment_allocations MODIFY purchase_order_id BIGINT UNSIGNED NULL');
        } catch (\Throwable $e) {
            // already nullable or non-MySQL
        }

        try {
            DB::statement('ALTER TABLE client_payment_allocations MODIFY sales_order_id BIGINT UNSIGNED NULL');
        } catch (\Throwable $e) {
            // already nullable or non-MySQL
        }
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (Schema::hasColumn('suppliers', 'initial_balance_paid')) {
                $table->dropColumn('initial_balance_paid');
            }
        });

        Schema::table('clients', function (Blueprint $table) {
            if (Schema::hasColumn('clients', 'initial_balance_paid')) {
                $table->dropColumn('initial_balance_paid');
            }
        });

        Schema::table('supplier_payment_allocations', function (Blueprint $table) {
            if (Schema::hasColumn('supplier_payment_allocations', 'allocation_type')) {
                $table->dropColumn('allocation_type');
            }
        });

        Schema::table('client_payment_allocations', function (Blueprint $table) {
            if (Schema::hasColumn('client_payment_allocations', 'allocation_type')) {
                $table->dropColumn('allocation_type');
            }
        });
    }
};
