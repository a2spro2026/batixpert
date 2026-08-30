<?php

namespace App\Support;

class PaymentSettlement
{
    public const NON_SETTLING_STATUTS = ['Imp', 'Dévalidé', 'Report'];

    public const NON_SETTLING_ACTIONS = ['Imp', 'Dévalidé', 'Report'];

    public static function paymentStatutCountsAsPaid(?string $statut): bool
    {
        return ! in_array($statut ?: 'Inst', self::NON_SETTLING_STATUTS, true);
    }

    public static function allocationActionCountsAsPaid(?string $action): bool
    {
        return ! in_array($action ?: 'Payé', self::NON_SETTLING_ACTIONS, true);
    }

    public static function effectiveCreditAmount(float $amount, ?string $paymentStatut, ?string $allocationAction = null): float
    {
        $amount = round($amount, 2);
        if ($amount <= 0) {
            return 0.0;
        }

        if (! self::paymentStatutCountsAsPaid($paymentStatut)) {
            return 0.0;
        }

        if ($allocationAction !== null && ! self::allocationActionCountsAsPaid($allocationAction)) {
            return 0.0;
        }

        return $amount;
    }
}
