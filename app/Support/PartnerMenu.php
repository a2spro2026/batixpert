<?php

namespace App\Support;

use App\Models\ClientPayment;

class PartnerMenu
{
    public static function sections(): array
    {
        return [
            ['slug' => 'portal.orders', 'label' => 'Bon de vente'],
            ['slug' => 'portal.payments', 'label' => 'Règlement'],
            ['slug' => 'portal.balance', 'label' => 'Balance'],
            ['slug' => 'portal.releve', 'label' => 'Relevé de compte'],
        ];
    }

    public static function slugs(): array
    {
        return array_column(self::sections(), 'slug');
    }

    /** Libellés cochables : coffres connus, plus toute trésorerie déjà saisie sur un règlement. */
    public static function treasuries(): array
    {
        $labels = ['Caisse', 'Cmpt Pers', 'Cmpt Ste'];
        $seen = [];
        foreach ($labels as $label) {
            $seen[mb_strtoupper($label)] = true;
        }

        $extra = ClientPayment::query()
            ->whereNotNull('tresorerie')
            ->where('tresorerie', '!=', '')
            ->distinct()
            ->orderBy('tresorerie')
            ->pluck('tresorerie');

        foreach ($extra as $name) {
            $label = mb_strtoupper(trim((string) $name));
            if ($label === '' || isset($seen[$label])) {
                continue;
            }
            $seen[$label] = true;
            $labels[] = $label;
        }

        return $labels;
    }
}
