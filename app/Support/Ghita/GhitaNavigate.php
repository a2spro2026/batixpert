<?php

namespace App\Support\Ghita;

use App\Models\Client;
use App\Models\Supplier;

class GhitaNavigate
{
    public function act(string $raw, string $folded, array $context = []): ?array
    {
        $q = $this->stripName($this->prepare($folded));
        if ($q === '') {
            return null;
        }

        if ($this->wantsPrint($q)) {
            return $this->printBalance($raw, $q, $context);
        }

        if (! $this->wantsOpen($q)) {
            return null;
        }

        if (preg_match('/\b(plafond|encours|solde|creance|dette|combien|pourquoi|impay|urgent)\b/', $q)
            && ! preg_match('/\b(balance|releve|bon|section|menu|fiche)\b/', $q)) {
            return null;
        }

        $page = $this->resolvePage($raw, $q, $context);
        if ($page === null) {
            return $this->out('Quelle section dois-je ouvrir ?', $context, [
                'Ouvre la section fournisseur',
                'Ouvre la section client',
                'Ouvre un bon d\'achat vide',
                'Ouvre un bon de vente vide',
            ]);
        }

        if (! empty($page['closed'])) {
            return $this->out($page['label'].' n\'est pas encore disponible. Je ne l\'ouvre pas.', $context, [
                'Ouvre la section fournisseur',
                'Ouvre la section client',
            ]);
        }

        $path = $page['path'];
        $query = $page['query'] ?? [];
        if ($query) {
            $path .= (str_contains($path, '?') ? '&' : '?').http_build_query($query);
        }

        return $this->out('J\'ouvre '.$page['label'].'.', $context, $page['suggestions'] ?? [], $path);
    }

    private function resolvePage(string $raw, string $q, array $context): ?array
    {
        $blank = (bool) preg_match('/\b(vide|nouveau|nouvelle|neuf|neuve|creer|cree)\b/', $q);
        $dates = $this->extractDates($raw);
        $mois = $this->extractMonth($raw, $q, $dates);
        $client = $this->findClient($raw, $q) ?: (($this->pronoun($q) && ($context['focus'] ?? null) === 'client') ? $this->clientFromContext($context) : null);
        $supplier = $this->findSupplier($raw, $q) ?: (($this->pronoun($q) && ($context['focus'] ?? null) === 'supplier') ? $this->supplierFromContext($context) : null);

        if ($blank && preg_match('/\b(achat|achats)\b/', $q) && preg_match('/\bbons?\b/', $q)) {
            return [
                'path' => '/fournisseurs/bons-achats',
                'label' => 'un bon d\'achat vide',
                'query' => ['nouveau' => 1],
            ];
        }
        if ($blank && preg_match('/\b(vente|ventes)\b/', $q) && preg_match('/\bbons?\b/', $q)) {
            return [
                'path' => '/clients/bons-de-vente',
                'label' => 'un bon de vente vide',
                'query' => ['nouveau' => 1],
            ];
        }

        if (preg_match('/\breleve\b/', $q) && preg_match('/\bfournisseur/', $q)) {
            $query = array_filter([
                'date_from' => $dates[0] ?? null,
                'date_to' => $dates[1] ?? ($dates[0] ?? null),
                'supplier_id' => $supplier?->id,
            ], fn ($value) => $value !== null && $value !== '');

            return [
                'path' => '/fournisseurs/releve-compte',
                'label' => 'le relevé compte fournisseur'.($supplier ? ' de '.$supplier->name : ''),
                'query' => $query,
            ];
        }
        if (preg_match('/\breleve\b/', $q) && preg_match('/\bclient/', $q)) {
            $query = array_filter([
                'mois' => $mois,
                'client_id' => $client?->id,
            ], fn ($value) => $value !== null && $value !== '');

            return [
                'path' => '/clients/releve-compte',
                'label' => 'le relevé compte client'.($client ? ' de '.$client->name : ''),
                'query' => $query,
            ];
        }

        if (preg_match('/\bbalance\b/', $q) && preg_match('/\bfournisseur/', $q)) {
            $query = array_filter([
                'mois' => $mois,
                'supplier_id' => $supplier?->id,
                'print' => str_contains($q, 'imprim') ? 1 : null,
            ], fn ($value) => $value !== null && $value !== '');

            return [
                'path' => '/fournisseurs/balance',
                'label' => 'la balance fournisseur'.($supplier ? ' de '.$supplier->name : ''),
                'query' => $query,
            ];
        }
        if (preg_match('/\bbalance\b/', $q) && (preg_match('/\bclient/', $q) || $client)) {
            $query = array_filter([
                'mois' => $mois,
                'client_id' => $client?->id,
                'print' => str_contains($q, 'imprim') ? 1 : null,
            ], fn ($value) => $value !== null && $value !== '');

            return [
                'path' => '/clients/balance',
                'label' => 'la balance client'.($client ? ' de '.$client->name : ''),
                'query' => $query,
            ];
        }

        return $this->matchPage($q);
    }

    private function printBalance(string $raw, string $q, array $context): array
    {
        if (! str_contains($q, 'balance')) {
            return $this->out('Je peux imprimer la balance d\'un client ou d\'un fournisseur. Dites le nom.', $context, [
                'Imprime la balance client',
                'Imprime la balance fournisseur',
            ]);
        }

        $client = $this->findClient($raw, $q);
        $supplier = $this->findSupplier($raw, $q);
        $saysClient = (bool) preg_match('/\bclients?\b/', $q);
        $saysSupplier = str_contains($q, 'fournisseur');
        $kind = null;
        if ($saysClient && ! $saysSupplier) {
            $kind = 'client';
        } elseif ($saysSupplier && ! $saysClient) {
            $kind = 'supplier';
        } elseif ($client && ! $supplier) {
            $kind = 'client';
        } elseif ($supplier && ! $client) {
            $kind = 'supplier';
        } elseif ($this->pronoun($q)) {
            $kind = ($context['focus'] ?? null) === 'supplier' ? 'supplier' : (($context['focus'] ?? null) === 'client' ? 'client' : null);
        }
        if ($kind === null) {
            return $this->out('Balance client ou balance fournisseur ?', $context, [
                'Imprime la balance client',
                'Imprime la balance fournisseur',
            ]);
        }
        if ($kind === 'client') {
            $client = $client ?: $this->clientFromContext($context);
            $query = ['print' => 1];
            $next = $context;
            if ($client) {
                $query['client_id'] = $client->id;
                $next['focus'] = 'client';
                $next['client_id'] = $client->id;
                $next['client_name'] = $client->name;
            }

            return $this->out('J\'imprime la balance '.($client ? 'de '.$client->name : 'des clients').'.', $next, [], '/clients/balance?'.http_build_query($query));
        }
        $supplier = $supplier ?: $this->supplierFromContext($context);
        $query = ['print' => 1];
        $next = $context;
        if ($supplier) {
            $query['supplier_id'] = $supplier->id;
            $next['focus'] = 'supplier';
            $next['supplier_id'] = $supplier->id;
            $next['supplier_name'] = $supplier->name;
        }

        return $this->out('J\'imprime la balance '.($supplier ? 'de '.$supplier->name : 'des fournisseurs').'.', $next, [], '/fournisseurs/balance?'.http_build_query($query));
    }

    private function matchPage(string $q): ?array
    {
        $best = null;
        $bestScore = 0;
        foreach ($this->pages() as $page) {
            foreach ($page['keys'] as $key) {
                $score = $this->keyScore($q, $key);
                if ($score > $bestScore) {
                    $best = $page;
                    $bestScore = $score;
                }
            }
            foreach ($page['fuzzy'] ?? [] as $word) {
                if ($this->hasFuzzy($q, $word)) {
                    $score = 40 + mb_strlen($word);
                    if ($score > $bestScore) {
                        $best = $page;
                        $bestScore = $score;
                    }
                }
            }
        }

        return $bestScore >= 40 ? $best : null;
    }

    private function keyScore(string $q, string $key): int
    {
        if ($this->containsKey($q, $key)) {
            return 100 + mb_strlen($key);
        }
        $words = preg_split('/\s+/', $key) ?: [];
        $hits = 0;
        foreach ($words as $word) {
            if ($this->hasFuzzy($q, $word)) {
                $hits++;
            }
        }
        if ($hits === 0) {
            return 0;
        }
        if ($hits === count($words)) {
            return 80 + mb_strlen($key);
        }

        return $hits >= 1 && count($words) === 1 ? 50 + mb_strlen($key) : 0;
    }

    private function containsKey(string $q, string $key): bool
    {
        $words = preg_split('/\s+/', $key) ?: [];
        $parts = array_map(function ($word) {
            $stem = str_ends_with($word, 's') ? substr($word, 0, -1) : $word;

            return preg_quote($stem, '/').'s?';
        }, $words);
        $pattern = implode('(?:\s+\w+){0,3}\s+', $parts);

        return (bool) preg_match('/(?:^|\s)'.$pattern.'(?:\s|$)/', $q);
    }

    private function hasFuzzy(string $q, string $word): bool
    {
        $stem = str_ends_with($word, 's') ? substr($word, 0, -1) : $word;
        if (preg_match('/\b'.preg_quote($stem, '/').'s?\b/', $q)) {
            return true;
        }
        foreach (preg_split('/\s+/', $q) ?: [] as $token) {
            if (mb_strlen($token) < 4 || mb_strlen($stem) < 4) {
                continue;
            }
            if (abs(mb_strlen($token) - mb_strlen($stem)) > 2) {
                continue;
            }
            if (levenshtein($token, $stem) <= 2) {
                return true;
            }
        }

        return false;
    }

    private function pages(): array
    {
        return [
            ['path' => '/', 'label' => 'le tableau de bord', 'keys' => ['tableau de bord', 'tableau bord', 'dashboard', 'accueil'], 'fuzzy' => ['dashboard', 'accueil']],
            ['path' => '/fournisseurs/fiches', 'label' => 'la section fournisseur', 'keys' => ['section fournisseur', 'menu fournisseur', 'fiche fournisseur', 'fiches fournisseur', 'espace fournisseur'], 'fuzzy' => ['fournisseur', 'fourniseur', 'fournis']],
            ['path' => '/fournisseurs/bons-achats', 'label' => 'les bons d\'achat', 'keys' => ['bon d achat', 'bons d achat', 'bon achat', 'bons achat', 'bons achats'], 'fuzzy' => ['achat']],
            ['path' => '/fournisseurs/reglements-achats', 'label' => 'les règlements achats', 'keys' => ['reglement achat', 'reglements achat', 'reglement fournisseur', 'reglements fournisseur']],
            ['path' => '/fournisseurs/balance', 'label' => 'la balance fournisseur', 'keys' => ['balance fournisseur', 'balance des fournisseurs', 'balances fournisseurs']],
            ['path' => '/fournisseurs/releve-compte', 'label' => 'le relevé fournisseur', 'keys' => ['releve fournisseur', 'releve compte fournisseur', 'releve des fournisseurs']],
            ['path' => '/fournisseurs/etat-reliquat', 'label' => 'l\'état reliquat fournisseur', 'keys' => ['etat reliquat', 'reliquat fournisseur'], 'fuzzy' => ['reliquat']],
            ['path' => '/clients/fiches', 'label' => 'la section client', 'keys' => ['section client', 'section clients', 'menu client', 'menu clients', 'fiche client', 'fiches client', 'espace client'], 'fuzzy' => ['client', 'clients']],
            ['path' => '/clients/bons-de-vente', 'label' => 'les bons de vente', 'keys' => ['bon de vente', 'bons de vente', 'bon vente', 'bons vente'], 'fuzzy' => ['vente']],
            ['path' => '/clients/reglements-vente', 'label' => 'les règlements clients', 'keys' => ['reglement client', 'reglements client', 'reglement vente', 'reglements vente']],
            ['path' => '/clients/balance', 'label' => 'la balance client', 'keys' => ['balance client', 'balance des clients', 'balances clients']],
            ['path' => '/clients/releve-compte', 'label' => 'le relevé client', 'keys' => ['releve client', 'releve compte client', 'releve des clients']],
            ['path' => '/clients/relance', 'label' => 'les relances clients', 'keys' => ['relance', 'relances', 'rappel client'], 'fuzzy' => ['relance']],
            ['path' => '/facturation/depot-a', 'label' => 'Ste A. Bouyahya', 'keys' => ['bouyahya', 'depot a'], 'fuzzy' => ['bouyahya']],
            ['path' => '/facturation/depot-b', 'label' => 'Ste Fatari et Associés', 'keys' => ['fatari', 'depot b'], 'fuzzy' => ['fatari']],
            ['path' => '/facturation/depot-c', 'label' => 'Ste Aabach Lilbinae', 'keys' => ['aabach', 'lilbinae', 'depot c'], 'fuzzy' => ['aabach']],
            ['path' => '/facturation/factures-ventes', 'label' => 'les factures de vente', 'keys' => ['facture vente', 'factures vente', 'facture ventes'], 'fuzzy' => ['facture']],
            ['path' => '/facturation/reglements', 'label' => 'les règlements des factures', 'keys' => ['reglement facture', 'reglements facture']],
            ['path' => '/facturation/balance', 'label' => 'la balance facturation', 'keys' => ['balance facturation', 'balance facture']],
            ['path' => '/stock/produits', 'label' => 'la fiche produit', 'keys' => ['fiche produit', 'produit', 'produits', 'section stock', 'menu stock'], 'fuzzy' => ['stock', 'produit']],
            ['path' => '/stock/mouvements', 'label' => 'les mouvements de stock', 'keys' => ['mouvement stock', 'mouvements stock', 'mouvement de stock'], 'fuzzy' => ['mouvement']],
            ['path' => '/stock/fiscal', 'label' => 'le stock fiscal', 'keys' => ['stock fiscal', 'stock fiscale']],
            ['path' => '/personnel/fiches', 'label' => 'la fiche personnel', 'keys' => ['fiche personnel', 'section personnel', 'personnel', 'employe', 'employes'], 'fuzzy' => ['personnel', 'employe']],
            ['path' => '/personnel/etat-paiement', 'label' => 'l\'état de paiement', 'keys' => ['etat paiement', 'etat de paiement', 'paiement personnel']],
            ['path' => '/monetaire/transactions', 'label' => 'les transactions', 'keys' => ['transaction', 'transactions', 'transaction et charge'], 'fuzzy' => ['transaction']],
            ['path' => '/monetaire/charges', 'label' => 'les charges', 'keys' => ['charge', 'charges'], 'fuzzy' => ['charge']],
            ['path' => '/monetaire/salaires', 'label' => 'les salaires', 'keys' => ['salaire', 'salaires'], 'fuzzy' => ['salaire']],
            ['path' => '/monetaire/tresorerie', 'label' => 'la trésorerie', 'keys' => ['tresorerie', 'section tresorerie'], 'fuzzy' => ['tresorerie']],
            ['path' => '/configuration/utilisateurs', 'label' => 'les utilisateurs', 'keys' => ['utilisateur', 'utilisateurs', 'section configuration', 'configuration'], 'fuzzy' => ['utilisateur']],
            ['path' => '/configuration/partenaires', 'label' => 'les partenaires', 'keys' => ['partenaire', 'partenaires'], 'fuzzy' => ['partenaire']],
            ['path' => '/configuration/autorisations', 'label' => 'les autorisations', 'keys' => ['autorisation', 'autorisations'], 'fuzzy' => ['autorisation']],
            ['path' => '/configuration/chauffeurs', 'label' => 'les chauffeurs', 'keys' => ['chauffeur', 'chauffeurs'], 'fuzzy' => ['chauffeur']],
            ['path' => null, 'label' => 'La section Chantiers', 'keys' => ['chantier', 'chantiers', 'carte chantier', 'devis', 'bon d execution', 'suivi depense', 'suivi depenses'], 'fuzzy' => ['chantier', 'devis'], 'closed' => true],
            ['path' => null, 'label' => 'Le bon de commande', 'keys' => ['bon de commande', 'bons de commande'], 'closed' => true],
        ];
    }

    private function extractDates(string $raw): array
    {
        if (! preg_match_all('/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/', $raw, $matches, PREG_SET_ORDER)) {
            return [];
        }
        $dates = [];
        foreach ($matches as $match) {
            $year = (int) $match[3];
            if ($year < 100) {
                $year += 2000;
            }
            $dates[] = sprintf('%04d-%02d-%02d', $year, (int) $match[2], (int) $match[1]);
        }

        return $dates;
    }

    private function extractMonth(string $raw, string $q, array $dates): ?string
    {
        if ($dates) {
            return substr($dates[0], 0, 7);
        }
        if (preg_match('/\b(20\d{2})-(\d{2})\b/', $raw, $match)) {
            return $match[1].'-'.$match[2];
        }
        $months = [
            'janvier' => '01', 'fevrier' => '02', 'mars' => '03', 'avril' => '04',
            'mai' => '05', 'juin' => '06', 'juillet' => '07', 'aout' => '08',
            'septembre' => '09', 'octobre' => '10', 'novembre' => '11', 'decembre' => '12',
        ];
        foreach ($months as $name => $num) {
            if (str_contains($q, $name)) {
                $year = preg_match('/\b(20\d{2})\b/', $q, $ym) ? $ym[1] : now()->format('Y');

                return $year.'-'.$num;
            }
        }

        return null;
    }

    private function wantsOpen(string $q): bool
    {
        return (bool) preg_match('/\b(ouvre|ouvrir|ouvres|ouvrez|ouvre\w*|affiche|afficher|montre|montrer|accede|acceder|amene|emmene|dirige|lance|va|aller|allez)\b/', $q)
            || (bool) preg_match('/\b(section|menu|sous menu|sousmenu)\b/', $q);
    }

    private function wantsPrint(string $q): bool
    {
        return (bool) preg_match('/\b(imprime|imprimer|impression|print)\b/', $q);
    }

    private function pronoun(string $q): bool
    {
        return (bool) preg_match('/\b(lui|elle|son|sa|ses|ce client|ce fournisseur|cette societe)\b/', $q);
    }

    private function findClient(string $raw, string $q): ?Client
    {
        if (preg_match('/\bCR-0*(\d+)/i', $raw, $match)) {
            return Client::find((int) $match[1]);
        }

        return $this->findParty(Client::query()->get(), $q);
    }

    private function findSupplier(string $raw, string $q): ?Supplier
    {
        if (preg_match('/\bCF-0*(\d+)/i', $raw, $match)) {
            return Supplier::find((int) $match[1]);
        }

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

    private function clientFromContext(array $context): ?Client
    {
        $id = $context['client_id'] ?? null;

        return $id ? Client::find($id) : null;
    }

    private function supplierFromContext(array $context): ?Supplier
    {
        $id = $context['supplier_id'] ?? null;

        return $id ? Supplier::find($id) : null;
    }

    private function isGeneric(string $word): bool
    {
        return in_array($word, ['societe', 'ste', 'sarl', 'btp', 'client', 'clients', 'fournisseur', 'fournisseurs'], true);
    }

    private function stripName(string $q): string
    {
        return trim(preg_replace('/\b(ghita|guita|gita|rita|guida|jita)\b/', ' ', $q) ?? $q);
    }

    private function out(string $reply, array $context, array $suggestions = [], ?string $navigate = null): array
    {
        return [
            'reply' => $reply,
            'context' => $context,
            'suggestions' => $suggestions,
            'navigate' => $navigate,
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
        $value = str_replace(['’', '\''], ' ', $value);

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value);
    }
}
