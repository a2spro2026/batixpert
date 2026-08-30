<?php

namespace App\Support;

class AuthorizationMenu
{
    public static function sections(): array
    {
        return [
            [
                'id' => 'dashboard',
                'label' => 'Tableau de Bord',
                'perm' => 'nav.dashboard',
            ],
            [
                'id' => 'fournisseurs',
                'label' => 'Fournisseur',
                'perm' => 'nav.fournisseurs',
                'children' => [
                    ['label' => 'Fiche Fournisseur', 'perm' => 'nav.fournisseurs.fiches'],
                    ['label' => 'Bon Achats', 'perm' => 'nav.fournisseurs.bons-achats'],
                    ['label' => 'Bon de Commande', 'perm' => 'nav.chantiers.bons-commande'],
                    ['label' => 'Règlement Achats', 'perm' => 'nav.fournisseurs.reglements-achats'],
                    ['label' => 'Balance', 'perm' => 'nav.fournisseurs.balance'],
                    ['label' => 'Relevé Compte', 'perm' => 'nav.fournisseurs.releve-compte'],
                ],
            ],
            [
                'id' => 'clients',
                'label' => 'Client',
                'perm' => 'nav.clients',
                'children' => [
                    ['label' => 'Fiche Client', 'perm' => 'nav.clients.fiches'],
                    ['label' => 'Bon de Vente', 'perm' => 'nav.clients.bons-de-vente'],
                    ['label' => 'Règlement Client', 'perm' => 'nav.clients.reglements-vente'],
                    ['label' => 'Balance', 'perm' => 'nav.clients.balance'],
                    ['label' => 'Relevé Compte', 'perm' => 'nav.clients.releve-compte'],
                ],
            ],
            [
                'id' => 'facturation',
                'label' => 'Facturation',
                'perm' => 'nav.facturation',
                'children' => [
                    ['label' => 'Ste A. BOUYAHYA', 'perm' => 'nav.facturation.depot-a'],
                    ['label' => 'Ste Fatari et Associes', 'perm' => 'nav.facturation.depot-b'],
                    ['label' => 'Ste Aabach Lilbinae', 'perm' => 'nav.facturation.depot-c'],
                    ['label' => 'Facture Ventes', 'perm' => 'nav.facturation.factures-ventes'],
                    ['label' => 'Règlements Factures Ventes', 'perm' => 'nav.facturation.reglements'],
                    ['label' => 'Balance', 'perm' => 'nav.facturation.balance'],
                ],
            ],
            [
                'id' => 'stock',
                'label' => 'Stock',
                'perm' => 'nav.stock',
                'children' => [
                    ['label' => 'Fiche Produit', 'perm' => 'nav.stock.produits'],
                    ['label' => 'Mouvement Stock', 'perm' => 'nav.stock.mouvements'],
                    ['label' => 'Stock Fiscale', 'perm' => 'nav.stock.fiscal'],
                ],
            ],
            [
                'id' => 'chantiers',
                'label' => 'Chantiers',
                'perm' => 'nav.chantiers',
                'children' => [
                    ['label' => 'Carte Chantiers', 'perm' => 'nav.chantiers.carte'],
                    ['label' => 'Devis', 'perm' => 'nav.chantiers.devis'],
                    ['label' => "Bon D'Execution", 'perm' => 'nav.chantiers.bons-vente'],
                    ['label' => 'Suivi Dépenses', 'perm' => 'nav.chantiers.suivi-depenses'],
                ],
            ],
            [
                'id' => 'personnel',
                'label' => 'Personnel',
                'perm' => 'nav.personnel',
                'children' => [
                    ['label' => 'Fiche Personnel', 'perm' => 'nav.personnel.fiches'],
                    ['label' => 'État Paiement', 'perm' => 'nav.personnel.etat-paiement'],
                ],
            ],
            [
                'id' => 'monetaire',
                'label' => 'Suivi Monétaire',
                'perm' => 'nav.monetaire',
                'children' => [
                    ['label' => 'Transaction et Charges', 'perm' => 'nav.monetaire.transactions'],
                    ['label' => 'Charge', 'perm' => 'nav.monetaire.charges'],
                    ['label' => 'Salaire', 'perm' => 'nav.monetaire.salaires'],
                    ['label' => 'Trésorerie', 'perm' => 'nav.monetaire.tresorerie'],
                ],
            ],
            [
                'id' => 'configuration',
                'label' => 'Configuration',
                'perm' => 'nav.configuration',
                'children' => [
                    ['label' => 'Utilisateur', 'perm' => 'nav.configuration.utilisateurs'],
                    ['label' => 'Autorisations', 'perm' => 'nav.configuration.autorisations'],
                    ['label' => 'Chauffeur', 'perm' => 'nav.configuration.chauffeurs'],
                ],
            ],
        ];
    }

    public static function allPermissionSlugs(): array
    {
        $slugs = [];

        foreach (self::sections() as $section) {
            $slugs[] = $section['perm'];
            foreach ($section['children'] ?? [] as $child) {
                $slugs[] = $child['perm'];
            }
        }

        return array_values(array_unique($slugs));
    }
}
