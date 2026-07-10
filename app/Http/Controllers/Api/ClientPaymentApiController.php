<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientOrder;
use App\Models\ClientPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientPaymentApiController extends Controller
{
    public function index(Request $request)
    {
        $payments = ClientPayment::with(['allocations.clientOrder.quote'])
            ->when($request->client_name, fn ($q, $n) => $q->where('client_name', 'like', "%{$n}%"))
            ->latest('payment_date')
            ->get()
            ->map(fn ($p) => $this->formatPayment($p->loadMissing('allocations.clientOrder')));

        return response()->json(['data' => $payments]);
    }

    public function show(ClientPayment $clientPayment)
    {
        return response()->json($this->formatPayment($clientPayment->load(['allocations.clientOrder'])));
    }

    public function update(Request $request, ClientPayment $clientPayment)
    {
        $validated = $request->validate([
            'payment_date' => 'sometimes|date',
            'reglement' => 'nullable|in:Esp,Chq,Eff,Vir,Vers',
            'numero' => 'nullable|string|max:50',
            'banque' => 'nullable|string|max:100',
            'nom_tire' => 'nullable|string|max:150',
        ]);

        $clientPayment->update($validated);

        return response()->json([
            'message' => 'Paiement mis à jour',
            'data' => $this->formatPayment($clientPayment->fresh(['allocations.clientOrder'])),
        ]);
    }

    public function destroy(ClientPayment $clientPayment)
    {
        DB::transaction(function () use ($clientPayment) {
            $clientPayment->load('allocations.clientOrder');

            foreach ($clientPayment->allocations as $allocation) {
                $order = $allocation->clientOrder;
                if ($order) {
                    $order->update([
                        'montant_paye' => round(max((float) ($order->montant_paye ?? 0) - (float) $allocation->amount, 0), 2),
                    ]);
                }
                $allocation->delete();
            }

            $clientPayment->delete();
        });

        return response()->json(['message' => 'Paiement supprimé']);
    }

    public function meta()
    {
        return response()->json([
            'next_ref' => $this->nextReference(),
            'date' => now()->format('d/m/Y'),
            'date_raw' => now()->format('Y-m-d'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'payment_date' => 'required|date',
            'client_id' => 'nullable|exists:clients,id',
            'client_name' => 'nullable|string|max:200',
            'ville_chantier' => 'nullable|string|max:100',
            'chantier_type' => 'nullable|in:Public,Privé',
            'montant_total' => 'nullable|numeric|min:0',
            'reglement' => 'nullable|in:Esp,Chq,Eff,Vir,Vers',
            'numero' => 'nullable|string|max:50',
            'banque' => 'nullable|string|max:100',
            'nom_tire' => 'nullable|string|max:150',
            'montant' => 'required|numeric|min:0.01',
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'exists:client_orders,id',
        ]);

        $payment = DB::transaction(function () use ($validated, $request) {
            $orders = ClientOrder::whereIn('id', $validated['order_ids'])
                ->orderBy('order_date')
                ->lockForUpdate()
                ->get();

            $paymentAmount = round((float) $validated['montant'], 2);
            $montantTotal = round(
                (float) ($validated['montant_total'] ?? $orders->sum(fn ($o) => (float) $o->total_ttc)),
                2
            );

            $remaining = $paymentAmount;
            $allocations = [];
            $orderList = $orders->values();
            $lastIndex = $orderList->count() - 1;

            foreach ($orderList as $index => $order) {
                if ($remaining <= 0) {
                    break;
                }

                $isLast = $index === $lastIndex;
                $due = round(max((float) $order->total_ttc - (float) ($order->montant_paye ?? 0), 0), 2);

                if ($isLast) {
                    $applied = round($remaining, 2);
                } elseif ($due <= 0) {
                    continue;
                } else {
                    $applied = round(min($due, $remaining), 2);
                }

                if ($applied <= 0) {
                    continue;
                }

                $allocations[] = ['order' => $order, 'amount' => $applied];
                $remaining = round($remaining - $applied, 2);
            }

            if (empty($allocations)) {
                abort(422, 'Aucun montant à régler sur les lignes sélectionnées');
            }

            $payment = ClientPayment::create([
                'reference' => 'EP-PENDING',
                'payment_date' => $validated['payment_date'],
                'client_id' => $validated['client_id'] ?? $orders->first()?->client_id,
                'client_name' => $validated['client_name'] ?? $orders->first()?->client?->name,
                'ville_chantier' => $validated['ville_chantier'] ?? $orders->first()?->city,
                'chantier_type' => $validated['chantier_type'] ?? $orders->first()?->chantier_type,
                'montant_total' => $montantTotal,
                'reglement' => $validated['reglement'] ?? null,
                'numero' => $validated['numero'] ?? null,
                'banque' => $validated['banque'] ?? null,
                'nom_tire' => $validated['nom_tire'] ?? null,
                'montant' => $paymentAmount,
                'solde' => round($paymentAmount - $montantTotal, 2),
                'user_id' => $request->user()->id,
            ]);

            $payment->update(['reference' => $this->referenceFor($payment->id)]);

            foreach ($allocations as $row) {
                $payment->allocations()->create([
                    'client_order_id' => $row['order']->id,
                    'amount' => $row['amount'],
                ]);

                $row['order']->update([
                    'montant_paye' => round((float) ($row['order']->montant_paye ?? 0) + $row['amount'], 2),
                ]);
            }

            return $payment->fresh(['allocations']);
        });

        return response()->json([
            'message' => 'Paiement enregistré',
            'data' => $this->formatPayment($payment),
        ], 201);
    }

    private function formatPayment(ClientPayment $payment): array
    {
        $payment->loadMissing('allocations.clientOrder.quote');

        $allocations = $payment->allocations->map(fn ($allocation) => [
            'id' => $allocation->id,
            'client_order_id' => $allocation->client_order_id,
            'order_reference' => $allocation->clientOrder?->reference,
            'quote_reference' => $allocation->clientOrder?->quote?->reference,
            'amount' => round((float) $allocation->amount, 2),
        ])->values()->all();

        return [
            'id' => $payment->id,
            'reference' => $payment->reference,
            'payment_date' => $payment->payment_date?->format('d/m/Y'),
            'payment_date_raw' => $payment->payment_date?->format('Y-m-d'),
            'client_id' => $payment->client_id,
            'client_name' => $payment->client_name,
            'ville_chantier' => $payment->ville_chantier,
            'chantier_type' => $payment->chantier_type,
            'montant_total' => round((float) $payment->montant_total, 2),
            'reglement' => $payment->reglement,
            'numero' => $payment->numero,
            'banque' => $payment->banque,
            'nom_tire' => $payment->nom_tire,
            'montant' => round((float) $payment->montant, 2),
            'solde' => round((float) $payment->montant - (float) $payment->montant_total, 2),
            'allocations' => $allocations,
        ];
    }

    private function nextReference(): string
    {
        return $this->referenceFor((ClientPayment::max('id') ?? 0) + 1);
    }

    private function referenceFor(int $id): string
    {
        return 'EP-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }
}
