<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientRelance;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;

class ClientRelanceApiController extends Controller
{
    public function index(Request $request)
    {
        $search = mb_strtolower(trim((string) $request->input('search', '')));
        $etat = (string) $request->input('etat', '');
        $from = (string) $request->input('date_from', '');
        $to = (string) $request->input('date_to', '');
        $clientName = mb_strtolower(trim((string) $request->input('client', '')));
        $today = now()->toDateString();

        $soldes = $this->soldesParClient();

        $rows = ClientRelance::with(['client:id,name,phone,city', 'user:id,name'])
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('client_name', 'like', "%{$search}%")
                ->orWhere('remarque', 'like', "%{$search}%")))
            ->when($clientName !== '', fn ($q) => $q->whereRaw('LOWER(TRIM(client_name)) = ?', [$clientName]))
            ->when(preg_match('/^\d{4}-\d{2}-\d{2}$/', $from), fn ($q) => $q->whereDate('date_appel', '>=', $from))
            ->when(preg_match('/^\d{4}-\d{2}-\d{2}$/', $to), fn ($q) => $q->whereDate('date_appel', '<=', $to))
            ->get()
            ->map(fn (ClientRelance $r) => $this->formatRelance($r, $soldes, $today))
            ->when($etat !== '', fn ($c) => $c->where('etat', $etat)->values())
            ->sort(function (array $a, array $b) {
                if ($a['etat_ordre'] !== $b['etat_ordre']) {
                    return $a['etat_ordre'] <=> $b['etat_ordre'];
                }
                $byRappel = strcmp($a['date_rappel_raw'] ?? '9999-12-31', $b['date_rappel_raw'] ?? '9999-12-31');
                if ($byRappel !== 0) {
                    return $byRappel;
                }

                return $b['date_appel_ts'] <=> $a['date_appel_ts'];
            })
            ->values();

        $all = ClientRelance::query()->get(['date_rappel']);
        $meta = [
            'total' => $all->count(),
            'en_retard' => $all->filter(fn ($r) => $r->date_rappel && $r->date_rappel->toDateString() < $today)->count(),
            'aujourd_hui' => $all->filter(fn ($r) => $r->date_rappel && $r->date_rappel->toDateString() === $today)->count(),
            'a_venir' => $all->filter(fn ($r) => $r->date_rappel && $r->date_rappel->toDateString() > $today)->count(),
            'sans_rappel' => $all->filter(fn ($r) => ! $r->date_rappel)->count(),
        ];

        return response()->json(['data' => $rows, 'meta' => $meta]);
    }

    public function meta()
    {
        // Listes importées de la Fiche Client uniquement.
        $soldes = $this->soldesParClient();

        $clients = Client::query()
            ->orderBy('name')
            ->get(['id', 'name', 'phone', 'city'])
            ->map(fn (Client $client) => [
                'client_id' => $client->id,
                'name' => trim($client->name),
                'phone' => $client->phone,
                'city' => $client->city,
                'solde' => $soldes[self::normalizeName($client->name)] ?? null,
            ])
            ->values();

        return response()->json(['data' => $clients]);
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);
        $validated['user_id'] = $request->user()->id;
        $validated['client_id'] = $this->resolveClientId($validated);

        $relance = ClientRelance::create($validated);

        return response()->json($this->formatRelance(
            $relance->load(['client:id,name,phone,city', 'user:id,name']),
            $this->soldesParClient(),
            now()->toDateString(),
        ), 201);
    }

    public function update(Request $request, ClientRelance $clientRelance)
    {
        $validated = $this->validated($request);
        $validated['client_id'] = $this->resolveClientId($validated);
        $clientRelance->update($validated);

        return response()->json($this->formatRelance(
            $clientRelance->fresh(['client:id,name,phone,city', 'user:id,name']),
            $this->soldesParClient(),
            now()->toDateString(),
        ));
    }

    public function destroy(ClientRelance $clientRelance)
    {
        $clientRelance->delete();

        return response()->json(['message' => 'Relance supprimée']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'client_id' => 'nullable|integer|exists:clients,id',
            'client_name' => 'required|string|max:255',
            'date_appel' => 'required|date',
            'remarque' => 'nullable|string|max:2000',
            'date_rappel' => 'nullable|date',
        ]);
    }

    private function resolveClientId(array $validated): ?int
    {
        if (! empty($validated['client_id'])) {
            return (int) $validated['client_id'];
        }

        $key = self::normalizeName($validated['client_name'] ?? '');

        return Client::query()
            ->get(['id', 'name'])
            ->first(fn ($c) => self::normalizeName($c->name) === $key)
            ?->id;
    }

    /**
     * Soldes "Balance Fournisseur" détaillée par client livré :
     * même calcul que /purchase-orders/balance-clients, agrégé tous fournisseurs.
     *
     * @return array<string, float> clé = nom normalisé, valeur = solde
     */
    private function soldesParClient(): array
    {
        $orders = PurchaseOrder::query()
            ->with('paymentAllocations')
            ->where('status', '!=', 'annule')
            ->whereNotNull('client_livre')
            ->where('client_livre', '!=', '')
            ->get();

        $grouped = [];
        foreach ($orders as $order) {
            $key = self::normalizeName((string) $order->client_livre);
            if ($key === '') {
                continue;
            }

            $grouped[$key] ??= ['montant' => 0.0, 'montant_paye' => 0.0];

            $allocations = $order->paymentAllocations;
            $paid = $allocations->isNotEmpty()
                ? round((float) $allocations->sum('amount'), 2)
                : round((float) ($order->montant_paye ?? 0), 2);

            $grouped[$key]['montant'] += (float) $order->total_ttc;
            $grouped[$key]['montant_paye'] += $paid;
        }

        $soldes = [];
        foreach ($grouped as $key => $item) {
            $soldes[$key] = round(max(round($item['montant'], 2) - round($item['montant_paye'], 2), 0), 2);
        }

        return $soldes;
    }

    private function formatRelance(ClientRelance $r, array $soldes, string $today): array
    {
        $key = self::normalizeName($r->client_name);
        $rappel = $r->date_rappel?->toDateString();

        [$etat, $ordre] = match (true) {
            $rappel === null => ['sans_rappel', 3],
            $rappel < $today => ['en_retard', 0],
            $rappel === $today => ['aujourd_hui', 1],
            default => ['a_venir', 2],
        };

        return [
            'id' => $r->id,
            'client_id' => $r->client_id,
            'client_name' => $r->client_name,
            'phone' => $r->client?->phone,
            'city' => $r->client?->city,
            'date_appel' => $r->date_appel?->format('d/m/Y'),
            'date_appel_raw' => $r->date_appel?->toDateString(),
            'date_appel_ts' => $r->date_appel?->timestamp ?? 0,
            'remarque' => $r->remarque,
            'date_rappel' => $rappel ? \Carbon\Carbon::parse($rappel)->format('d/m/Y') : null,
            'date_rappel_raw' => $rappel,
            'solde' => $soldes[$key] ?? null,
            'etat' => $etat,
            'etat_ordre' => $ordre,
            'appele_par' => $r->user?->name,
        ];
    }

    private static function normalizeName(string $name): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $name)));
    }
}
