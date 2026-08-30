<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Charge;
use App\Models\Chantier;
use App\Models\ClientInvoice;
use App\Models\Employee;
use App\Models\Payment;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SaleOrder;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Models\Task;
use Carbon\Carbon;
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

        $totalCharges = (float) Charge::sum('montant');

        $tresorerie = (float) Payment::where('type', 'client')->sum('amount')
            - (float) Payment::whereIn('type', ['fournisseur', 'personnel'])->sum('amount');

        $soldesFournisseurs = $this->soldesFournisseurs();
        $soldeFournisseur = round(collect($soldesFournisseurs)->sum('solde'), 2);

        $chantiersActifs = Chantier::where('status', 'en_cours')->where('archived', false)->count();
        $chantiersTermines = Chantier::where('status', 'termine')->count();

        $depensesMois = (float) Charge::where('charge_date', '>=', $monthStart)->sum('montant')
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

        $chargesMensuelles = (float) Charge::where('charge_date', '>=', $monthStart)->sum('montant');

        $recettesMois = ClientInvoice::where('invoice_date', '>=', $monthStart)->sum('total_ttc');
        $benefices = $recettesMois - $depensesMois;

        $stockFaible = Product::where('status', 'actif')
            ->whereColumn('quantity_in_stock', '<=', 'min_stock_alert')
            ->count();

        $personnelPresent = Attendance::whereDate('date', today())
            ->where('status', 'present')
            ->count();

        $expensesChart = Charge::select(
            DB::raw('MONTH(charge_date) as month'),
            DB::raw('SUM(montant) as total')
        )->whereYear('charge_date', now()->year)
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

        $chargesBreakdown = Charge::select('designation as category', DB::raw('SUM(montant) as total'))
            ->where('charge_date', '>=', $monthStart)
            ->groupBy('designation')->get();

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

        $derniersBonsAchats = PurchaseOrder::with(['supplier', 'items', 'paymentAllocations'])
            ->where('status', '!=', 'annule')
            ->latest('order_date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(function ($order) {
                $montantBon = round((float) $order->total_ttc, 2);
                $montantPaye = round((float) $order->paymentAllocations->sum('amount'), 2);
                $qte = $order->items->isNotEmpty()
                    ? round((float) $order->items->sum('quantity'), 3)
                    : round((float) $order->quantity, 3);

                return [
                    'date' => $order->order_date?->format('d/m/Y'),
                    'fournisseur' => $order->supplier?->name ?? '—',
                    'bn_numero' => $order->reference ?? '—',
                    'qte' => $qte,
                    'montant_bon' => $montantBon,
                    'solde' => round($montantBon - $montantPaye, 2),
                ];
            });

        $derniersBonsVentes = SaleOrder::with(['client', 'items', 'paymentAllocations'])
            ->where('status', '!=', 'annule')
            ->latest('order_date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(function ($order) {
                $montantBon = round((float) $order->total_ttc, 2);
                $montantPaye = round((float) $order->paymentAllocations->sum('amount'), 2);
                $qte = $order->items->isNotEmpty()
                    ? round((float) $order->items->sum('quantity'), 3)
                    : round((float) $order->quantity, 3);

                return [
                    'date' => $order->order_date?->format('d/m/Y'),
                    'client' => $order->client?->name ?? '—',
                    'bn_numero' => $order->reference ?? '—',
                    'qte' => $qte,
                    'montant_bon' => $montantBon,
                    'solde' => round($montantBon - $montantPaye, 2),
                ];
            });

        $derniersBonsCharge = Charge::query()
            ->latest('charge_date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn ($c) => [
                'date' => $c->charge_date?->format('d/m/Y'),
                'designation' => $c->designation ?: '—',
                'beneficiaire' => $c->beneficiaire ?: '—',
                'regl' => $c->type_reglement ?: '—',
                'date_decaiss' => $c->date_decaissement?->format('d/m/Y') ?? '—',
            ]);

        // Semaine en cours (lundi → dimanche), bornée au mois opérationnel
        $today = Carbon::today();
        $monthStart = $today->copy()->startOfMonth()->startOfDay();
        $monthEnd = $today->copy()->endOfMonth()->endOfDay();
        $weekStart = $today->copy()->startOfWeek(Carbon::MONDAY)->startOfDay();
        $weekEnd = $today->copy()->endOfWeek(Carbon::SUNDAY)->endOfDay();
        $opWeekStart = $weekStart->greaterThan($monthStart) ? $weekStart : $monthStart;
        $opWeekEnd = $weekEnd->lessThan($monthEnd) ? $weekEnd : $monthEnd;

        $reglADecaisser = SupplierPayment::query()
            ->whereIn('statut', ['Inst', 'Report', 'Imp'])
            ->whereNotNull('date_decaissement')
            ->whereDate('date_decaissement', '>=', $opWeekStart->toDateString())
            ->whereDate('date_decaissement', '<=', $opWeekEnd->toDateString())
            ->orderBy('date_decaissement')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn ($p) => [
                'type_reg' => $p->reglement ?: '—',
                'numero' => $p->numero ?: '—',
                'bnq' => $p->banque ?: '—',
                'tire' => $p->nom_tire ?: '—',
                'montant' => round((float) $p->montant, 2),
                'date_decaiss' => $p->date_decaissement?->format('d/m/Y') ?? '—',
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
                'solde_fournisseur' => $soldeFournisseur,
                'soldes_fournisseurs' => $soldesFournisseurs,
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
                'derniers_bons_achats' => $derniersBonsAchats->values(),
                'derniers_bons_ventes' => $derniersBonsVentes->values(),
                'derniers_bons_charge' => $derniersBonsCharge->values(),
                'regl_a_decaisser' => $reglADecaisser->values(),
            ],
        ]);
    }

    /**
     * @return array<int, array{id: int, name: string, solde: float}>
     */
    private function soldesFournisseurs(): array
    {
        $achatsBySupplier = PurchaseOrder::query()
            ->where('status', '!=', 'annule')
            ->selectRaw('supplier_id, SUM(total_ttc) as total_achats')
            ->groupBy('supplier_id')
            ->pluck('total_achats', 'supplier_id');

        $paiementsBySupplier = SupplierPayment::query()
            ->selectRaw('supplier_id, SUM(montant) as montant_paye')
            ->groupBy('supplier_id')
            ->pluck('montant_paye', 'supplier_id');

        $supplierIds = $achatsBySupplier->keys()
            ->merge($paiementsBySupplier->keys())
            ->unique()
            ->filter()
            ->values();

        $suppliers = Supplier::whereIn('id', $supplierIds)->get()->keyBy('id');

        return $supplierIds->map(function ($supplierId) use ($achatsBySupplier, $paiementsBySupplier, $suppliers) {
            $totalAchats = (float) ($achatsBySupplier[$supplierId] ?? 0);
            $montantPaye = (float) ($paiementsBySupplier[$supplierId] ?? 0);

            return [
                'id' => (int) $supplierId,
                'name' => $suppliers->get($supplierId)?->name ?? '—',
                'solde' => round(max($totalAchats - $montantPaye, 0), 2),
            ];
        })
            ->sortBy('name')
            ->values()
            ->all();
    }
}
