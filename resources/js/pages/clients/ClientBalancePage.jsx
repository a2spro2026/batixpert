import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import api from '../../lib/api';
import { formatMontant } from './bonExecutionUtils';
import { ReliquatCell, SoldeCell } from './clientAmountUtils';

const emptyFilters = {
    date_from: '',
    date_to: '',
    client_name: '',
    city: '',
};

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 truncate text-center">
                {label}
            </label>
            {children}
        </div>
    );
}

const filterClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy';

function AmountCell({ value, tone }) {
    if (tone === 'yellow') return <ReliquatCell value={value} />;
    return <SoldeCell value={value} />;
}

export default function ClientBalancePage() {
    const [filters, setFilters] = useState(emptyFilters);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        const params = { all: 1, ...filters };
        Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });

        api.get('/client-orders', { params })
            .then((res) => setRows(res.data.data ?? []))
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    const columns = ['Date', 'Nom Client', 'Ville Chantier', 'Montant', 'Montant Payé', 'Solde', 'Reliquat'];

    return (
        <div className="space-y-4">
            <div className="glass-card p-4 shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1.2fr_0.9fr_auto] gap-2.5 items-end">
                    <Field label="Date du">
                        <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} className={filterClass} />
                    </Field>
                    <Field label="Date au">
                        <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} className={filterClass} />
                    </Field>
                    <Field label="Nom Client">
                        <input type="text" value={filters.client_name} onChange={(e) => setFilter('client_name', e.target.value)} placeholder="Rechercher client..." className={filterClass} />
                    </Field>
                    <Field label="Ville Chantier">
                        <input type="text" value={filters.city} onChange={(e) => setFilter('city', e.target.value)} placeholder="Ville..." className={filterClass} />
                    </Field>
                    <button type="button" onClick={load} className="btn-secondary text-xs h-[34px] px-4 self-end">
                        <Search className="w-3.5 h-3.5" /> Rechercher
                    </button>
                </div>
            </div>

            <div className="glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3.5 bg-gradient-to-r from-slate-700 via-slate-800 to-brand-navy border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Balance clients</h3>
                    <button type="button" onClick={load} disabled={loading} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Actualiser">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                {columns.map((h) => (
                                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i}>{columns.map((__, j) => (
                                        <td key={j} className="px-4 py-3 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" /></td>
                                    ))}</tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.order_date}</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.client_name || '—'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                {row.city || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-brand-navy dark:text-violet-400">
                                            {formatMontant(row.montant ?? row.total_ttc)}
                                        </td>
                                        <td className="px-4 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-300">
                                            {formatMontant(row.montant_paye)}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <SoldeCell value={row.solde} />
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <AmountCell value={row.reliquat} tone="yellow" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                        Aucune donnée de balance — validez un devis pour créer un bon d'exécution
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
