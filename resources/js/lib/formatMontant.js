/** Affiche un montant entier avec suffixe .Fcfa (ex. 1 250.Fcfa). */
export function formatMontant(value) {
    const n = Math.round(Number(value) || 0);
    return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}.Fcfa`;
}

export function formatMontantPlain(value) {
    return formatMontant(value);
}
