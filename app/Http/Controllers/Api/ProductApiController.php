<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ProductApiController extends Controller
{
    private ?array $purchasedCache = null;

    private ?array $soldCache = null;

    public function index(Request $request)
    {
        $query = Product::query()
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('reference', 'like', "%{$s}%")
                    ->orWhere('article_id', 'like', "%{$s}%")
                    ->orWhere('famille', 'like', "%{$s}%");
            }))
            ->orderBy('id');

        if ($request->boolean('all')) {
            $products = $query->get()->map(fn ($p) => $this->formatProduct($p));
            $familles = Product::whereNotNull('famille')
                ->where('famille', '!=', '')
                ->distinct()
                ->orderBy('famille')
                ->pluck('famille')
                ->values();

            return response()->json([
                'data' => $products,
                'meta' => [
                    'next_ref' => $this->nextReference(),
                    'familles' => $familles,
                ],
            ]);
        }

        return response()->json(
            $query->paginate(15)->through(fn ($p) => $this->formatProduct($p))
        );
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);
        $initialStock = (float) ($validated['initial_stock'] ?? 0);
        $reference = trim((string) ($validated['reference'] ?? ''));

        $product = DB::transaction(function () use ($validated, $initialStock, $reference) {
            $product = Product::create([
                ...$validated,
                'reference' => $reference !== '' ? $reference : 'Réf-PENDING',
                'quantity_in_stock' => $initialStock,
                'min_stock_alert' => $validated['min_stock_alert'] ?? 0,
                'etat' => $validated['etat'] ?? 'Rupture',
            ]);

            if ($reference === '') {
                $product->update(['reference' => $this->referenceFor($product->id)]);
            }

            return $product;
        });

        return response()->json($this->formatProduct($product), 201);
    }

    public function show(Product $product)
    {
        return response()->json($this->formatProduct($product));
    }

    public function update(Request $request, Product $product)
    {
        $validated = $this->validated($request, $product->id);

        if (array_key_exists('initial_stock', $validated)) {
            $validated['quantity_in_stock'] = (float) $validated['initial_stock'];
        }

        $product->update($validated);

        return response()->json($this->formatProduct($product->fresh()));
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json(['message' => 'Produit supprimé']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $articleUnique = 'unique:products,article_id';
        $refUnique = 'unique:products,reference';
        if ($ignoreId) {
            $articleUnique .= ','.$ignoreId;
            $refUnique .= ','.$ignoreId;
        }

        return $request->validate([
            'reference' => 'required|string|max:100|'.$refUnique,
            'name' => 'required|string|max:500',
            'article_id' => 'nullable|string|max:50|'.$articleUnique,
            'consistance' => 'nullable|string|max:10',
            'unit' => 'required|string|in:Kg,U,Sac,ML,M²,M³,Tn,M',
            'famille' => 'nullable|string|max:255',
            'initial_stock' => 'numeric|min:0',
            'min_stock_alert' => 'nullable|numeric|min:0',
            'status' => 'in:actif,inactif',
            'etat' => 'nullable|in:Dispo,Faible,Rupture',
        ]);
    }

    private function nextReference(): string
    {
        return $this->referenceFor((Product::max('id') ?? 0) + 1);
    }

    private function referenceFor(int $id): string
    {
        return 'Réf-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Quantités achetées par produit (bons d'achat non annulés),
     * indexées par product_id et par référence article.
     */
    private function purchasedQuantities(): array
    {
        if ($this->purchasedCache !== null) {
            return $this->purchasedCache;
        }

        return $this->purchasedCache = $this->orderItemQuantities(
            'purchase_order_items',
            'purchase_orders',
            'purchase_order_id',
            'poi'
        );
    }

    /**
     * Quantités vendues par produit (bons de vente non annulés).
     */
    private function soldQuantities(): array
    {
        if ($this->soldCache !== null) {
            return $this->soldCache;
        }

        return $this->soldCache = $this->orderItemQuantities(
            'sales_order_items',
            'sales_orders',
            'sales_order_id',
            'soi'
        );
    }

    private function orderItemQuantities(string $itemsTable, string $ordersTable, string $fk, string $alias): array
    {
        $map = ['by_id' => [], 'by_ref' => []];

        if (! Schema::hasTable($itemsTable) || ! Schema::hasTable($ordersTable)) {
            return $map;
        }

        $rows = DB::table("{$itemsTable} as {$alias}")
            ->join("{$ordersTable} as o", 'o.id', '=', "{$alias}.{$fk}")
            ->where('o.status', '!=', 'annule')
            ->selectRaw("{$alias}.product_id, {$alias}.article_ref, SUM({$alias}.quantity) as qty")
            ->groupBy("{$alias}.product_id", "{$alias}.article_ref")
            ->get();

        foreach ($rows as $row) {
            $qty = (float) $row->qty;

            if ($row->product_id) {
                $map['by_id'][(int) $row->product_id] = ($map['by_id'][(int) $row->product_id] ?? 0) + $qty;

                continue;
            }

            $ref = trim((string) $row->article_ref);
            if ($ref !== '') {
                $key = mb_strtolower($ref);
                $map['by_ref'][$key] = ($map['by_ref'][$key] ?? 0) + $qty;
            }
        }

        return $map;
    }

    private function qtyForProduct(Product $product, array $map): float
    {
        $qty = $map['by_id'][$product->id] ?? 0;

        $refs = array_unique(array_filter([
            mb_strtolower(trim((string) $product->article_id)),
            mb_strtolower(trim((string) $product->reference)),
        ]));

        foreach ($refs as $ref) {
            $qty += $map['by_ref'][$ref] ?? 0;
        }

        return (float) $qty;
    }

    private function purchasedFor(Product $product): float
    {
        return $this->qtyForProduct($product, $this->purchasedQuantities());
    }

    private function soldFor(Product $product): float
    {
        return $this->qtyForProduct($product, $this->soldQuantities());
    }

    private function formatProduct(Product $product): array
    {
        $purchased = $this->purchasedFor($product);
        $sold = $this->soldFor($product);
        $stockActuel = $purchased - $sold;
        $etat = $product->etatLabel($stockActuel);

        $updates = [];
        if (abs((float) $product->quantity_in_stock - $stockActuel) > 0.0001) {
            $updates['quantity_in_stock'] = $stockActuel;
        }
        if ((string) $product->etat !== $etat) {
            $updates['etat'] = $etat;
        }
        if ($updates !== []) {
            $product->forceFill($updates)->saveQuietly();
        }

        return [
            'id' => $product->id,
            'reference' => $product->reference,
            'article_id' => $product->article_id,
            'name' => $product->name,
            'designation' => $product->name,
            'consistance' => $product->consistance,
            'unit' => $product->unit,
            'famille' => $product->famille,
            'initial_stock' => (float) $product->initial_stock,
            'stock_initial' => (float) $product->initial_stock,
            'purchased_qty' => $purchased,
            'sold_qty' => $sold,
            'stock_actuel' => $stockActuel,
            'quantity_in_stock' => $stockActuel,
            'min_stock_alert' => (float) $product->min_stock_alert,
            'status' => $product->status,
            'statut' => $product->status === 'actif' ? 'Actif' : 'Inactif',
            'etat' => $etat,
            'created_at' => $product->created_at?->format('d/m/Y'),
        ];
    }
}
