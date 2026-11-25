import { useEffect, useState } from 'react';
import api from '../../lib/api';

function money(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PortalRelevePage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/portal/releve')
            .then((res) => setRows(res.data.data ?? []))
            .catch((err) => setError(err.response?.data?.message || 'Impossible de charger le relevé.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p className="text-sm text-slate-500">Chargement…</p>;
    if (error) return <p className="text-sm text-red-600">{error}</p>;

    return (
        <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full text-sm min-w-[640px]">
                <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                        {['Date', 'Opération', 'N°', 'Débit', 'Crédit', 'Solde'].map((heading) => (
                            <th key={heading} className="px-3 py-2 text-left">{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length ? rows.map((row, index) => (
                        <tr key={`${row.date}-${row.numero_bn}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2">{row.date || '—'}</td>
                            <td className="px-3 py-2">{row.operation || '—'}</td>
                            <td className="px-3 py-2">{row.numero_bn || '—'}</td>
                            <td className="px-3 py-2">{money(row.debit)}</td>
                            <td className="px-3 py-2">{money(row.credit)}</td>
                            <td className="px-3 py-2 font-semibold">{money(row.solde)}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Aucune ligne.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
