export function soldeTone(value) {
    const n = Number(value) || 0;
    if (n < 0) return 'red';
    if (n > 0) return 'green';
    return 'neutral';
}

export function formatSoldePlain(value) {
    const n = Math.round(Math.abs(Number(value) || 0));
    return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}.Fcfa`;
}

export function SoldeCell({ value }) {
    const n = Number(value) || 0;
    if (n === 0) {
        return <span className="tabular-nums text-slate-500 dark:text-slate-400">0.Fcfa</span>;
    }
    if (n < 0) {
        return (
            <span className="tabular-nums font-bold text-red-600 dark:text-red-400">
                {formatSoldePlain(n)}
            </span>
        );
    }
    return (
        <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
            {formatSoldePlain(n)}
        </span>
    );
}

export function ReliquatCell({ value }) {
    const n = Number(value) || 0;
    if (n <= 0) return <span className="text-slate-400">—</span>;
    return (
        <span className="tabular-nums font-bold text-amber-600 dark:text-yellow-400">
            {formatSoldePlain(n)}
        </span>
    );
}
