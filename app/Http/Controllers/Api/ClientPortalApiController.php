<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\SaleOrder;
use Illuminate\Http\Request;

class ClientPortalApiController extends Controller
{
    public function orders(Request $request)
    {
        /** @var Client $client */
        $client = $request->user();

        $orders = SaleOrder::with(['client', 'items', 'paymentAllocations.payment'])
            ->where('client_id', $client->id)
            ->where('status', '!=', 'annule')
            ->latest('order_date')
            ->latest('id')
            ->get()
            ->map(fn (SaleOrder $o) => $this->formatOrder($o));

        return response()->json([
            'data' => $orders,
            'meta' => [
                'count' => $orders->count(),
                'total_montant' => round($orders->sum(fn ($o) => (float) $o['montant']), 2),
                'total_solde' => round($orders->sum(fn ($o) => (float) $o['solde']), 2),
            ],
        ]);
    }

    public function showOrder(Request $request, SaleOrder $sales_order)
    {
        $this->assertOwnsOrder($request, $sales_order);

        return response()->json($this->formatOrder(
            $sales_order->load(['client', 'items', 'paymentAllocations.payment'])
        ));
    }

    public function payments(Request $request)
    {
        /** @var Client $client */
        $client = $request->user();
        $filter = (string) $request->input('solde', ''); // soldes | non_soldes | ''

        $payments = ClientPayment::with(['client', 'allocations.saleOrder'])
            ->where('client_id', $client->id)
            ->latest('payment_date')
            ->latest('id')
            ->get()
            ->map(fn (ClientPayment $p) => $this->formatPayment($p));

        if ($filter === 'soldes') {
            $payments = $payments->filter(fn ($p) => $this->isSolded($p['statut']))->values();
        } elseif ($filter === 'non_soldes') {
            $payments = $payments->filter(fn ($p) => ! $this->isSolded($p['statut']))->values();
        }

        $all = ClientPayment::where('client_id', $client->id)->get(['statut', 'montant']);
        $soldesCount = $all->filter(fn ($p) => $this->isSolded($p->statut))->count();

        return response()->json([
            'data' => $payments->values()->all(),
            'meta' => [
                'count' => $payments->count(),
                'soldes' => $soldesCount,
                'non_soldes' => $all->count() - $soldesCount,
                'total_montant' => round($payments->sum(fn ($p) => (float) $p['montant']), 2),
            ],
        ]);
    }

    public function showPayment(Request $request, ClientPayment $client_payment)
    {
        $this->assertOwnsPayment($request, $client_payment);

        return response()->json($this->formatPayment(
            $client_payment->load(['client', 'allocations.saleOrder'])
        ));
    }

    private function assertOwnsOrder(Request $request, SaleOrder $order): void
    {
        if ((int) $order->client_id !== (int) $request->user()->id || $order->status === 'annule') {
            abort(404);
        }
    }

    private function assertOwnsPayment(Request $request, ClientPayment $payment): void
    {
        if ((int) $payment->client_id !== (int) $request->user()->id) {
            abort(404);
        }
    }

    private function isSolded(?string $statut): bool
    {
        return mb_strtolower(trim((string) $statut)) === 'payé'
            || mb_strtolower(trim((string) $statut)) === 'paye';
    }

    private function formatOrder(SaleOrder $order): array
    {
        $order->loadMissing(['client', 'items', 'paymentAllocations.payment']);
        $montantPaye = $order->effectiveMontantPaye();
        $solde = $order->computeSolde();

        return [
            'id' => $order->id,
            'reference' => $order->reference,
            'order_date' => $order->order_date?->format('d/m/Y'),
            'client' => $order->client?->name,
            'city' => $order->city,
            'address' => $order->address,
            'reglement' => $order->reglement,
            'echeance' => $order->echeance,
            'chauffeur' => $order->chauffeur,
            'matricule' => $order->matricule,
            'designation' => $order->designation,
            'article_ref' => $order->article_ref,
            'unit' => $order->unit,
            'quantity' => (float) $order->quantity,
            'unit_price' => number_format((float) $order->unit_price, 2, '.', ''),
            'subtotal' => number_format((float) $order->subtotal, 2, '.', ''),
            'montant' => number_format((float) $order->total_ttc, 2, '.', ''),
            'montant_paye' => number_format($montantPaye, 2, '.', ''),
            'solde' => number_format($solde, 2, '.', ''),
            'status' => $order->status,
            'items' => $order->items->map(fn ($i) => [
                'article_ref' => $i->article_ref,
                'description' => $i->description,
                'unit' => $i->unit,
                'quantity' => (float) $i->quantity,
                'unit_price' => number_format((float) $i->unit_price, 2, '.', ''),
                'total' => number_format((float) $i->total, 2, '.', ''),
            ])->values()->all(),
        ];
    }

    private function formatPayment(ClientPayment $payment): array
    {
        $payment->loadMissing(['client', 'allocations.saleOrder']);
        $statut = $payment->statut ?: 'Inst';

        return [
            'id' => $payment->id,
            'reference' => $payment->reference,
            'payment_date' => $payment->payment_date?->format('d/m/Y'),
            'client' => $payment->client_name ?: $payment->client?->name,
            'reglement' => $payment->reglement,
            'numero' => $payment->numero,
            'banque' => $payment->banque,
            'nom_tire' => $payment->nom_tire,
            'montant' => number_format((float) $payment->montant, 2, '.', ''),
            'tresorerie' => $payment->tresorerie ? mb_strtoupper((string) $payment->tresorerie) : null,
            'date_decaissement' => $payment->date_decaissement?->format('d/m/Y'),
            'remarque' => $payment->remarque,
            'statut' => $statut,
            'solded' => $this->isSolded($statut),
            'allocations' => $payment->allocations->map(fn ($a) => [
                'bon' => $a->saleOrder?->reference,
                'amount' => number_format((float) $a->amount, 2, '.', ''),
                'action' => $a->action,
            ])->values()->all(),
        ];
    }
}
