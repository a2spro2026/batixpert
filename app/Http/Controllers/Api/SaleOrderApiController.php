<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaleOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleOrderApiController extends Controller
{
    public function index(Request $request)
    {
        $query = SaleOrder::with(['client', 'items'])
            ->when($request->search, fn ($q, $s) => $q->where('reference', 'like', "%{$s}%")
                ->orWhere('designation', 'like', "%{$s}%"))
            ->latest('order_date');

        if ($request->boolean('all')) {
            $orders = $query->get()->map(fn ($o) => $this->formatOrder($o));

            return response()->json([
                'data' => $orders,
                'meta' => [
                    'next_ref' => $this->nextReference(),
                    'date' => now()->format('d/m/Y'),
                ],
            ]);
        }

        return response()->json($query->paginate(15)->through(fn ($o) => $this->formatOrder($o)));
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);
        $items = $this->normalizeItems($validated);

        $order = DB::transaction(function () use ($validated, $items, $request) {
            $subtotal = collect($items)->sum('total');
            $first = $items[0] ?? null;

            $order = SaleOrder::create([
                'client_id' => $validated['client_id'],
                'order_date' => $validated['order_date'],
                'bc_number' => $validated['bc_number'] ?? null,
                'reglement' => $validated['reglement'] ?? null,
                'echeance' => $validated['echeance'] ?? null,
                'city' => $validated['city'] ?? null,
                'address' => $validated['address'] ?? null,
                'chauffeur' => $validated['chauffeur'] ?? null,
                'matricule' => $validated['matricule'] ?? null,
                'designation' => $first['description'] ?? null,
                'article_ref' => $first['article_ref'] ?? null,
                'unit' => $first['unit'] ?? null,
                'unit_price' => $first['unit_price'] ?? 0,
                'quantity' => $first['quantity'] ?? 1,
                'reference' => 'BV-PENDING',
                'subtotal' => $subtotal,
                'total_ht' => $subtotal,
                'tva' => 0,
                'total_ttc' => $subtotal,
                'status' => $validated['status'] ?? 'valide',
                'user_id' => $request->user()->id,
            ]);

            $order->update(['reference' => $this->nextReference()]);
            $this->syncItems($order, $items);

            return $order->fresh(['client', 'items']);
        });

        return response()->json($this->formatOrder($order), 201);
    }

    public function show(SaleOrder $sales_order)
    {
        return response()->json($this->formatOrder($sales_order->load(['client', 'items'])));
    }

    public function update(Request $request, SaleOrder $sales_order)
    {
        $validated = $this->validated($request, true);
        $items = $this->normalizeItems($validated);
        $subtotal = collect($items)->sum('total');
        $first = $items[0] ?? null;

        DB::transaction(function () use ($sales_order, $validated, $items, $subtotal, $first) {
            $sales_order->update([
                'client_id' => $validated['client_id'] ?? $sales_order->client_id,
                'order_date' => $validated['order_date'] ?? $sales_order->order_date,
                'bc_number' => array_key_exists('bc_number', $validated) ? $validated['bc_number'] : $sales_order->bc_number,
                'reglement' => array_key_exists('reglement', $validated) ? $validated['reglement'] : $sales_order->reglement,
                'echeance' => array_key_exists('echeance', $validated) ? $validated['echeance'] : $sales_order->echeance,
                'city' => array_key_exists('city', $validated) ? $validated['city'] : $sales_order->city,
                'address' => array_key_exists('address', $validated) ? $validated['address'] : $sales_order->address,
                'chauffeur' => array_key_exists('chauffeur', $validated) ? $validated['chauffeur'] : $sales_order->chauffeur,
                'matricule' => array_key_exists('matricule', $validated) ? $validated['matricule'] : $sales_order->matricule,
                'designation' => $first['description'] ?? $sales_order->designation,
                'article_ref' => $first['article_ref'] ?? $sales_order->article_ref,
                'unit' => $first['unit'] ?? $sales_order->unit,
                'unit_price' => $first['unit_price'] ?? $sales_order->unit_price,
                'quantity' => $first['quantity'] ?? $sales_order->quantity,
                'subtotal' => $subtotal,
                'total_ht' => $subtotal,
                'tva' => 0,
                'total_ttc' => $subtotal,
                'status' => $validated['status'] ?? $sales_order->status,
            ]);

            $this->syncItems($sales_order, $items);
        });

        return response()->json($this->formatOrder($sales_order->fresh(['client', 'items'])));
    }

    public function validateOrder(SaleOrder $sales_order)
    {
        $sales_order->update(['status' => 'valide']);

        return response()->json($this->formatOrder($sales_order));
    }

    public function destroy(SaleOrder $sales_order)
    {
        $sales_order->delete();

        return response()->json(['message' => 'Bon de vente supprimé']);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $rules = [
            'client_id' => ($partial ? 'sometimes' : 'required').'|exists:clients,id',
            'order_date' => ($partial ? 'sometimes' : 'required').'|date',
            'bc_number' => 'nullable|string|max:50',
            'reglement' => 'nullable|in:Esp,Chq,Eff,Vir,Vers',
            'echeance' => 'nullable|string|max:20',
            'city' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'chauffeur' => 'nullable|string|max:255',
            'matricule' => 'nullable|string|max:50',
            'status' => 'nullable|in:en_attente,valide,annule,livre',
            'items' => ($partial ? 'sometimes' : 'required').'|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.article_ref' => 'nullable|string|max:100',
            'items.*.description' => 'required|string|max:255',
            'items.*.unit' => 'nullable|string|max:20',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.unit_price' => 'required|numeric|min:0',
            'designation' => 'nullable|string|max:255',
            'article_ref' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:20',
            'unit_price' => 'nullable|numeric|min:0',
            'quantity' => 'nullable|numeric|min:0.001',
            'subtotal' => 'nullable|numeric|min:0',
        ];

        return $request->validate($rules);
    }

    private function normalizeItems(array $validated): array
    {
        if (! empty($validated['items']) && is_array($validated['items'])) {
            return collect($validated['items'])->map(function ($item) {
                $qty = (float) ($item['quantity'] ?? 1);
                $price = (float) ($item['unit_price'] ?? 0);

                return [
                    'product_id' => $item['product_id'] ?? null,
                    'article_ref' => $item['article_ref'] ?? null,
                    'description' => $item['description'] ?? 'Article',
                    'unit' => $item['unit'] ?? null,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'total' => round($qty * $price, 2),
                ];
            })->values()->all();
        }

        $qty = (float) ($validated['quantity'] ?? 1);
        $price = (float) ($validated['unit_price'] ?? 0);

        return [[
            'product_id' => null,
            'article_ref' => $validated['article_ref'] ?? null,
            'description' => $validated['designation'] ?? 'Bon de vente',
            'unit' => $validated['unit'] ?? null,
            'quantity' => $qty,
            'unit_price' => $price,
            'total' => round($qty * $price, 2),
        ]];
    }

    private function syncItems(SaleOrder $order, array $items): void
    {
        $order->items()->delete();
        foreach ($items as $item) {
            $order->items()->create([
                'product_id' => $item['product_id'],
                'article_ref' => $item['article_ref'],
                'description' => $item['description'],
                'unit' => $item['unit'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'tva_rate' => 0,
                'total' => $item['total'],
            ]);
        }
    }

    private function nextReference(): string
    {
        $prefix = 'B-V'.now()->format('y').'/';
        $last = SaleOrder::where('reference', 'like', $prefix.'%')
            ->pluck('reference')
            ->map(fn ($reference) => (int) substr($reference, strrpos($reference, '/') + 1))
            ->max() ?? 0;

        return $this->referenceFor($last + 1);
    }

    private function referenceFor(int $id): string
    {
        return 'B-V'.now()->format('y').'/'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }

    private function formatOrder(SaleOrder $order): array
    {
        $order->loadMissing(['client', 'items']);

        return [
            'id' => $order->id,
            'reference' => $order->reference,
            'bc_number' => $order->bc_number,
            'order_date' => $order->order_date?->format('d/m/Y'),
            'order_date_raw' => $order->order_date?->format('Y-m-d'),
            'client_id' => $order->client_id,
            'client' => $order->client?->name,
            'designation' => $order->designation,
            'article_ref' => $order->article_ref,
            'unit' => $order->unit,
            'unit_price' => number_format((float) $order->unit_price, 2, '.', ''),
            'quantity' => (float) $order->quantity,
            'subtotal' => number_format((float) $order->subtotal, 2, '.', ''),
            'montant' => number_format((float) $order->total_ttc, 2, '.', ''),
            'reglement' => $order->reglement,
            'echeance' => $order->echeance,
            'city' => $order->city,
            'address' => $order->address,
            'chauffeur' => $order->chauffeur,
            'matricule' => $order->matricule,
            'status' => $order->status,
            'items' => $order->items->map(fn ($i) => [
                'id' => $i->id,
                'product_id' => $i->product_id,
                'article_ref' => $i->article_ref,
                'description' => $i->description,
                'unit' => $i->unit,
                'quantity' => (float) $i->quantity,
                'unit_price' => number_format((float) $i->unit_price, 2, '.', ''),
                'total' => number_format((float) $i->total, 2, '.', ''),
            ])->values()->all(),
        ];
    }
}
