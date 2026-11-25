<?php

namespace App\Support;

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
}
