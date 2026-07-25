import {
    LayoutDashboard,
    Truck,
    Users,
    Package,
    HardHat,
    UserCog,
    Landmark,
    Settings,
    // Fournisseur
    Contact,
    ClipboardList,
    Banknote,
    FileInput,
    CreditCard,
    Scale,
    ScrollText,
    // Client
    ContactRound,
    FileCheck,
    FileSignature,
    CircleDollarSign,
    Receipt,
    Wallet,
    // Stock
    Boxes,
    ArrowLeftRight,
    Archive,
    // Chantiers
    MapPin,
    ClipboardCheck,
    TrendingDown,
    // Personnel
    BadgeCheck,
    CalendarCheck,
    // Monétaire
    Coins,
    Vault,
    FileText,
} from 'lucide-react';

export const navigation = [
    {
        id: 'dashboard',
        label: 'Tableau de Bord',
        icon: LayoutDashboard,
        perm: 'dashboard.view',
        to: '/',
    },
    {
        id: 'fournisseurs',
        label: 'Fournisseur',
        icon: Truck,
        perm: 'fournisseurs.view',
        children: [
            { to: '/fournisseurs/fiches', label: 'Fiche Fournisseur', icon: Contact },
            { to: '/fournisseurs/bons-achats', label: 'Bon Achats', icon: ClipboardList },
            { to: '/chantiers/bons-commande', label: 'Bon de Commande', icon: ClipboardCheck },
            { to: '/fournisseurs/reglements-achats', label: 'Règlement Achats', icon: Banknote },
            { to: '/fournisseurs/balance', label: 'Balance', icon: Scale },
            { to: '/fournisseurs/releve-compte', label: 'Relevé Compte', icon: ScrollText },
        ],
    },
    {
        id: 'clients',
        label: 'Client',
        icon: Users,
        perm: 'clients.view',
        children: [
            { to: '/clients/fiches', label: 'Fiche Client', icon: ContactRound },
            { to: '/clients/bons-de-vente', label: 'Bon de Vente', icon: ClipboardList },
            { to: '/clients/reglements-vente', label: 'Règlement Client', icon: CircleDollarSign },
            { to: '/clients/balance', label: 'Balance', icon: Scale },
            { to: '/clients/releve-compte', label: 'Relevé Compte', icon: ScrollText },
        ],
    },
    {
        id: 'facturation',
        label: 'Facturation',
        icon: FileText,
        perm: 'factures_clients.view',
        children: [
            { to: '/facturation/factures-achats', label: 'Facture Achats', icon: FileInput },
            { to: '/facturation/reglement', label: 'Règlement', icon: CreditCard },
            { to: '/facturation/factures-ventes', label: 'Facture Ventes', icon: Receipt },
            { to: '/facturation/reglements', label: 'Règlements', icon: Wallet },
            { to: '/facturation/balance', label: 'Balance', icon: Scale },
        ],
    },
    {
        id: 'stock',
        label: 'Stock',
        icon: Package,
        perm: 'stock.view',
        children: [
            { to: '/stock/produits', label: 'Fiche Produit', icon: Boxes },
            { to: '/stock/mouvements', label: 'Mouvement Stock', icon: ArrowLeftRight },
            { to: '/stock/fiscal', label: 'Stock Fiscale', icon: Archive },
        ],
    },
    {
        id: 'chantiers',
        label: 'Chantiers',
        icon: HardHat,
        perm: 'chantiers.view',
        children: [
            { to: '/chantiers/carte', label: 'Carte Chantiers', icon: MapPin },
            { to: '/clients/devis', label: 'Devis', icon: FileSignature },
            { to: '/clients/bons-vente', label: "Bon D'Execution", icon: FileCheck },
            { to: '/chantiers/suivi-depenses', label: 'Suivi Dépenses', icon: TrendingDown },
        ],
    },
    {
        id: 'personnel',
        label: 'Personnel',
        icon: BadgeCheck,
        perm: 'personnel.view',
        children: [
            { to: '/personnel/fiches', label: 'Fiche Personnel', icon: Contact },
            { to: '/personnel/etat-paiement', label: 'État Paiement', icon: CalendarCheck },
        ],
    },
    {
        id: 'monetaire',
        label: 'Suivi Monétaire',
        icon: Landmark,
        perm: 'reglements.view',
        children: [
            { to: '/monetaire/transactions', label: 'Transaction et Charges', icon: ArrowLeftRight },
            { to: '/monetaire/salaires', label: 'Salaire', icon: Coins },
            { to: '/monetaire/tresorerie', label: 'Trésorerie', icon: Vault },
        ],
    },
    {
        id: 'configuration',
        label: 'Configuration',
        icon: Settings,
        perm: 'utilisateurs.view',
        children: [
            { to: '/configuration/utilisateurs', label: 'Utilisateur', icon: UserCog },
        ],
    },
];
