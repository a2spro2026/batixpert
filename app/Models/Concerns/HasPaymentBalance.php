<?php

namespace App\Models\Concerns;

use App\Support\PaymentSettlement;

trait HasPaymentBalance
{
    public function effectiveMontantPaye(): float
    {
        $this->loadMissing(['paymentAllocations.payment']);

        return round((float) $this->paymentAllocations
            ->filter(fn ($allocation) => $this->allocationCountsAsPaid($allocation))
            ->sum('amount'), 2);
    }

    public function computeSolde(): float
    {
        $montantBon = round((float) $this->total_ttc, 2);

        return round(max($montantBon - $this->effectiveMontantPaye(), 0), 2);
    }

    protected function allocationCountsAsPaid($allocation): bool
    {
        $amount = round((float) ($allocation->amount ?? 0), 2);
        if ($amount <= 0) {
            return false;
        }

        return PaymentSettlement::effectiveCreditAmount(
            $amount,
            $allocation->payment?->statut,
            $allocation->action,
        ) > 0;
    }
}
