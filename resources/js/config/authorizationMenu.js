import { navigation } from './navigation';

function childPerm(sectionId, to) {
    const suffix = to.replace(/^\//, '').replace(/\//g, '.');
    return `nav.${suffix}`;
}

export const authorizationMenu = navigation.map((section) => ({
    id: section.id,
    label: section.label,
    perm: section.perm ? section.perm.replace('.view', '').replace('dashboard', 'nav.dashboard') : `nav.${section.id}`,
    children: (section.children || []).map((child) => ({
        label: child.label,
        perm: child.perm || childPerm(section.id, child.to),
        to: child.to,
    })),
})).map((section) => ({
    ...section,
    perm: section.perm.startsWith('nav.') ? section.perm : `nav.${section.id}`,
}));

// Align parent perms with backend AuthorizationMenu slugs
const permMap = {
    dashboard: 'nav.dashboard',
    fournisseurs: 'nav.fournisseurs',
    clients: 'nav.clients',
    facturation: 'nav.facturation',
    stock: 'nav.stock',
    chantiers: 'nav.chantiers',
    personnel: 'nav.personnel',
    monetaire: 'nav.monetaire',
    configuration: 'nav.configuration',
};

export const authorizationSections = authorizationMenu.map((section) => ({
    ...section,
    perm: permMap[section.id] || section.perm,
    children: section.children.map((child) => {
        const backendChild = {
            '/fournisseurs/fiches': 'nav.fournisseurs.fiches',
            '/fournisseurs/bons-achats': 'nav.fournisseurs.bons-achats',
            '/chantiers/bons-commande': 'nav.chantiers.bons-commande',
            '/fournisseurs/reglements-achats': 'nav.fournisseurs.reglements-achats',
            '/fournisseurs/balance': 'nav.fournisseurs.balance',
            '/fournisseurs/releve-compte': 'nav.fournisseurs.releve-compte',
            '/clients/fiches': 'nav.clients.fiches',
            '/clients/bons-de-vente': 'nav.clients.bons-de-vente',
            '/clients/reglements-vente': 'nav.clients.reglements-vente',
            '/clients/balance': 'nav.clients.balance',
            '/clients/releve-compte': 'nav.clients.releve-compte',
            '/facturation/depot-a': 'nav.facturation.depot-a',
            '/facturation/depot-b': 'nav.facturation.depot-b',
            '/facturation/depot-c': 'nav.facturation.depot-c',
            '/facturation/factures-ventes': 'nav.facturation.factures-ventes',
            '/facturation/reglements': 'nav.facturation.reglements',
            '/facturation/balance': 'nav.facturation.balance',
            '/stock/produits': 'nav.stock.produits',
            '/stock/mouvements': 'nav.stock.mouvements',
            '/stock/fiscal': 'nav.stock.fiscal',
            '/chantiers/carte': 'nav.chantiers.carte',
            '/clients/devis': 'nav.chantiers.devis',
            '/clients/bons-vente': 'nav.chantiers.bons-vente',
            '/chantiers/suivi-depenses': 'nav.chantiers.suivi-depenses',
            '/personnel/fiches': 'nav.personnel.fiches',
            '/personnel/etat-paiement': 'nav.personnel.etat-paiement',
            '/monetaire/transactions': 'nav.monetaire.transactions',
            '/monetaire/charges': 'nav.monetaire.charges',
            '/monetaire/salaires': 'nav.monetaire.salaires',
            '/monetaire/tresorerie': 'nav.monetaire.tresorerie',
            '/configuration/utilisateurs': 'nav.configuration.utilisateurs',
            '/configuration/chauffeurs': 'nav.configuration.chauffeurs',
            '/configuration/autorisations': 'nav.configuration.autorisations',
        };
        return {
            ...child,
            perm: backendChild[child.to] || child.perm,
        };
    }),
}));

export function allAuthorizationPerms() {
    const slugs = [];
    authorizationSections.forEach((section) => {
        slugs.push(section.perm);
        section.children?.forEach((child) => slugs.push(child.perm));
    });
    return slugs;
}
