<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Chantier;
use App\Models\ClientInvoice;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SaleOrder;
use App\Models\StockMovement;
use App\Models\SupplierInvoice;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class DashboardApiController extends Controller
{
    public function index()
    {
        $monthStart = now()->startOfMonth();

        $stockDepot = Product::where('status', 'actif')
            ->selectRaw('SUM(quantity_in_stock * COALESCE(NULLIF(purchase_price, 0), unit_price)) as total')
            ->value('total') ?? 0;

        $stockChantiers = StockMovement::query()
            ->join('products', 'products.id', '=', 'stock_movements.product_id')
            ->whereNotNull('stock_movements.chantier_id')
            ->selectRaw("SUM(
                CASE stock_movements.type
                    WHEN 'entree' THEN stock_movements.quantity
                    WHEN 'sortie' THEN -stock_movements.quantity
                    ELSE 0
                END * COALESCE(NULLIF(products.purchase_price, 0), products.unit_price)
            ) as total")
            ->value('total') ?? 0;

        $stockChantiers = max(0, (float) $stockChantiers);

        $nombreChantiers = Chantier::where('archived', false)->count();

        $totalAchats = (float) PurchaseOrder::where('status', '!=', 'annule')->sum('total_ttc');
        $totalVentes = (float) SaleOrder::where('status', '!=', 'annule')->sum('total_ttc');
        $reliquat = $totalAchats - $totalVentes;

        $totalCharges = Expense::sum('amount');

        $tresorerie = (float) Payment::where('type', 'client')->sum('amount')
            - (float) Payment::whereIn('type', ['fournisseur', 'personnel'])->sum('amount');

        $chantiersActifs = Chantier::where('status', 'en_cours')->where('archived', false)->count();
        $chantiersTermines = Chantier::where('status', 'termine')->count();

        $depensesMois = Expense::where('expense_date', '>=', $monthStart)->sum('amount')
            + SupplierInvoice::where('invoice_date', '>=', $monthStart)->sum('total_ttc')
            + Employee::where('status', 'actif')->sum('monthly_salary');

        $achatsMois = PurchaseOrder::where('order_date', '>=', $monthStart)
            ->whereIn('status', ['valide', 'livre'])
            ->sum('total_ttc');

        $stockDisponible = Product::where('status', 'actif')
            ->selectRaw('SUM(quantity_in_stock * COALESCE(purchase_price, unit_price)) as total')
            ->value('total') ?? 0;

        $facturesImpayees = ClientInvoice::whereIn('status', ['en_attente', 'partielle', 'en_retard'])
            ->selectRaw('COUNT(*) as count, SUM(total_ttc - amount_paid) as amount')
            ->first();

        $chargesMensuelles = Expense::where('expense_date', '>=', $monthStart)->sum('amount');

        $recettesMois = ClientInvoice::where('invoice_date', '>=', $monthStart)->sum('total_ttc');
        $benefices = $recettesMois - $depensesMois;

        $stockFaible = Product::where('status', 'actif')
            ->whereColumn('quantity_in_stock', '<=', 'min_stock_alert')
            ->count();

        $personnelPresent = Attendance::whereDate('date', today())
            ->where('status', 'present')
            ->count();

        $expensesChart = Expense::select(
            DB::raw('MONTH(expense_date) as month'),
            DB::raw('SUM(amount) as total')
        )->whereYear('expense_date', now()->year)
            ->groupBy('month')->orderBy('month')->get();

        $revenueChart = ClientInvoice::select(
            DB::raw('MONTH(invoice_date) as month'),
            DB::raw('SUM(total_ttc) as total')
        )->whereYear('invoice_date', now()->year)
            ->groupBy('month')->orderBy('month')->get();

        $purchasesChart = PurchaseOrder::select(
            DB::raw('MONTH(order_date) as month'),
            DB::raw('SUM(total_ttc) as total')
        )->whereYear('order_date', now()->year)
            ->whereIn('status', ['valide', 'livre'])
            ->groupBy('month')->orderBy('month')->get();

        $chargesBreakdown = Expense::select('category', DB::raw('SUM(amount) as total'))
            ->where('expense_date', '>=', $monthStart)
            ->groupBy('category')->get();

        $chantiersEnCours = Chantier::with('client')
            ->where('status', 'en_cours')->where('archived', false)
            ->orderByDesc('progress')->limit(6)->get();

        $tachesRetard = Task::with(['chantier', 'assignee'])
            ->where('status', 'en_retard')
            ->orWhere(function ($q) {
                $q->whereIn('status', ['a_faire', 'en_cours'])
                    ->where('due_date', '<', now());
            })
            ->limit(8)->get();

        $calendrier = Chantier::where('archived', false)
            ->whereNotNull('start_date')
            ->select('id', 'name', 'reference', 'start_date', 'end_date', 'status', 'city')
            ->get();

        $etatDebit = Payment::where('type', 'fournisseur')
            ->with(['payable.supplier'])
            ->latest('payment_date')
            ->limit(25)
            ->get()
            ->map(fn ($p) => [
                'date' => $p->payment_date?->format('d/m/Y'),
                'fournisseur' => $p->payable instanceof SupplierInvoice
                    ? ($p->payable->supplier?->name ?? '—')
                    : '—',
                'type_regl' => $this->formatPaymentMethod($p->method),
                'numero' => $p->reference ?? ($p->payable instanceof SupplierInvoice ? $p->payable->reference : '—'),
                'montant' => round((float) $p->amount, 2),
                'date_decaiss' => $p->payment_date?->format('d/m/Y'),
            ]);

        if ($etatDebit->isEmpty()) {
            $etatDebit = SupplierInvoice::with('supplier')
                ->latest('invoice_date')
                ->limit(10)
                ->get()
                ->map(fn ($inv) => [
                    'date' => $inv->invoice_date?->format('d/m/Y'),
                    'fournisseur' => $inv->supplier?->name ?? '—',
                    'type_regl' => 'Facture',
                    'numero' => $inv->reference,
                    'montant' => round((float) $inv->total_ttc, 2),
                    'date_decaiss' => $inv->due_date?->format('d/m/Y') ?? '—',
                ]);
        }

        $etatConsommation = collect();
        $topConsommation = StockMovement::where('type', 'sortie')
            ->whereNotNull('product_id')
            ->select('product_id', DB::raw('SUM(quantity) as total_qte'))
            ->groupBy('product_id')
            ->orderByDesc('total_qte')
            ->limit(5)
            ->get();

        if ($topConsommation->isNotEmpty()) {
            $productIds = $topConsommation->pluck('product_id');
            $products = Product::whereIn('id', $productIds)->get()->keyBy('id');

            $topDestinations = StockMovement::where('type', 'sortie')
                ->whereIn('product_id', $productIds)
                ->select('product_id', 'chantier_id', DB::raw('SUM(quantity) as qte_chantier'))
                ->groupBy('product_id', 'chantier_id')
                ->orderByDesc('qte_chantier')
                ->get()
                ->groupBy('product_id')
                ->map(fn ($group) => $group->sortByDesc('qte_chantier')->first());

            $chantierIds = $topDestinations->pluck('chantier_id')->filter()->unique();
            $chantiers = Chantier::whereIn('id', $chantierIds)->get()->keyBy('id');

            $etatConsommation = $topConsommation->map(function ($row) use ($products, $topDestinations, $chantiers) {
                $product = $products->get($row->product_id);
                $destRow = $topDestinations->get($row->product_id);
                $chantier = $destRow?->chantier_id ? $chantiers->get($destRow->chantier_id) : null;

                return [
                    'ref' => $product?->reference ?? '—',
                    'designation' => $product?->name ?? '—',
                    'qte' => round((float) $row->total_qte, 3),
                    'destination' => $chantier?->name ?? 'Dépôt',
                    'statut' => $this->mapProductStatut($product),
                    'etat' => $this->mapProductEtat($product),
                ];
            });
        }

        if ($etatConsommation->isEmpty()) {
            $chantierNames = Chantier::where('archived', false)->pluck('name');
            $etatConsommation = Product::latest()
                ->limit(5)
                ->get()
                ->map(fn ($p, $i) => [
                    'ref' => $p->reference,
                    'designation' => $p->name,
                    'qte' => (float) $p->quantity_in_stock,
                    'destination' => $chantierNames->isNotEmpty()
                        ? $chantierNames[$i % $chantierNames->count()]
                        : 'Chantier',
                    'statut' => $this->mapProductStatut($p),
                    'etat' => $this->mapProductEtat($p),
                ]);
        }

        $etatCharges = Expense::with('chantier')
            ->latest('expense_date')
            ->limit(25)
            ->get()
            ->map(fn ($e) => [
                'date' => $e->expense_date?->format('d/m/Y'),
                'designation' => $e->description ?? ucfirst(str_replace('_', ' ', $e->category)),
                'montant' => round((float) $e->amount, 2),
                'destination' => $e->chantier?->name ?? 'Général',
            ]);

        return response()->json([
            'kpis' => [
                'total_achats' => round($totalAchats, 2),
                'total_ventes' => round($totalVentes, 2),
                'reliquat' => round($reliquat, 2),
                'nombre_chantiers' => $nombreChantiers,
                'valeur_stock_chantiers' => round($stockChantiers, 2),
                'valeur_stock_depot' => round($stockDepot, 2),
                'total_charges' => round($totalCharges, 2),
                'tresorerie' => round($tresorerie, 2),
                'chantiers_actifs' => $chantiersActifs,
                'chantiers_termines' => $chantiersTermines,
                'depenses_mois' => round($depensesMois, 2),
                'achats_mois' => round($achatsMois, 2),
                'stock_disponible' => round($stockDisponible, 2),
                'factures_impayees_count' => $facturesImpayees->count ?? 0,
                'factures_impayees_amount' => round($facturesImpayees->amount ?? 0, 2),
                'charges_mensuelles' => round($chargesMensuelles, 2),
                'benefices' => round($benefices, 2),
                'stock_faible' => $stockFaible,
                'personnel_present' => $personnelPresent,
            ],
            'charts' => [
                'expenses' => $expensesChart,
                'revenue' => $revenueChart,
                'purchases' => $purchasesChart,
                'charges_breakdown' => $chargesBreakdown,
            ],
            'chantiers' => $chantiersEnCours,
            'taches_retard' => $tachesRetard,
            'calendrier' => $calendrier,
            'tables' => [
                'etat_debit' => $etatDebit->values(),
                'etat_consommation' => $etatConsommation->values(),
                'etat_charges' => $etatCharges->values(),
            ],
        ]);
    }

    private function formatPaymentMethod(?string $method): string
    {
        return match ($method) {
            'especes' => 'Espèces',
            'cheque' => 'Chèque',
            'virement' => 'Virement',
            'carte' => 'Carte',
            default => $method ? ucfirst($method) : '—',
        };
    }

    private function mapProductStatut(?Product $product): string
    {
        if (! $product) {
            return '—';
        }

        return $product->status === 'actif' ? 'Actif' : 'Inactif';
    }

    private function mapProductEtat(?Product $product): string
    {
        if (! $product) {
            return '—';
        }

        return $product->etatLabel();
    }
}
