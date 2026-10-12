<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\SupplierPayment;
use App\Support\PaymentSettlement;
use Illuminate\Http\Request;

class SupplierReliquatApiController extends Controller
{
    public function index(Request $request)
    {
        $mois = (string) $request->input('mois', '');
        $supplierId = $request->input('supplier_id');
        $client = mb_strtolower(trim((string) $request->input('client', '')));

        $reglementsParBon = $this->reglementsParBon($supplierId);

        $orders = PurchaseOrder::query()
            ->with('supplier')
            ->where('status', '!=', 'annule')
            ->whereIn('id', array_keys($reglementsParBon))
            ->when($supplierId, fn ($q, $id) => $q->where('supplier_id', $id))
            ->when(preg_match('/^\d{4}-\d{2}$/', $mois), function ($q) use ($mois) {
                [$year, $month] = explode('-', $mois);
                $q->whereYear('order_date', $year)->whereMonth('order_date', $month);
            })
            ->orderBy('order_date')
            ->orderBy('id')
            ->get();

        $rows = $orders
            ->filter(fn (PurchaseOrder $o) => $client === ''
                || mb_strtolower(trim((string) $o->client_livre)) === $client)
            ->map(function (PurchaseOrder $o) use ($reglementsParBon) {
                $montantBon = round((float) $o->total_ttc, 2);
                $totalReg = round($reglementsParBon[$o->id] ?? 0, 2);

                return [
                    'id' => $o->id,
                    'date' => $o->order_date?->format('d/m/Y'),
                    'date_raw' => $o->order_date?->format('Y-m-d'),
                    'reference' => $o->reference,
                    'supplier_id' => $o->supplier_id,
                    'fournisseur' => $o->supplier?->name,
                    'client' => $o->client_livre,
                    'montant_bon' => $montantBon,
                    'total_reg' => $totalReg,
                    'reliquat' => round($totalReg - $montantBon, 2),
                ];
            })
            ->filter(fn (array $row) => $row['reliquat'] > 0.009)
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'count' => $rows->count(),
                'total_montant_bon' => round($rows->sum('montant_bon'), 2),
                'total_reg' => round($rows->sum('total_reg'), 2),
                'total_reliquat' => round($rows->sum('reliquat'), 2),
            ],
        ]);
    }

    /**
     * Effective settlement per purchase order, including the part of a payment
     * that exceeds what was allocated (credited to the last bon it settles).
     *
     * @return array<int, float>
     */
    private function reglementsParBon($supplierId): array
    {
        $payments = SupplierPayment::query()
            ->with('allocations')
            ->when($supplierId, fn ($q, $id) => $q->where('supplier_id', $id))
            ->get();

        $totals = [];

        foreach ($payments as $payment) {
            if (! PaymentSettlement::paymentStatutCountsAsPaid($payment->statut)) {
                continue;
            }

            $allocations = $payment->allocations
                ->filter(fn ($a) => PaymentSettlement::effectiveCreditAmount(
                    (float) $a->amount,
                    $payment->statut,
                    $a->action,
                ) > 0)
                ->sortBy('id');

            if ($allocations->isEmpty()) {
                continue;
            }

            foreach ($allocations as $allocation) {
                $totals[$allocation->purchase_order_id] = ($totals[$allocation->purchase_order_id] ?? 0)
                    + round((float) $allocation->amount, 2);
            }

            $surplus = round((float) $payment->montant - (float) $payment->allocations->sum('amount'), 2);
            if ($surplus > 0.009) {
                $lastOrderId = $allocations->last()->purchase_order_id;
                $totals[$lastOrderId] = ($totals[$lastOrderId] ?? 0) + $surplus;
            }
        }

        return $totals;
    }
}
