<?php

namespace App\Support;

use App\Models\Chantier;
use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\ClientRelance;
use App\Models\Document;
use App\Models\Payment;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SaleOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\Task;
use App\Models\User;
use App\Support\Ghita\GhitaDossier;
use App\Support\Ghita\GhitaExecute;
use App\Support\Ghita\GhitaIntent;
use App\Support\Ghita\GhitaNavigate;

class GhitaAssistant
{
    public function intro(): array
    {
        return $this->pack($this->helloWord().'. Je vous écoute.');
    }

    public function reply(string $message, ?User $user = null, ?string $module = null, ?array $pending = null, array $context = []): array
    {
        $raw = trim($message);
        $raw = trim(preg_replace('/\b(ghita|guita|gita|rita|guida|jita)\b/iu', ' ', $raw) ?? $raw);
        $q = $this->fold($raw);
        $modules = new GhitaModules($user);
        if ($q === '') {
            return $this->intro();
        }
        if ($pending && ($pending['action'] ?? '') === 'balance_detail' && $modules->confirms($q)) {
            return $this->pack($this->balanceDetail(), null, 'analyse');
        }
        if ($pending && $modules->confirms($q)) {
            return $this->pack($modules->execute($pending), null, 'automatisation');
        }
        if ($pending && $modules->cancels($q)) {
            return $this->pack('C\'est annulé. Rien n\'est enregistré.', null, 'automatisation');
        }
        if ($this->isGreetingOnly($q)) {
            return $this->pack($this->greetingWord($q).'. Je vous écoute.');
        }
        if ($label = $modules->label($q)) {
            $brief = $modules->briefing($label);

            return $this->pack($brief['reply'], null, $label);
        }
        if ($this->isSmallTalk($q)) {
            return $this->pack($this->smallTalk($q));
        }
        if ($done = (new GhitaExecute)->act($raw, $q, $context, $pending)) {
            return $this->pack(
                $done['reply'],
                $done['pending'] ?? null,
                'automatisation',
                $done['suggestions'] ?? [],
                $done['context'] ?? $context,
                null,
                $done['refresh'] ?? null,
            );
        }
        if ($action = (new GhitaNavigate)->act($raw, $q, $context)) {
            return $this->pack(
                $action['reply'],
                null,
                'conversation',
                $action['suggestions'] ?? [],
                $action['context'] ?? $context,
                $action['navigate'] ?? null,
            );
        }
        if ($understood = (new GhitaIntent)->answer($raw, $q, $context)) {
            return $this->pack(
                $understood['reply'],
                $understood['pending'] ?? null,
                $understood['module'] ?? 'conversation',
                $understood['suggestions'] ?? null,
                $understood['context'] ?? $context,
            );
        }
        if ($this->asksBalance($q)) {
            return $this->pack($this->balanceOverview(), ['action' => 'balance_detail'], 'analyse');
        }
        if ($docs = $this->supplierDocsIntent($q)) {
            return $this->pack($docs);
        }
        $natural = $this->normalize($q);
        if ($loose = $this->loose($natural, $q)) {
            return $this->pack($loose);
        }
        $q = $natural;
        $active = $modules->detect($q);
        if ($active) {
            $result = $modules->handle($active, $raw, $q);
            if ($result) {
                return $this->pack($result['reply'], $result['pending'] ?? null, $active);
            }
        }

        if (str_contains($q, 'decaiss')) {
            return $this->pack($this->textDecaisser());
        }
        if (str_contains($q, 'encaiss') || str_contains($q, 'impay')) {
            return $this->pack($this->textEncaisser());
        }
        if (str_contains($q, 'rappel') || str_contains($q, 'relance')) {
            return $this->pack($this->textRelances());
        }

        $preferSupplier = str_contains($q, 'fournisseur');
        $client = $preferSupplier ? null : $this->findClient($raw, $q);
        $supplier = $this->findSupplier($raw, $q);
        if ($client && $supplier && ! $preferSupplier && str_contains($q, 'client')) {
            $supplier = null;
        }

        $wantsPayment = str_contains($q, 'reglement') || str_contains($q, 'paiement');
        $wantsOrder = str_contains($q, 'bon') || str_contains($q, 'commande');
        $wantsPrepare = (bool) preg_match('/\b(prepare|prépare|remplis|remplir|cree|créer|envoie|envoyer)\b/u', $raw)
            || str_contains($q, 'prepar');
        $wantsMessage = str_contains($q, 'message') || str_contains($q, 'dis lui') || str_contains($q, 'dis-lui');

        if ($wantsPrepare && $wantsMessage && $client) {
            return $this->pack($this->draftMessage($client, $raw));
        }
        if ($wantsPrepare && $wantsPayment && $client) {
            return $this->pack($this->draftClientPayment($client, $raw));
        }
        if ($wantsPrepare && $wantsPayment && $supplier) {
            return $this->pack($this->draftSupplierPayment($supplier, $raw));
        }
        if ($wantsPrepare && $wantsOrder && $supplier) {
            return $this->pack($this->draftOrder('achat', $supplier->name, $supplier->code, $raw));
        }
        if ($wantsPrepare && $wantsOrder && $client) {
            return $this->pack($this->draftOrder('vente', $client->name, $client->code, $raw));
        }
        if ($wantsPayment && $client) {
            return $this->pack($this->textClientPayments($client));
        }
        if ($wantsPayment && $supplier) {
            return $this->pack($this->textSupplierPayments($supplier));
        }
        if ($wantsOrder && $client) {
            return $this->pack($this->textClientOrders($client));
        }
        if ($wantsOrder && $supplier) {
            return $this->pack($this->textSupplierOrders($supplier));
        }
        if ($client && str_contains($q, 'plafond')) {
            return $this->pack($this->textPlafond($client));
        }
        if ($client) {
            return $this->pack($this->textClient($client));
        }
        if ($supplier) {
            return $this->pack($this->textSupplier($supplier));
        }
        if ($wantsPayment) {
            return $this->pack($this->textRecentPayments());
        }
        if (str_contains($q, 'solde')) {
            return $this->pack($this->textTopBalances());
        }

        return $this->pack('Précisez la demande : clients, fournisseurs, trésorerie, plafond, ou le nom de la société.');
    }

    private function helloWord(): string
    {
        $hour = (int) now()->format('G');
        if ($hour >= 18 || $hour < 5) {
            return 'Bonsoir';
        }
        if ($hour >= 13) {
            return 'Bon après-midi';
        }

        return 'Bonjour';
    }

    private function greetingWord(string $q): string
    {
        if (str_contains($q, 'bonsoir') || str_contains($q, 'bonne soiree') || str_contains($q, 'bonne nuit')) {
            return 'Bonsoir';
        }
        if (str_contains($q, 'apres-midi') || str_contains($q, 'apres midi')) {
            return 'Bon après-midi';
        }
        if (str_contains($q, 'salut') || str_contains($q, 'coucou') || str_contains($q, 'hello') || preg_match('/\bhey\b/', $q)) {
            return 'Salut';
        }
        if (str_contains($q, 'bonjour')) {
            return 'Bonjour';
        }

        return $this->helloWord();
    }

    private function isGreetingOnly(string $q): bool
    {
        $rest = preg_replace('/\b(bonjour|bonsoir|salut|hello|coucou|hey|ghita|bonne|soiree|nuit|jour|apres-midi|apres|midi)\b/', ' ', $q) ?? $q;
        $rest = trim(preg_replace('/[^a-z0-9]+/', ' ', $rest) ?? '');

        return $rest === '';
    }

    private function isSmallTalk(string $q): bool
    {
        return (bool) preg_match('/\b(merci|daccord|ok|oui|non|au revoir|a plus|ca va|comment vas|comment allez|qui es tu|qui etes vous|aide)\b/', $q)
            && ! preg_match('/\b(client|fournisseur|solde|reglement|paiement|bon|commande|encaiss|decaiss|rappel|relance|plafond)\b/', $q);
    }

    private function smallTalk(string $q): string
    {
        if (str_contains($q, 'merci')) {
            return 'Je vous en prie.';
        }
        if (str_contains($q, 'au revoir') || str_contains($q, 'a plus')) {
            return 'À bientôt.';
        }
        if (str_contains($q, 'ca va') || str_contains($q, 'comment vas') || str_contains($q, 'comment allez')) {
            return 'Ça va. Dites-moi ce que vous cherchez.';
        }
        if (str_contains($q, 'qui es') || str_contains($q, 'qui etes') || $q === 'aide') {
            return 'Je suis Ghita. J\'étudie les chiffres, les projets et les décisions. Si une idée n\'est pas tenable, je le dis.';
        }
        if ($q === 'oui' || $q === 'ok' || $q === 'daccord') {
            return 'D\'accord. Précisez le client, le montant, ou la question.';
        }
        if ($q === 'non') {
            return 'Très bien. On laisse comme ça.';
        }

        return 'Je vous écoute.';
    }

    private function textPlafond(Client $client): string
    {
        $snap = ClientPlafond::snapshot($client);
        if ($snap['plafond'] === null) {
            return 'Aucun plafond n\'est enregistré pour '.$client->name.'. Je n\'en invente pas.';
        }

        return 'Le plafond de crédit autorisé pour '.$client->name.' est de '.$this->money($snap['plafond']).' DH. Son encours actuel est de '.$this->money($snap['solde']).' DH et il lui reste '.$this->money($snap['reste']).' DH de disponibilité.';
    }

    private function clientCensus(bool $denies): string
    {
        $total = Client::query()->count();
        $inactifs = Client::query()->where('status', 'inactif')->count();
        $actifs = $total - $inactifs;
        if ($denies) {
            return $total === 0
                ? 'Non. BatiXpert n\'a aucun client enregistré.'
                : 'Si. BatiXpert compte '.$total.' '.($total > 1 ? 'clients enregistrés' : 'client enregistré').'.';
        }
        if ($total === 0) {
            return 'BatiXpert n\'a aucun client enregistré.';
        }

        $registered = $total > 1 ? 'clients enregistrés' : 'client enregistré';
        $active = $actifs > 1 ? 'actifs' : 'actif';
        $inactive = $inactifs > 1 ? 'inactifs' : 'inactif';

        return 'BatiXpert compte actuellement '.$total.' '.$registered.', dont '.$actifs.' '.$active.' et '.$inactifs.' '.$inactive.'.';
    }

    private function asksBalance(string $q): bool
    {
        return (bool) preg_match('/\b(balance|tresorerie|situation financiere)\b/', $q);
    }

    private function balanceOverview(): string
    {
        $figures = $this->balanceFigures();

        return 'Voici la situation financière générale de BatiXpert : solde de trésorerie '.$this->money($figures['tresorerie']).' DH, créances clients '.$this->money($figures['creances']).' DH, dettes fournisseurs '.$this->money($figures['dettes']).' DH et solde net '.$this->money($figures['net']).' DH. Souhaites-tu également le détail par compte ?';
    }

    private function balanceDetail(): string
    {
        $lines = ['Détail par compte.'];
        $shown = false;
        foreach (Client::query()->orderBy('name')->get() as $client) {
            $solde = ClientPlafond::solde($client->id);
            if ($solde <= 0) {
                continue;
            }
            $shown = true;
            $lines[] = 'Créance '.$client->name.' : '.$this->money($solde).' DH.';
        }
        foreach (Supplier::query()->orderBy('name')->get() as $supplier) {
            $achats = (float) PurchaseOrder::query()->where('supplier_id', $supplier->id)->where('status', '!=', 'annule')->sum('total_ttc');
            $paye = (float) SupplierPayment::query()->where('supplier_id', $supplier->id)->sum('montant');
            $solde = round(max($achats - $paye, 0), 2);
            if ($solde <= 0) {
                continue;
            }
            $shown = true;
            $lines[] = 'Dette '.$supplier->name.' : '.$this->money($solde).' DH.';
        }
        if (! $shown) {
            $lines[] = 'Aucun compte client ou fournisseur n\'a de solde ouvert.';
        }

        return implode("\n", $lines);
    }

    private function balanceFigures(): array
    {
        $creances = round(Client::query()->get()->sum(fn (Client $client) => ClientPlafond::solde($client->id)), 2);
        $dettes = round((float) PurchaseOrder::query()
            ->where('status', '!=', 'annule')
            ->selectRaw('COALESCE(SUM(GREATEST(ROUND(total_ttc - COALESCE(montant_paye, 0), 2), 0)), 0) as reste')
            ->value('reste'), 2);
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

    private function supplierDocsIntent(string $q): ?string
    {
        $aboutOrders = (bool) preg_match('/\bbons?\b/', $q);
        $aboutSuppliers = str_contains($q, 'fournisseur');
        $aboutSending = (bool) preg_match('/\b(envoyer|envoi|envoie|transmettre|preparer|expedier|jai)\b/', $q);
        if ($aboutOrders && $aboutSuppliers && $aboutSending) {
            return 'Tu souhaites préparer les bons de commande fournisseurs ou transmettre les bons de règlement ? Je peux vérifier les documents en attente.';
        }

        return null;
    }

    private function textClient(Client $client): string
    {
        return (new GhitaDossier)->readClient($client);
    }

    private function textSupplier(Supplier $supplier): string
    {
        return (new GhitaDossier)->readSupplier($supplier);
    }

    private function textEncaisser(): string
    {
        $rows = SaleOrder::query()
            ->with('client')
            ->where('status', '!=', 'annule')
            ->whereRaw('ROUND(total_ttc - COALESCE(montant_paye, 0), 2) > 0.009')
            ->orderByDesc('order_date')
            ->limit(6)
            ->get();

        $total = (float) SaleOrder::query()
            ->where('status', '!=', 'annule')
            ->selectRaw('COALESCE(SUM(GREATEST(ROUND(total_ttc - COALESCE(montant_paye, 0), 2), 0)), 0) as reste')
            ->value('reste');

        if ($rows->isEmpty()) {
            return 'Rien à encaisser. Les bons de vente ouverts sont soldés.';
        }

        $lines = ['Il reste '.$this->money($total).' à encaisser.'];
        foreach ($rows as $order) {
            $reste = round((float) $order->total_ttc - (float) ($order->montant_paye ?? 0), 2);
            $who = $order->client?->name ?: 'Client';
            $lines[] = $who.' · '.($order->reference ?: 'bon').' · '.$this->money($reste).' · '.optional($order->order_date)->format('d/m/Y').'.';
        }

        return implode("\n", $lines);
    }

    private function textDecaisser(): string
    {
        $rows = PurchaseOrder::query()
            ->with('supplier')
            ->where('status', '!=', 'annule')
            ->whereRaw('ROUND(total_ttc - COALESCE(montant_paye, 0), 2) > 0.009')
            ->orderByDesc('order_date')
            ->limit(6)
            ->get();

        $total = (float) PurchaseOrder::query()
            ->where('status', '!=', 'annule')
            ->selectRaw('COALESCE(SUM(GREATEST(ROUND(total_ttc - COALESCE(montant_paye, 0), 2), 0)), 0) as reste')
            ->value('reste');

        if ($rows->isEmpty()) {
            return 'Rien à décaisser. Les bons d\'achat ouverts sont soldés.';
        }

        $lines = ['Il reste '.$this->money($total).' à décaisser.'];
        foreach ($rows as $order) {
            $reste = round((float) $order->total_ttc - (float) ($order->montant_paye ?? 0), 2);
            $who = $order->supplier?->name ?: 'Fournisseur';
            $lines[] = $who.' · '.($order->reference ?: 'bon').' · '.$this->money($reste).' · '.optional($order->order_date)->format('d/m/Y').'.';
        }

        return implode("\n", $lines);
    }

    private function textRelances(): string
    {
        $rows = ClientRelance::query()
            ->whereNotNull('date_rappel')
            ->whereDate('date_rappel', '<=', today())
            ->orderBy('date_rappel')
            ->limit(8)
            ->get();

        if ($rows->isEmpty()) {
            return 'Aucun rappel dû aujourd\'hui. Les dates à venir ne vous alertent pas.';
        }

        $lines = [$rows->count().' rappel'.($rows->count() > 1 ? 's' : '').' à traiter.'];
        foreach ($rows as $row) {
            $when = $row->date_rappel->isToday() ? 'Aujourd\'hui' : 'En retard · '.$row->date_rappel->format('d/m/Y');
            $who = $row->client_name ?: 'Client';
            $lines[] = $when.' · '.$who.' · '.$this->motif($row->motif).'.';
        }

        return implode("\n", $lines);
    }

    private function textClientPayments(Client $client): string
    {
        $rows = ClientPayment::query()
            ->where('client_id', $client->id)
            ->orderByDesc('payment_date')
            ->limit(5)
            ->get();

        if ($rows->isEmpty()) {
            return 'Aucun règlement enregistré pour '.$client->name.'.';
        }

        $lines = ['Derniers règlements de '.$client->name.'.'];
        foreach ($rows as $row) {
            $lines[] = optional($row->payment_date)->format('d/m/Y').' · '.$this->money($row->montant).' · '.($row->statut ?: '—').' · '.($row->reference ?: '').'.';
        }

        return implode("\n", $lines);
    }

    private function textSupplierPayments(Supplier $supplier): string
    {
        $rows = SupplierPayment::query()
            ->where('supplier_id', $supplier->id)
            ->orderByDesc('payment_date')
            ->limit(5)
            ->get();

        if ($rows->isEmpty()) {
            return 'Aucun règlement enregistré pour '.$supplier->name.'.';
        }

        $lines = ['Derniers règlements de '.$supplier->name.'.'];
        foreach ($rows as $row) {
            $lines[] = optional($row->payment_date)->format('d/m/Y').' · '.$this->money($row->montant).' · '.($row->statut ?: '—').' · '.($row->reference ?: '').'.';
        }

        return implode("\n", $lines);
    }

    private function textClientOrders(Client $client): string
    {
        $rows = SaleOrder::query()
            ->where('client_id', $client->id)
            ->orderByDesc('order_date')
            ->limit(4)
            ->get();

        if ($rows->isEmpty()) {
            return 'Aucun bon de vente pour '.$client->name.'.';
        }

        $lines = ['Derniers bons de vente de '.$client->name.'.'];
        foreach ($rows as $row) {
            $reste = round((float) $row->total_ttc - (float) ($row->montant_paye ?? 0), 2);
            $lines[] = ($row->reference ?: 'Bon').' · '.optional($row->order_date)->format('d/m/Y').' · '.$this->money($row->total_ttc).' · reste '.$this->money($reste).'.';
        }

        return implode("\n", $lines);
    }

    private function textSupplierOrders(Supplier $supplier): string
    {
        $rows = PurchaseOrder::query()
            ->where('supplier_id', $supplier->id)
            ->orderByDesc('order_date')
            ->limit(4)
            ->get();

        if ($rows->isEmpty()) {
            return 'Aucun bon d\'achat pour '.$supplier->name.'.';
        }

        $lines = ['Derniers bons d\'achat de '.$supplier->name.'.'];
        foreach ($rows as $row) {
            $reste = round((float) $row->total_ttc - (float) ($row->montant_paye ?? 0), 2);
            $lines[] = ($row->reference ?: 'Bon').' · '.optional($row->order_date)->format('d/m/Y').' · '.$this->money($row->total_ttc).' · reste '.$this->money($reste).'.';
        }

        return implode("\n", $lines);
    }

    private function textRecentPayments(): string
    {
        $clients = ClientPayment::query()->orderByDesc('payment_date')->limit(3)->get();
        $suppliers = SupplierPayment::query()->with('supplier')->orderByDesc('payment_date')->limit(3)->get();
        if ($clients->isEmpty() && $suppliers->isEmpty()) {
            return 'Aucun règlement enregistré.';
        }

        $lines = ['Derniers règlements.'];
        foreach ($clients as $row) {
            $lines[] = 'Encaissement · '.($row->client_name ?: 'Client').' · '.optional($row->payment_date)->format('d/m/Y').' · '.$this->money($row->montant).'.';
        }
        foreach ($suppliers as $row) {
            $lines[] = 'Décaissement · '.($row->supplier?->name ?: 'Fournisseur').' · '.optional($row->payment_date)->format('d/m/Y').' · '.$this->money($row->montant).'.';
        }

        return implode("\n", $lines);
    }

    private function textTopBalances(): string
    {
        $clients = Client::query()->orderBy('name')->limit(40)->get();
        $rows = $clients->map(function (Client $client) {
            return ['name' => $client->name, 'solde' => ClientPlafond::solde($client->id)];
        })->sortByDesc('solde')->take(5)->values();

        if ($rows->isEmpty()) {
            return 'Aucun client enregistré.';
        }

        $lines = ['Soldes clients les plus élevés.'];
        foreach ($rows as $row) {
            $lines[] = $row['name'].' · '.$this->money($row['solde']).'.';
        }

        return implode("\n", $lines);
    }

    private function draftClientPayment(Client $client, string $raw): string
    {
        $amount = $this->extractAmount($raw);
        $amountText = $amount === null ? 'montant à préciser' : $this->money($amount);

        return "Exemple, je ne l'enregistre pas encore.\nRèglement client\n".$client->name.' · '.$client->code."\nMontant : ".$amountText."\nDate : ".now()->format('d/m/Y')."\nDites-moi si le client ou le montant est à corriger. J'enregistrerai quand vous validerez.";
    }

    private function draftSupplierPayment(Supplier $supplier, string $raw): string
    {
        $amount = $this->extractAmount($raw);
        $amountText = $amount === null ? 'montant à préciser' : $this->money($amount);

        return "Exemple, je ne l'enregistre pas encore.\nRèglement fournisseur\n".$supplier->name.' · '.$supplier->code."\nMontant : ".$amountText."\nDate : ".now()->format('d/m/Y')."\nDites-moi si le fournisseur ou le montant est à corriger. J'enregistrerai quand vous validerez.";
    }

    private function draftOrder(string $kind, string $name, string $code, string $raw): string
    {
        $label = $kind === 'achat' ? 'Bon d\'achat' : 'Bon de vente';
        $amount = $this->extractAmount($raw);
        $amountLine = $amount === null ? 'Article, quantité et prix : à préciser.' : 'Montant indiqué : '.$this->money($amount).'.';

        return "Exemple, je ne crée pas le bon tant que vous n'avez pas validé.\n{$label}\n{$name} · {$code}\nDate : ".now()->format('d/m/Y')."\n{$amountLine}";
    }

    private function draftMessage(Client $client, string $raw): string
    {
        $body = trim((string) preg_replace('/^.*?:\s*/u', '', $raw));
        if ($body === '' || $this->fold($body) === $this->fold($raw)) {
            $body = 'Le texte du message est à préciser.';
        }

        return "Exemple, je n'envoie pas le message tant que vous n'avez pas validé.\nPour ".$client->name." · ".$client->code.", sur son portail :\n".$body;
    }

    private function findClient(string $raw, string $q): ?Client
    {
        if (preg_match('/cr\s*[- ]?\s*(\d{1,6})/i', $raw, $m)) {
            $client = Client::find((int) $m[1]);
            if ($client) {
                return $client;
            }
        }

        return $this->matchParty(Client::query()->get(), $q);
    }

    private function findSupplier(string $raw, string $q): ?Supplier
    {
        if (preg_match('/cf\s*[- ]?\s*(\d{1,6})/i', $raw, $m)) {
            $supplier = Supplier::find((int) $m[1]);
            if ($supplier) {
                return $supplier;
            }
        }

        return $this->matchParty(Supplier::query()->get(), $q);
    }

    private function matchParty($rows, string $q): mixed
    {
        $best = null;
        $bestScore = 0;
        $tokens = $this->tokens($q);

        foreach ($rows as $row) {
            $name = $this->fold((string) $row->name);
            if ($name !== '' && mb_strlen($name) >= 4 && str_contains($q, $name) && mb_strlen($name) > $bestScore) {
                $best = $row;
                $bestScore = mb_strlen($name);
                continue;
            }
            foreach ($tokens as $token) {
                if (str_contains($name, $token) && mb_strlen($token) > $bestScore) {
                    $best = $row;
                    $bestScore = mb_strlen($token);
                    continue;
                }
                foreach (preg_split('/\s+/', $name) ?: [] as $word) {
                    if (mb_strlen($word) < 4 || abs(mb_strlen($word) - mb_strlen($token)) > 2) {
                        continue;
                    }
                    $limit = mb_strlen($token) >= 8 ? 2 : 1;
                    if (levenshtein($token, $word) <= $limit && mb_strlen($token) > $bestScore) {
                        $best = $row;
                        $bestScore = mb_strlen($token);
                    }
                }
            }
        }

        return $best;
    }

    private function tokens(string $q): array
    {
        $stop = [
            'solde', 'client', 'clients', 'fournisseur', 'fournisseurs', 'reglement', 'reglements',
            'paiement', 'paiements', 'commande', 'commandes', 'encaisser', 'decaisser', 'rappel',
            'rappels', 'relance', 'relances', 'quel', 'quelle', 'quels', 'est', 'sont', 'dans',
            'pour', 'avec', 'dernier', 'derniere', 'derniers', 'montre', 'donne', 'ghita',
            'aujourd', 'hui', 'reste', 'plafond', 'fiche', 'telephone', 'ville', 'montant',
            'message', 'prepare', 'preparer', 'bonjour', 'salut', 'exemple', 'vente', 'achat',
            'dernier', 'dis', 'lui', 'elle', 'nous', 'vous', 'cette', 'ceci', 'quoi', 'combien',
        ];

        preg_match_all('/[a-z0-9]{4,}/', $q, $m);

        return array_values(array_filter($m[0] ?? [], fn ($token) => ! in_array($token, $stop, true)));
    }

    private function extractAmount(string $raw): ?float
    {
        if (! preg_match('/(\d{1,3}(?:[ \x{00A0}.]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/u', $raw, $m)) {
            return null;
        }
        $token = str_replace(["\u{00A0}", ' '], '', $m[1]);
        if (str_contains($token, ',')) {
            $token = str_replace('.', '', $token);
            $token = str_replace(',', '.', $token);
        } elseif (preg_match('/^\d{1,3}(?:\.\d{3})+$/', $token)) {
            $token = str_replace('.', '', $token);
        }

        return round((float) $token, 2);
    }

    private function openCounts(): array
    {
        return [
            'encaisser' => (float) SaleOrder::query()
                ->where('status', '!=', 'annule')
                ->selectRaw('COALESCE(SUM(GREATEST(ROUND(total_ttc - COALESCE(montant_paye, 0), 2), 0)), 0) as reste')
                ->value('reste'),
            'decaisser' => (float) PurchaseOrder::query()
                ->where('status', '!=', 'annule')
                ->selectRaw('COALESCE(SUM(GREATEST(ROUND(total_ttc - COALESCE(montant_paye, 0), 2), 0)), 0) as reste')
                ->value('reste'),
            'rappels' => ClientRelance::query()
                ->whereNotNull('date_rappel')
                ->whereDate('date_rappel', '<=', today())
                ->count(),
        ];
    }

    private function pack(string $reply, ?array $pending = null, ?string $module = null, ?array $suggestions = null, ?array $context = null, ?string $navigate = null, ?array $refresh = null): array
    {
        return [
            'reply' => $reply,
            'speak' => preg_replace("/\n+/", '. ', $reply) ?? $reply,
            'suggestions' => [],
            'pending' => $pending,
            'module' => $module ?: 'conversation',
            'context' => $context,
            'navigate' => $navigate,
            'refresh' => $refresh,
        ];
    }

    private function money(float|int|string|null $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ');
    }

    private function motif(?string $motif): string
    {
        return match ($motif) {
            'relance' => 'Relance',
            'imp' => 'Impayé',
            'retard' => 'Retard',
            'recouv' => 'Recouvrement',
            default => 'Rappel',
        };
    }

    private function loose(string $natural, string $folded): ?string
    {
        if (preg_match('/\b(on en est|ca donne|bilan|situation)\b/', $folded)) {
            return (new GhitaModules)->handle('analyse', '', 'analyse')['reply'] ?? null;
        }

        $asksCount = (bool) preg_match('/\b(combien|nombre|cb)\b/', $natural);
        $asksExist = str_contains($folded, 'ya ') || str_starts_with($folded, 'ya ') || str_contains($folded, ' yen ') || str_contains($folded, 'aucun') || preg_match('/\bpas\b/', $folded);
        $topic = $this->topicOf($natural);
        if (! $asksCount && ! $asksExist && ! $this->isBareTopic($natural)) {
            return null;
        }
        if ($asksCount && ! $topic && $this->onlyCountWords($natural)) {
            return 'Combien de quoi ? Clients, fournisseurs, chantiers, ou le montant à décaisser.';
        }
        if (! $topic) {
            return null;
        }
        if (! $this->onlyCountWords($natural)) {
            return null;
        }

        $denies = (bool) preg_match('/\b(pas|aucun|aucune|sans)\b/', $folded);

        return $this->summarizeTopic($topic, $denies);
    }

    private function summarizeTopic(string $topic, bool $denies): string
    {
        if ($topic === 'client') {
            return $this->clientCensus($denies);
        }

        [$count, $one, $many, $sample] = match ($topic) {
            'client' => [Client::query()->count(), 'client', 'clients', Client::query()->orderBy('name')->limit(5)->pluck('name')->all()],
            'fournisseur' => [Supplier::query()->count(), 'fournisseur', 'fournisseurs', Supplier::query()->orderBy('name')->limit(5)->pluck('name')->all()],
            'chantier' => [
                Chantier::query()->where('archived', false)->where('status', 'en_cours')->count(),
                'chantier en cours',
                'chantiers en cours',
                Chantier::query()->where('archived', false)->where('status', 'en_cours')->orderBy('name')->limit(5)->pluck('name')->all(),
            ],
            'produit' => [Product::query()->count(), 'produit', 'produits', Product::query()->orderBy('name')->limit(5)->pluck('name')->all()],
            'document' => [Document::query()->count(), 'document', 'documents', Document::query()->latest()->limit(5)->pluck('title')->filter()->values()->all()],
            'tache' => [Task::query()->count(), 'tâche', 'tâches', Task::query()->latest()->limit(5)->pluck('title')->all()],
            'relance' => [
                ClientRelance::query()->whereNotNull('date_rappel')->whereDate('date_rappel', '<=', today())->count(),
                'rappel dû',
                'rappels dûs',
                ClientRelance::query()->whereNotNull('date_rappel')->whereDate('date_rappel', '<=', today())->limit(5)->pluck('client_name')->all(),
            ],
            'vente' => [SaleOrder::query()->where('status', '!=', 'annule')->count(), 'bon de vente', 'bons de vente', []],
            'achat' => [PurchaseOrder::query()->where('status', '!=', 'annule')->count(), 'bon d\'achat', 'bons d\'achat', []],
            default => [0, $topic, $topic.'s', []],
        };

        if ($topic === 'encaisser') {
            return $this->textEncaisser();
        }
        if ($topic === 'decaisser') {
            return $this->textDecaisser();
        }
        if ($topic === 'solde') {
            return $this->textTopBalances();
        }

        $count = (int) $count;
        $label = $count > 1 ? $many : $one;
        if ($denies) {
            return $count === 0
                ? 'Non. Aucun '.$one.'.'
                : 'Si. Il y a '.$count.' '.$label.'.';
        }
        if ($count === 0) {
            return 'Aucun '.$one.'.';
        }

        $text = 'Il y a '.$count.' '.$label.'.';
        $sample = array_values(array_filter($sample));
        if ($sample) {
            $text .= ' '.implode(', ', $sample).'.';
        }

        return $text;
    }

    private function topicOf(string $q): ?string
    {
        foreach (['encaisser', 'decaisser', 'client', 'fournisseur', 'chantier', 'produit', 'document', 'tache', 'relance', 'vente', 'achat', 'solde'] as $topic) {
            if (preg_match('/\b'.$topic.'\b/', $q)) {
                return $topic;
            }
        }

        return null;
    }

    private function isBareTopic(string $natural): bool
    {
        return $this->topicOf($natural) !== null && $this->onlyCountWords($natural);
    }

    private function onlyCountWords(string $natural): bool
    {
        $rest = trim((string) preg_replace('/\b(combien|nombre|cb|liste|quel|quels|quelle|montre|donne|voir|cest|quoi|comment|tout|tous|toutes|doit|doivent|reste|total|chiffre|montant|global|ensemble|ouvert|ouverts|encours|client|fournisseur|chantier|produit|document|tache|relance|vente|achat|solde|encaisser|decaisser|plafond|reglement|pas|aucun|aucune|sans)\b/', ' ', $natural));

        return trim((string) preg_replace('/\s+/', ' ', $rest)) === '';
    }

    private function normalize(string $q): string
    {
        $words = preg_split('/\s+/', $q) ?: [];
        $kept = [];
        foreach ($words as $word) {
            $canon = $this->canonToken($word);
            if ($canon !== null && $canon !== '') {
                $kept[] = $canon;
            }
        }

        return implode(' ', $kept);
    }

    private function canonToken(string $token): ?string
    {
        if ($token === '' || in_array($token, $this->fillers(), true)) {
            return null;
        }
        foreach ($this->lexicon() as $canon => $aliases) {
            if ($token === $canon || in_array($token, $aliases, true)) {
                return $canon;
            }
        }
        $stem = (string) preg_replace('/s$/', '', $token);
        if ($stem !== $token && mb_strlen($stem) >= 4) {
            foreach ($this->lexicon() as $canon => $aliases) {
                if ($stem === $canon || in_array($stem, $aliases, true)) {
                    return $canon;
                }
            }
        }
        if (mb_strlen($token) < 4) {
            return $token;
        }

        $best = null;
        $bestDistance = 99;
        foreach ($this->lexicon() as $canon => $aliases) {
            foreach (array_merge([$canon], $aliases) as $alias) {
                if (abs(mb_strlen($alias) - mb_strlen($token)) > 2) {
                    continue;
                }
                $distance = levenshtein($token, $alias);
                if ($distance < $bestDistance) {
                    $bestDistance = $distance;
                    $best = $canon;
                }
            }
        }
        $limit = mb_strlen($token) >= 8 ? 2 : 1;

        return ($best !== null && $bestDistance <= $limit) ? $best : $token;
    }

    private function fillers(): array
    {
        return [
            'ya', 'yen', 'yena', 'y', 'a', 'de', 'des', 'du', 'd', 'le', 'la', 'les', 'l', 'un', 'une',
            'que', 'qui', 'quoi', 'est', 'ce', 'cest', 'dans', 'pour', 'avec', 'au', 'aux', 'en', 'et', 'ou',
            'donc', 'alors', 'ben', 'euh', 'stp', 'svp', 'sil', 'plait', 'dis', 'moi', 'toi', 'tu', 'me',
            'jai', 'j', 'g', 'on', 'nous', 'vous', 'il', 'elle', 'ils', 'elles', 'ca', 'sa', 'mon', 'ma', 'mes',
            'ton', 'ta', 'tes', 'son', 'ses', 'votre', 'vos', 'notre', 'nos', 'aussi', 'juste', 'donc', 'the',
            'sont', 'fait', 'fais', 'savoir', 'peux', 'peut', 'peuvent', 'avoir', 'as', 'ai', 'ont', 'eu',
        ];
    }

    private function lexicon(): array
    {
        return [
            'client' => ['clients', 'clt', 'clts', 'clien', 'clent', 'clents', 'clientes', 'klien'],
            'fournisseur' => ['fournisseurs', 'fourniseur', 'fourniseurs', 'fournis', 'frs', 'fournisseurs'],
            'chantier' => ['chantiers', 'chantie', 'channtier', 'chantiers'],
            'produit' => ['produits', 'article', 'articles', 'produi'],
            'document' => ['documents', 'doc', 'docs', 'pdf', 'excel', 'word'],
            'tache' => ['taches', 'tach', 'tachhe'],
            'relance' => ['relances', 'rappel', 'rappels', 'relances'],
            'encaisser' => ['encaisse', 'encaissement', 'impaye', 'impayes', 'impaye'],
            'decaisser' => ['decaisse', 'decaissement', 'decaisser'],
            'vente' => ['ventes', 'vante', 'ventes'],
            'achat' => ['achats'],
            'acheter' => ['achete', 'acheter', 'achter', 'achetez'],
            'solde' => ['soldes', 'sold'],
            'plafond' => ['plafonds', 'plafon', 'plafodn', 'plafonnd', 'plafont', 'plafond'],
            'combien' => ['conbien', 'combient', 'combein', 'combiens', 'cb', 'cmbn', 'comb1en'],
            'nombre' => ['nbr', 'nb', 'nbre'],
            'reglement' => ['reglements', 'paiement', 'paiements', 'reglement'],
        ];
    }

    private function fold(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = strtr($value, [
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'à' => 'a', 'â' => 'a', 'ä' => 'a',
            'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ô' => 'o', 'ö' => 'o',
            'î' => 'i', 'ï' => 'i',
            'ç' => 'c',
        ]);
        $value = str_replace(['’', "'"], ' ', $value);
        $value = str_replace('-', ' ', $value);
        $value = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $value) ?? $value;

        return preg_replace('/\s+/', ' ', $value) ?? $value;
    }
}
