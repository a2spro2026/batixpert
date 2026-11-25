import { useEffect, useState } from 'react';
import api from '../../lib/api';

function money(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PortalBalancePage() {
    const [row, setRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/portal/balance')
            .then((res) => setRow((res.data.data ?? [])[0] || null))
            .catch((err) => setError(err.response?.data?.message || 'Impossible de charger la balance.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p className="text-sm text-slate-500">Chargement…</p>;
    if (error) return <p className="text-sm text-red-600">{error}</p>;
    if (!row) return <p className="text-sm text-slate-500">Aucune balance pour le moment.</p>;

    const cells = [
        ['Total ventes', row.total_ventes],
        ['Montant payé', row.montant_paye],
        ['Solde', row.solde],
        ['Reliquat', row.reliquat],
    ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {cells.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{money(value)}</p>
                </div>
            ))}
        </div>
    );
}
