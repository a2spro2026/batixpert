<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientOrder;
use Illuminate\Http\Request;

class ClientOrderApiController extends Controller
{
    public function index(Request $request)
    {
        $query = ClientOrder::with(['client', 'quote', 'items', 'paymentAllocations.payment'])
            ->when($request->date_from, fn ($q, $d) => $q->whereDate('order_date', '>=', $d))
            ->when($request->date_to, fn ($q, $d) => $q->whereDate('order_date', '<=', $d))
            ->when($request->client_name, fn ($q, $n) => $q->whereHas('client', fn ($c) => $c->where('name', 'like', "%{$n}%")))
            ->when($request->city, fn ($q, $c) => $q->where('city', 'like', "%{$c}%"))
            ->when($request->boolean('unpaid'), function ($q) {
                $q->whereRaw('COALESCE(montant_paye, 0) < total_ttc');
            })
            ->latest('order_date');

        if ($request->boolean('all')) {
            return response()->json([
                'data' => $query->get()->map(fn ($o) => $this->formatOrder($o)),
            ]);
        }

        return response()->json($query->paginate(15)->through(fn ($o) => $this->formatOrder($o)));
    }

    public function show(ClientOrder $clientOrder)
    {
        return response()->json($this->formatOrder($clientOrder->load(['client', 'quote', 'items'])));
    }

    private function formatOrder(ClientOrder $order): array
    {
        $order->loadMissing('client', 'quote', 'items', 'paymentAllocations.payment');

        $items = $order->items->map(fn ($item) => [
            'id' => $item->id,
            'type_travaux' => $item->type_travaux,
            'designation' => $item->description,
            'consistance' => $item->consistance,
            'unit' => $item->unit,
            'quantity' => (float) $item->quantity,
            'unit_price' => round((float) $item->unit_price, 2),
            'subtotal' => round((float) $item->total, 2),
        ])->values()->all();

        if (count($items) === 0 && $order->designation) {
            $items = [[
                'id' => null,
                'type_travaux' => $order->type_travaux,
                'designation' => $order->designation,
                'consistance' => $order->consistance,
                'unit' => $order->unit,
                'quantity' => (float) $order->quantity,
                'unit_price' => round((float) $order->unit_price, 2),
                'subtotal' => round((float) $order->subtotal, 2),
            ]];
        }

        $ht = round((float) $order->subtotal, 2);
        $tva = round((float) $order->tva, 2);
        $totalTtc = round((float) $order->total_ttc, 2);
        $montantPaye = round((float) ($order->montant_paye ?? 0), 2);
        $solde = round($montantPaye - $totalTtc, 2);
        $reliquat = round(max($montantPaye - $totalTtc, 0), 2);
        $resteAPayer = round(max($totalTtc - $montantPaye, 0), 2);

        $payments = $order->paymentAllocations
            ->sortBy(fn ($a) => $a->payment?->payment_date)
            ->values()
            ->map(fn ($allocation) => [
                'id' => $allocation->id,
                'payment_id' => $allocation->client_payment_id,
                'reference' => $allocation->payment?->reference,
                'payment_date' => $allocation->payment?->payment_date?->format('d/m/Y'),
                'reglement' => $allocation->payment?->reglement,
                'numero' => $allocation->payment?->numero,
                'banque' => $allocation->payment?->banque,
                'nom_tire' => $allocation->payment?->nom_tire,
                'amount' => round((float) $allocation->amount, 2),
            ])
            ->all();

        return [
            'id' => $order->id,
            'reference' => $order->reference,
            'order_date' => $order->order_date?->format('d/m/Y'),
            'order_date_raw' => $order->order_date?->format('Y-m-d'),
            'quote_id' => $order->quote_id,
            'quote_reference' => $order->quote?->reference,
            'client_id' => $order->client_id,
            'client_name' => $order->client?->name,
            'contact' => $order->contact,
            'city' => $order->city,
            'chantier_type' => $order->chantier_type,
            'budget' => round((float) $order->budget, 2),
            'work_delay' => $order->work_delay,
            'type_travaux' => $this->typeTravauxSummary($items, $order->type_travaux),
            'reglement' => $order->client?->reglement,
            'subtotal' => $ht,
            'total_ht' => $ht,
            'tva' => $tva,
            'total_ttc' => $totalTtc,
            'montant' => $totalTtc,
            'montant_paye' => $montantPaye,
            'avance' => $montantPaye,
            'solde' => $solde,
            'reliquat' => $reliquat,
            'reste_a_payer' => $resteAPayer,
            'payments' => $payments,
            'payments_count' => count($payments),
            'items' => $items,
            'items_count' => count($items),
            'status' => $order->status,
            'statut' => $this->statusLabel($order->status),
        ];
    }

    private function typeTravauxSummary(array $items, ?string $fallback): ?string
    {
        $types = collect($items)
            ->pluck('type_travaux')
            ->filter(fn ($v) => filled($v))
            ->unique()
            ->values();

        if ($types->isEmpty()) {
            return $fallback ?: null;
        }

        if ($types->count() === 1) {
            return $types->first();
        }

        return $types->first().' (+'.($types->count() - 1).')';
    }

    private function statusLabel(?string $status): string
    {
        return match ($status) {
            'en_cours' => 'En Cours',
            'livre' => 'Livré',
            'annule' => 'Annulé',
            default => 'En Attente',
        };
    }
}
