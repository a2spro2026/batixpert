<?php

namespace App\Support\Ghita;

use App\Models\Client;
use App\Models\ClientInvoice;
use App\Models\ClientPayment;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Models\SaleOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Support\ClientPlafond;
use App\Support\GhitaModules;
use Illuminate\Support\Carbon;

class GhitaIntent
{
    public function answer(string $raw, string $folded, array $context = []): ?array
    {
        $q = $this->prepare($folded);
        $client = $this->findClient($q);
        $supplier = $this->findSupplier($q);
        if ($this->pronoun($q)) {
            $client = $client ?: $this->clientFromContext($context, $q);
            $supplier = $supplier ?: $this->supplierFromContext($context, $q);
        }
        if ($client && $supplier && ! str_contains($q, 'fournisseur')) {
            $supplier = null;
        }
        if ($this->pronoun($q) && ! $client && ! $supplier && preg_match('/facture|reglement|paiement|historique|dossier|situation|plafond|encours/', $q)) {
            $who = ($context['focus'] ?? '') === 'supplier' ? 'fournisseur' : 'client';

            return $this->out('De quel '.$who.' parlez-vous ?', $context, ['La situation d\'Atlas BTP', 'La situation de Matériaux du Nord']);
        }
        $intent = $this->intent($q, $client !== null, $supplier !== null);

        if ($intent === null) {
            return null;
        }

        if ($this->needsClient($intent) && ! $client) {
            return $this->out('De quel client parlez-vous ?', $context, ['Le plafond d\'Atlas BTP', 'Combien de clients ?']);
        }
        if ($this->needsSupplier($intent) && ! $supplier) {
            return $this->out('De quel fournisseur parlez-vous ?', $context, ['Quels fournisseurs devons-nous payer ?']);
        }

        $reply = match ($intent) {
            'clients_count' => $this->clientsCount(false),
            'clients_active' => $this->clientsCount(true),
            'clients_new' => $this->clientsNew(),
            'unpaid_invoices' => $this->unpaidInvoices(),
            'clients_top' => $this->topClients(),
            'suppliers_count' => $this->suppliersCount(),
            'suppliers_to_pay' => $this->suppliersToPay(),
            'cash_out_total' => $this->cashOutTotal(),
            'purchase_pending' => $this->purchasePending(),
            'settlement_pending' => $this->settlementPending(),
            'balance' => $this->balance(),
            'treasury' => $this->treasury(),
            'collected_month' => $this->collectedMonth(),
            'disbursed_month' => $this->disbursedMonth(),
            'receivables' => $this->receivables(),
            'debts' => $this->debts(),
            'revenue' => $this->revenue(),
            'situation', 'report' => $this->situation($intent === 'report'),
            'plafond' => $this->plafond($client),
            'encours' => $this->encours($client),
            'available' => $this->available($client),
            'client_invoices' => (new GhitaDossier)->readClient($client, 'invoices'),
            'client_payments' => (new GhitaDossier)->readClient($client, 'payments'),
            'client_history' => (new GhitaDossier)->readClient($client, 'history'),
            'client_situation' => (new GhitaDossier)->readClient($client),
            'supplier_payments' => (new GhitaDossier)->readSupplier($supplier, 'payments'),
            'supplier_situation' => (new GhitaDossier)->readSupplier($supplier),
            'over_limit' => $this->overLimit(),
            'near_limit' => $this->nearLimit(),
            'supplier_balance' => $this->supplierBalance($supplier),
            'client_balance' => $this->encours($client),
            'urgent', 'priorities' => $this->urgent(),
            'delays' => $this->delays(),
            'risks' => $this->risks(),
            default => null,
        };

        if ($reply === null) {
            return null;
        }

        $next = $context;
        if ($client) {
            $next['focus'] = 'client';
            $next['client_id'] = $client->id;
            $next['client_name'] = $client->name;
        }
        if ($supplier && ! $client) {
            $next['focus'] = 'supplier';
            $next['supplier_id'] = $supplier->id;
            $next['supplier_name'] = $supplier->name;
        }

        return $this->out($reply, $next, $this->suggestions($intent));
    }

    private function intent(string $q, bool $hasClient, bool $hasSupplier): ?string
    {
        if (preg_match('/\b(chhal|ch7al|combien|nombre)\b/', $q) && preg_match('/\b(client|clients|klian)\b/', $q) && ! $hasClient) {
            return str_contains($q, 'actif') ? 'clients_active' : 'clients_count';
        }
        if (preg_match('/\b(aandna|3andna|andna)\b/', $q) && str_contains($q, 'client')) {
            return 'clients_count';
        }
        if (preg_match('/\b(nouveau|nouveaux|recent)\b/', $q) && str_contains($q, 'client')) {
            return 'clients_new';
        }
        if (! $hasClient && str_contains($q, 'facture') && (str_contains($q, 'impay') || str_contains($q, 'retard'))) {
            return 'unpaid_invoices';
        }
        if (preg_match('/\b(meilleur|meilleurs|top)\b/', $q) && str_contains($q, 'client')) {
            return 'clients_top';
        }
        if (preg_match('/\b(combien|nombre|chhal)\b/', $q) && str_contains($q, 'fournisseur') && ! $hasSupplier) {
            return 'suppliers_count';
        }
        if ((preg_match('/\b(payer|regler|devoir|nkhal|khalso|khalsso|khasna|khassna)\b/', $q) && str_contains($q, 'fournisseur'))
            || preg_match('/\b(chkon|chkoune|chkoun)\b/', $q)) {
            return 'suppliers_to_pay';
        }
        if (preg_match('/\b(total|montant)\b/', $q) && str_contains($q, 'decaiss')) {
            return 'cash_out_total';
        }
        if (preg_match('/\bbons?\b/', $q) && preg_match('/\b(attente|prepar|fournisseur)\b/', $q) && preg_match('/\b(commande|achat)\b/', $q)) {
            return 'purchase_pending';
        }
        if (preg_match('/\bbons?\b/', $q) && str_contains($q, 'fournisseur') && preg_match('/\b(attente|prepar|liste)\b/', $q)) {
            return 'purchase_pending';
        }
        if (str_contains($q, 'reglement') && preg_match('/\b(prepar|attente|reste)\b/', $q)) {
            return 'settlement_pending';
        }
        if (preg_match('/\bbalance\b/', $q)) {
            return 'balance';
        }
        if (str_contains($q, 'tresorerie')) {
            return 'treasury';
        }
        if (str_contains($q, 'encaissement') || preg_match('/\bencaisse\b/', $q)) {
            return 'collected_month';
        }
        if (preg_match('/\b(decaisse|decaissement)\b/', $q) && ! str_contains($q, 'total')) {
            return 'disbursed_month';
        }
        if (preg_match('/\bcreance/', $q)) {
            return 'receivables';
        }
        if (preg_match('/\bdettes?\b/', $q)) {
            return 'debts';
        }
        if (preg_match('/\b(chiffre d affaires|chiffre daffaire)\b/', $q)) {
            return 'revenue';
        }
        if ($hasClient && preg_match('/facture/', $q)) {
            return 'client_invoices';
        }
        if ($hasClient && (str_contains($q, 'reglement') || str_contains($q, 'paiement'))) {
            return 'client_payments';
        }
        if ($hasClient && preg_match('/\b(historique|dossier)\b/', $q)) {
            return 'client_history';
        }
        if ($hasClient && (preg_match('/\b(situation|parle)\b/', $q) || str_contains($q, 'ou en est')) && ! preg_match('/\b(notre|generale|financiere)\b/', $q)) {
            return 'client_situation';
        }
        if ($hasSupplier && ! $hasClient && (str_contains($q, 'reglement') || str_contains($q, 'paiement'))) {
            return 'supplier_payments';
        }
        if ($hasSupplier && ! $hasClient && (preg_match('/\b(historique|dossier|situation)\b/', $q) || str_contains($q, 'ou en est')) && ! preg_match('/\b(notre|generale|financiere)\b/', $q)) {
            return 'supplier_situation';
        }
        if (preg_match('/\brapport\b/', $q)) {
            return 'report';
        }
        if (preg_match('/\b(analyse|performance|situation)\b/', $q)) {
            return 'situation';
        }
        if (str_contains($q, 'depass') && str_contains($q, 'plafond')) {
            return 'over_limit';
        }
        if (preg_match('/\b(proche|limites?)\b/', $q) && preg_match('/\b(plafond|limite|credit)\b/', $q)) {
            return 'near_limit';
        }
        if (str_contains($q, 'urgent') || str_contains($q, 'prioris') || str_contains($q, 'lyoum') || preg_match('/\b(chno|ach)\b.*\b(khas|dir|ndir)\b/', $q)) {
            return 'urgent';
        }
        if (preg_match('/\b(retard|retards)\b/', $q) && preg_match('/\b(paiement|paye|reglement)\b/', $q)) {
            return 'delays';
        }
        if (preg_match('/\brisque/', $q)) {
            return 'risks';
        }
        if (str_contains($q, 'plafond')) {
            return 'plafond';
        }
        if (preg_match('/\b(encours)\b/', $q)) {
            return 'encours';
        }
        if (preg_match('/\b(reste|baqi|ba9i|disponib)\b/', $q)) {
            return $hasSupplier && ! $hasClient ? 'supplier_balance' : 'available';
        }
        if (preg_match('/\b(balance|solde)\b/', $q) && $hasClient) {
            return 'client_balance';
        }
        if (preg_match('/\b(balance|solde)\b/', $q) && $hasSupplier) {
            return 'supplier_balance';
        }

        return null;
    }

    private function clientsCount(bool $activeOnly): string
    {
        $total = Client::query()->count();
        $inactifs = Client::query()->where('status', 'inactif')->count();
        $actifs = $total - $inactifs;
        if ($activeOnly) {
            return 'Clients actifs : '.$actifs.'. Inactifs : '.$inactifs.'. Total enregistré : '.$total.'.';
        }
        $word = $total > 1 ? 'clients enregistrés' : 'client enregistré';

        return 'BatiXpert compte actuellement '.$total.' '.$word.', dont '.$actifs.' '.($actifs > 1 ? 'actifs' : 'actif').' et '.$inactifs.' '.($inactifs > 1 ? 'inactifs' : 'inactif').'.';
    }

    private function clientsNew(): string
    {
        $start = now()->startOfMonth();
        $rows = Client::query()->where('created_at', '>=', $start)->orderBy('name')->get();
        $period = $this->monthLabel();
        if ($rows->isEmpty()) {
            return 'Aucun nouveau client en '.$period.'.';
        }

        return $rows->count().' nouveau'.($rows->count() > 1 ? 'x' : '').' client'.($rows->count() > 1 ? 's' : '').' en '.$period.' : '.$rows->pluck('name')->implode(', ').'.';
    }

    private function unpaidInvoices(): string
    {
        $rows = ClientInvoice::query()
            ->with('client')
            ->whereIn('status', ['en_attente', 'partielle', 'en_retard'])
            ->get()
            ->filter(fn ($invoice) => (float) $invoice->total_ttc - (float) $invoice->amount_paid > 0.009);
        $amount = round($rows->sum(fn ($invoice) => (float) $invoice->total_ttc - (float) $invoice->amount_paid), 2);
        if ($rows->isEmpty()) {
            return 'Aucune facture client impayée. Ce calcul porte sur les factures, pas sur les bons de vente.';
        }
        $names = $rows->map(fn ($invoice) => $invoice->client?->name ?: 'Client')->unique()->take(5)->implode(', ');

        return 'Factures client impayées : '.$this->money($amount).' DH, sur '.$rows->count().' facture'.($rows->count() > 1 ? 's' : '').'. Clients : '.$names.'.';
    }

    private function topClients(): string
    {
        $rows = SaleOrder::query()
            ->where('status', '!=', 'annule')
            ->selectRaw('client_id, SUM(total_ttc) as ca')
            ->groupBy('client_id')
            ->orderByDesc('ca')
            ->limit(5)
            ->get();
        if ($rows->isEmpty()) {
            return 'Aucun bon de vente. Le classement des meilleurs clients est vide.';
        }
        $lines = ['Meilleurs clients par chiffre d\'affaires des bons de vente, toutes périodes :'];
        foreach ($rows as $row) {
            $name = Client::find($row->client_id)?->name ?: 'Client';
            $lines[] = $name.' : '.$this->money($row->ca).' DH.';
        }

        return implode("\n", $lines);
    }

    private function suppliersCount(): string
    {
        $total = Supplier::query()->count();

        return 'BatiXpert compte '.$total.' fournisseur'.($total > 1 ? 's' : '').'.';
    }

    private function suppliersToPay(): string
    {
        $rows = $this->openPurchases();
        if ($rows->isEmpty()) {
            return 'Aucun fournisseur à payer. Tous les bons d\'achat sont soldés ou annulés.';
        }
        $total = round($rows->sum('reste'), 2);
        $lines = ['Dettes fournisseurs sur bons d\'achat non soldés : '.$this->money($total).' DH.'];
        foreach ($rows->take(5) as $row) {
            $lines[] = $row['name'].' : '.$this->money($row['reste']).' DH.';
        }
        $lines[] = 'L\'échéance du bon n\'est pas encore séparée de ce total. Souhaitez-vous le détail ?';

        return implode("\n", $lines);
    }

    private function cashOutTotal(): string
    {
        $total = round($this->openPurchases()->sum('reste'), 2);

        return 'Montant total à décaisser sur les bons d\'achat non soldés : '.$this->money($total).' DH.';
    }

    private function purchasePending(): string
    {
        $rows = PurchaseOrder::query()
            ->with('supplier')
            ->where('status', '!=', 'annule')
            ->whereRaw('ROUND(total_ttc - COALESCE(montant_paye, 0), 2) > 0.009')
            ->orderBy('order_date')
            ->get();
        if ($rows->isEmpty()) {
            return 'Aucun bon d\'achat en attente de règlement.';
        }
        $lines = [$rows->count().' bon'.($rows->count() > 1 ? 's' : '').' fournisseur non soldé'.($rows->count() > 1 ? 's' : '').' :'];
        foreach ($rows->take(8) as $order) {
            $reste = round((float) $order->total_ttc - (float) $order->montant_paye, 2);
            $lines[] = ($order->reference ?: 'Bon').' · '.($order->supplier?->name ?: 'Fournisseur').' · '.$this->money($reste).' DH · statut '.($order->status ?: '—').'.';
        }

        return implode("\n", $lines);
    }

    private function settlementPending(): string
    {
        $open = $this->openPurchases()->count();
        $drafts = SupplierPayment::query()->whereNotIn('statut', ['Payé', 'paye', 'payé'])->count();

        return 'Bons d\'achat encore ouverts : '.$open.'. Règlements fournisseur non marqués payés : '.$drafts.'. Je peux détailler les bons si vous le confirmez.';
    }

    private function balance(): string
    {
        $figures = $this->figures();

        return "Situation financière générale de BatiXpert :\nSolde de trésorerie : ".$this->money($figures['tresorerie'])." DH\nCréances clients : ".$this->money($figures['creances'])." DH\nDettes fournisseurs : ".$this->money($figures['dettes'])." DH\nSolde net : ".$this->money($figures['net'])." DH\nLa trésorerie vient du journal payments. Les créances viennent des bons de vente et commandes, moins les règlements clients. Les dettes sont le reste des bons d'achat.\nSouhaitez-vous le détail par compte ?";
    }

    private function treasury(): string
    {
        $entrees = round((float) Payment::query()->where('type', 'client')->sum('amount'), 2);
        $sorties = round((float) Payment::query()->whereIn('type', ['fournisseur', 'personnel'])->sum('amount'), 2);

        return 'Solde de trésorerie : '.$this->money($entrees - $sorties).' DH. Entrées journal client '.$this->money($entrees).' DH, sorties fournisseur et personnel '.$this->money($sorties).' DH. Source : table payments, toutes périodes.';
    }

    private function collectedMonth(): string
    {
        $period = $this->monthLabel();
        [$start, $end] = $this->monthRange();
        $reglements = round((float) ClientPayment::query()->whereBetween('payment_date', [$start, $end])->sum('montant'), 2);
        $journal = round((float) Payment::query()->where('type', 'client')->whereBetween('payment_date', [$start, $end])->sum('amount'), 2);

        return 'Encaissements de '.$period.' : règlements clients '.$this->money($reglements).' DH, journal de trésorerie '.$this->money($journal).' DH. Ces deux sources ne sont pas additionnées.';
    }

    private function disbursedMonth(): string
    {
        $period = $this->monthLabel();
        [$start, $end] = $this->monthRange();
        $reglements = round((float) SupplierPayment::query()->whereBetween('payment_date', [$start, $end])->sum('montant'), 2);
        $journal = round((float) Payment::query()->whereIn('type', ['fournisseur', 'personnel'])->whereBetween('payment_date', [$start, $end])->sum('amount'), 2);

        return 'Décaissements de '.$period.' : règlements fournisseurs '.$this->money($reglements).' DH, journal de trésorerie '.$this->money($journal).' DH. Le reste à payer sur les bons n\'est pas inclus ici.';
    }

    private function receivables(): string
    {
        $total = round(Client::query()->get()->sum(fn (Client $client) => ClientPlafond::solde($client->id)), 2);

        return 'Créances clients : '.$this->money($total).' DH. Calcul : bons de vente et commandes non annulés, moins les règlements clients.';
    }

    private function debts(): string
    {
        $total = round($this->openPurchases()->sum('reste'), 2);

        return 'Dettes fournisseurs : '.$this->money($total).' DH. Calcul : reste des bons d\'achat non annulés.';
    }

    private function revenue(): string
    {
        [$start, $end] = $this->monthRange();
        $bons = round((float) SaleOrder::query()->where('status', '!=', 'annule')->whereBetween('order_date', [$start, $end])->sum('total_ttc'), 2);
        $factures = round((float) ClientInvoice::query()->whereBetween('invoice_date', [$start, $end])->sum('total_ttc'), 2);

        return 'Chiffre d\'affaires de '.$this->monthLabel().' : bons de vente '.$this->money($bons).' DH, factures client '.$this->money($factures).' DH. Les deux chiffres ne se cumulent pas.';
    }

    private function situation(bool $report): string
    {
        $text = (new GhitaModules)->handle('analyse', '', 'analyse')['reply'] ?? '';
        $title = $report ? 'Rapport de gestion, '.$this->monthLabel().'.' : 'Situation financière.';

        return $title."\n".$text;
    }

    private function plafond(Client $client): string
    {
        $snap = ClientPlafond::snapshot($client);
        if ($snap['plafond'] === null) {
            return 'Aucun plafond n\'est enregistré pour '.$client->name.'. Je n\'en invente pas. Son encours est de '.$this->money($snap['solde']).' DH.';
        }

        return 'Le plafond de crédit autorisé pour '.$client->name.' est de '.$this->money($snap['plafond']).' DH. Son encours actuel est de '.$this->money($snap['solde']).' DH et il lui reste '.$this->money($snap['reste']).' DH de disponibilité.';
    }

    private function encours(Client $client): string
    {
        $snap = ClientPlafond::snapshot($client);

        return 'Encours de '.$client->name.' : '.$this->money($snap['solde']).' DH. Calcul : bons de vente et commandes, moins les règlements.';
    }

    private function available(Client $client): string
    {
        $snap = ClientPlafond::snapshot($client);
        if ($snap['plafond'] === null) {
            return 'Aucun plafond pour '.$client->name.'. La disponibilité de crédit n\'existe pas. Son encours est de '.$this->money($snap['solde']).' DH.';
        }

        return 'Il reste '.$this->money($snap['reste']).' DH de disponibilité à '.$client->name.'. Plafond '.$this->money($snap['plafond']).' DH, encours '.$this->money($snap['solde']).' DH.';
    }

    private function overLimit(): string
    {
        $rows = $this->creditRows()->filter(fn ($row) => $row['over']);
        if ($rows->isEmpty()) {
            $without = Client::query()->whereNull('plafond')->count();

            return 'Aucun client ne dépasse son plafond. '.$without.' client'.($without > 1 ? 's n\'ont' : ' n\'a').' pas de plafond enregistré.';
        }
        $lines = [$rows->count().' client'.($rows->count() > 1 ? 's dépassent' : ' dépasse').' le plafond :'];
        foreach ($rows as $row) {
            $lines[] = $row['name'].' : encours '.$this->money($row['solde']).' DH, plafond '.$this->money($row['plafond']).' DH.';
        }

        return implode("\n", $lines);
    }

    private function nearLimit(): string
    {
        $rows = $this->creditRows()->filter(fn ($row) => ! $row['over'] && $row['ratio'] >= 0.8);
        if ($rows->isEmpty()) {
            return 'Aucun client n\'a consommé 80 % ou plus de son plafond sans le dépasser.';
        }
        $lines = ['Clients proches de leur plafond :'];
        foreach ($rows as $row) {
            $lines[] = $row['name'].' : reste '.$this->money($row['reste']).' DH sur '.$this->money($row['plafond']).' DH.';
        }

        return implode("\n", $lines);
    }

    private function supplierBalance(Supplier $supplier): string
    {
        $achats = (float) PurchaseOrder::query()->where('supplier_id', $supplier->id)->where('status', '!=', 'annule')->sum('total_ttc');
        $paye = (float) SupplierPayment::query()->where('supplier_id', $supplier->id)->sum('montant');
        $solde = round(max($achats - $paye, 0), 2);

        return 'Solde fournisseur de '.$supplier->name.' : '.$this->money($solde).' DH à décaisser. Achats '.$this->money($achats).' DH, réglé '.$this->money($paye).' DH.';
    }

    private function urgent(): string
    {
        $debts = round($this->openPurchases()->sum('reste'), 2);
        $late = \App\Models\Task::query()->where(function ($query) {
            $query->where('status', 'en_retard')->orWhere(function ($query) {
                $query->whereIn('status', ['a_faire', 'en_cours'])->whereDate('due_date', '<', today());
            });
        })->count();
        $relances = \App\Models\ClientRelance::query()->whereNotNull('date_rappel')->whereDate('date_rappel', '<=', today())->count();
        $lines = ['Opérations à traiter aujourd\'hui, '.$this->monthLabel().' :'];
        $lines[] = 'Dettes fournisseurs ouvertes : '.$this->money($debts).' DH.';
        $lines[] = 'Tâches en retard : '.$late.'.';
        $lines[] = 'Rappels clients dus : '.$relances.'.';
        if ($debts > 0) {
            $lines[] = 'Priorité : ne pas ajouter d\'achat tant que ces dettes ne sont pas arbitrées.';
        }

        return implode("\n", $lines);
    }

    private function delays(): string
    {
        $invoices = ClientInvoice::query()->where('status', 'en_retard')->count();
        $orders = SaleOrder::query()
            ->where('status', '!=', 'annule')
            ->whereRaw('ROUND(total_ttc - COALESCE(montant_paye, 0), 2) > 0.009')
            ->whereDate('order_date', '<', now()->subDays(30))
            ->count();

        return 'Retards de paiement : '.$invoices.' facture'.($invoices > 1 ? 's' : '').' au statut en retard, et '.$orders.' bon'.($orders > 1 ? 's' : '').' de vente ouvert'.($orders > 1 ? 's' : '').' depuis plus de 30 jours.';
    }

    private function risks(): string
    {
        $figures = (new GhitaModules)->figures();
        $over = $this->creditRows()->where('over', true)->count();
        $lines = ['Risques lus dans les chiffres, pas une estimation :'];
        if ($figures['ecart'] > 0) {
            $lines[] = 'Les achats dépassent les ventes de '.$this->money($figures['ecart']).' DH.';
        }
        $lines[] = 'Dettes fournisseurs ouvertes : '.$this->money($figures['decaisser']).' DH.';
        $lines[] = 'Clients au-dessus du plafond : '.$over.'.';

        return implode("\n", $lines);
    }

    private function openPurchases()
    {
        return PurchaseOrder::query()
            ->with('supplier')
            ->where('status', '!=', 'annule')
            ->get()
            ->map(function ($order) {
                return [
                    'name' => $order->supplier?->name ?: 'Fournisseur',
                    'reste' => round(max((float) $order->total_ttc - (float) $order->montant_paye, 0), 2),
                ];
            })
            ->filter(fn ($row) => $row['reste'] > 0.009)
            ->groupBy('name')
            ->map(fn ($rows, $name) => ['name' => $name, 'reste' => round($rows->sum('reste'), 2)])
            ->sortByDesc('reste')
            ->values();
    }

    private function creditRows()
    {
        return Client::query()->whereNotNull('plafond')->get()->map(function (Client $client) {
            $snap = ClientPlafond::snapshot($client);
            $plafond = (float) $snap['plafond'];

            return [
                'name' => $client->name,
                'plafond' => $plafond,
                'solde' => (float) $snap['solde'],
                'reste' => (float) $snap['reste'],
                'over' => (float) $snap['solde'] > $plafond + 0.001,
                'ratio' => $plafond > 0 ? (float) $snap['solde'] / $plafond : 0,
            ];
        });
    }

    private function figures(): array
    {
        $creances = round(Client::query()->get()->sum(fn (Client $client) => ClientPlafond::solde($client->id)), 2);
        $dettes = round($this->openPurchases()->sum('reste'), 2);
        $entrees = (float) Payment::query()->where('type', 'client')->sum('amount');
        $sorties = (float) Payment::query()->whereIn('type', ['fournisseur', 'personnel'])->sum('amount');
        $tresorerie = round($entrees - $sorties, 2);

        return [
            'tresorerie' => $tresorerie,
            'creances' => $creances,
            'dettes' => $dettes,
            'net' => round($tresorerie + $creances - $dettes, 2),
        ];
    }

    private function findClient(string $q): ?Client
    {
        return $this->findParty(Client::query()->get(), $q);
    }

    private function findSupplier(string $q): ?Supplier
    {
        return $this->findParty(Supplier::query()->get(), $q);
    }

    private function findParty($rows, string $q): mixed
    {
        $best = null;
        $score = 0;
        foreach ($rows as $row) {
            $name = $this->prepare((string) $row->name);
            if (mb_strlen($name) >= 4 && str_contains($q, $name) && mb_strlen($name) > $score) {
                $best = $row;
                $score = mb_strlen($name);
            }
            foreach (preg_split('/\s+/', $name) ?: [] as $word) {
                if (mb_strlen($word) < 4 || $this->isGeneric($word)) {
                    continue;
                }
                if (preg_match('/\b'.preg_quote($word, '/').'\b/', $q) && mb_strlen($word) > $score) {
                    $best = $row;
                    $score = mb_strlen($word);
                }
            }
        }

        return $best;
    }

    private function clientFromContext(array $context, string $q): ?Client
    {
        if (($context['focus'] ?? null) === 'supplier' && ! preg_match('/\bclient\b/', $q)) {
            return null;
        }
        $id = $context['client_id'] ?? null;

        return $id ? Client::find($id) : null;
    }

    private function supplierFromContext(array $context, string $q): ?Supplier
    {
        if (($context['focus'] ?? null) === 'client' && ! preg_match('/\bfournisseur\b/', $q)) {
            return null;
        }
        $id = $context['supplier_id'] ?? null;

        return $id ? Supplier::find($id) : null;
    }

    private function pronoun(string $q): bool
    {
        return (bool) preg_match('/\b(lui|elle|son|sa|ses|ce client|cet client|ce fournisseur|cette societe)\b/', $q);
    }

    private function needsClient(string $intent): bool
    {
        return in_array($intent, ['plafond', 'encours', 'available', 'client_balance', 'client_invoices', 'client_payments', 'client_history', 'client_situation'], true);
    }

    private function needsSupplier(string $intent): bool
    {
        return in_array($intent, ['supplier_balance', 'supplier_payments', 'supplier_situation'], true);
    }

    private function suggestions(string $intent): array
    {
        return match ($intent) {
            'plafond', 'encours', 'available', 'client_balance' => ['Combien lui reste-t-il ?', 'Quel est son encours ?'],
            'client_situation', 'client_invoices', 'client_payments', 'client_history' => ['Ses factures', 'Ses règlements', 'Son historique'],
            'supplier_situation', 'supplier_payments' => ['Ses règlements', 'Quels fournisseurs devons-nous payer ?'],
            'balance', 'situation', 'report' => ['Quels fournisseurs devons-nous payer ?', 'Quelles sont les opérations urgentes ?'],
            'suppliers_to_pay', 'debts', 'cash_out_total' => ['Prépare la liste des bons fournisseurs en attente'],
            default => ['Donne-moi notre balance générale', 'Quelles sont les opérations urgentes ?'],
        };
    }

    private function out(string $reply, array $context, array $suggestions): array
    {
        return [
            'reply' => $reply,
            'context' => $context,
            'suggestions' => $suggestions,
            'module' => 'conversation',
        ];
    }

    private function prepare(string $value): string
    {
        $value = mb_strtolower($value);
        $value = strtr($value, [
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'à' => 'a', 'â' => 'a', 'ù' => 'u', 'û' => 'u',
            'ô' => 'o', 'î' => 'i', 'ï' => 'i', 'ç' => 'c',
        ]);
        $value = str_replace(['5'], 'kh', $value);
        $value = strtr($value, ['3' => 'a', '7' => 'h', '9' => 'q']);
        $value = str_replace(['’', '\''], ' ', $value);

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value);
    }

    private function isGeneric(string $word): bool
    {
        return in_array($word, ['societe', 'ste', 'sarl', 'btp', 'client', 'clients', 'fournisseur', 'fournisseurs', 'atlas'], false)
            && $word !== 'atlas';
    }

    private function monthRange(): array
    {
        return [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()];
    }

    private function monthLabel(): string
    {
        return Carbon::now()->locale('fr')->isoFormat('MMMM YYYY');
    }

    private function money(float|int|string|null $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ');
    }
}
