import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, RefreshCw, Search, Scale, Wallet, Receipt } from 'lucide-react';
import api from '../../lib/api';
import { printBalance } from '../../lib/printBalance';
import { ReliquatCell } from './clientAmountUtils';
import { PageVisibilityHeader, usePageVisibility } from '../../components/PageVisibility';

const emptyFilters = {
    mois: '',
    client_id: '',
};

function Field({ label, children }) {
    return (
        <div>
            <label className="field-label">{label}</label>
            {children}
        </div>
    );
}

const filterClass =
    'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy';

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SoldeClientCell({ value }) {
    const n = Number(value) || 0;
    if (n <= 0) {
        return <span className="tabular-nums text-slate-400">—</span>;
    }
    return (
        <span className="tabular-nums font-bold text-red-600 dark:text-red-400">
            {formatMontant(n)}
        </span>
    );
}

function SummaryCard({ label, value, gradient, glow, icon: Icon }) {
    return (
        <div
            className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-4 shadow-lg text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl`}
            style={{ boxShadow: `0 10px 28px -8px ${glow}` }}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10 blur-2xl transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25" />
            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{label}</p>
                    <p className="mt-1.5 text-lg sm:text-xl font-bold tabular-nums leading-tight">{formatMontant(value)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm shrink-0">
                    <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
            </div>
        </div>
    );
}

function monthOptions() {
    const now = new Date();
    const options = [{ value: '', label: 'Tous les mois' }];
    for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
}

const columns = ['Date', 'Client', 'Total Ventes', 'Montant Payé', 'Solde', 'Reliquat'];

export default function ClientBalancePage() {
    const visibility = usePageVisibility({ actions: false, kpi: true, filters: true });
    const [params, setParams] = useSearchParams();
    const [filters, setFilters] = useState(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ total_ventes: 0, solde_total: 0, reliquat_total: 0 });
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const months = monthOptions();
    const autoPrint = useRef(params.get('print') === '1');
    const bootstrapped = useRef(false);
    const requestRef = useRef(0);

    const load = useCallback(() => {
        const token = ++requestRef.current;
        setLoading(true);
        const query = {};
        if (appliedFilters.mois) query.mois = appliedFilters.mois;
        if (appliedFilters.client_id) query.client_id = appliedFilters.client_id;

        api.get('/client-orders/balance', { params: query })
            .then((res) => {
                if (token !== requestRef.current) return;
                setRows(res.data.data ?? []);
                setSummary({
                    total_ventes: Number(res.data.meta?.total_ventes) || 0,
                    solde_total: Number(res.data.meta?.solde_total) || 0,
                    reliquat_total: Number(res.data.meta?.reliquat_total) || 0,
                });
            })
            .catch(() => {
                if (token !== requestRef.current) return;
                setRows([]);
                setSummary({ total_ventes: 0, solde_total: 0, reliquat_total: 0 });
            })
            .finally(() => {
                if (token === requestRef.current) setLoading(false);
            });
    }, [appliedFilters]);

    useEffect(() => {
        api.get('/clients', { params: { all: 1 } })
            .then((r) => setClients(r.data.data ?? []))
            .catch(() => setClients([]));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (bootstrapped.current) return;
        bootstrapped.current = true;
        const clientId = params.get('client_id') || '';
        const mois = params.get('mois') || '';
        if (!clientId && !mois && !autoPrint.current) return;
        const next = { mois, client_id: clientId };
        setFilters(next);
        setAppliedFilters(next);
    }, [params]);

    const printCurrent = () => {
        const clientName = clients.find((client) => String(client.id) === String(appliedFilters.client_id))?.name
            || (appliedFilters.client_id ? rows[0]?.client : '');
        printBalance({
            title: 'Balance client',
            subtitle: clientName || 'Tous les clients',
            columns,
            rows: rows.map((row) => [
                row.date || '—',
                row.client || '—',
                formatMontant(row.total_ventes),
                formatMontant(row.montant_paye),
                formatMontant(row.solde),
                formatMontant(row.reliquat),
            ]),
            summary: [
                `Total ventes : ${formatMontant(summary.total_ventes)}`,
                `Solde total : ${formatMontant(summary.solde_total)}`,
                `Reliquat : ${formatMontant(summary.reliquat_total)}`,
            ],
        });
    };

    useEffect(() => {
        if (!autoPrint.current || loading) return;
        const wanted = params.get('client_id') || '';
        if ((appliedFilters.client_id || '') !== wanted) return;
        autoPrint.current = false;
        printCurrent();
        const next = new URLSearchParams(params);
        next.delete('print');
        setParams(next, { replace: true });
    }, [loading, appliedFilters, rows, params, setParams]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    const handleSearch = () => setAppliedFilters({ ...filters });

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto overscroll-contain gap-4">
            <PageVisibilityHeader
                title="Balance Client"
                subtitle="Situation consolidée par client"
                visibility={visibility}
            />

            {visibility.showKpi && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard
                    label="Total Ventes"
                    value={summary.total_ventes}
                    gradient="from-brand-navy via-blue-800 to-indigo-900"
                    glow="rgba(30, 58, 95, 0.45)"
                    icon={Receipt}
                />
                <SummaryCard
                    label="Solde Total"
                    value={summary.solde_total}
                    gradient="from-red-500 via-rose-600 to-red-800"
                    glow="rgba(239, 68, 68, 0.4)"
                    icon={Scale}
                />
                <SummaryCard
                    label="Reliquat"
                    value={summary.reliquat_total}
                    gradient="from-amber-400 via-yellow-500 to-amber-600"
                    glow="rgba(245, 158, 11, 0.4)"
                    icon={Wallet}
                />
            </div>
            )}

            {visibility.showFilters && (
            <div className="glass-card p-4 shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_auto] gap-2.5 items-end max-w-3xl">
                    <Field label="Mois">
                        <select value={filters.mois} onChange={(e) => setFilter('mois', e.target.value)} className={filterClass}>
                            {months.map((m) => (
                                <option key={m.value || 'all'} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Client">
                        <select value={filters.client_id} onChange={(e) => setFilter('client_id', e.target.value)} className={filterClass}>
                            <option value="">Tous les clients</option>
                            {clients.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <button type="button" onClick={handleSearch} className="btn-secondary text-xs h-[34px] px-4 self-end">
                        <Search className="w-3.5 h-3.5" /> Rechercher
                    </button>
                </div>
            </div>
            )}

            <div className="glass-card min-w-0 max-w-full overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3.5 bg-gradient-to-r from-slate-700 via-slate-800 to-brand-navy border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Balance clients</h3>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={printCurrent} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Imprimer">
                            <Printer className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={load} disabled={loading} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Actualiser">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="min-w-0 overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-100 via-slate-200/90 to-slate-100 dark:from-slate-800 dark:via-slate-700/80 dark:to-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                                {columns.map((h) => (
                                    <th
                                        key={h}
                                        className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 whitespace-nowrap text-center"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i}>
                                        {columns.map((__, j) => (
                                            <td key={j} className="px-4 py-3 text-center">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.date || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.client}</td>
                                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-brand-navy dark:text-violet-400">{formatMontant(row.total_ventes)}</td>
                                        <td className="px-4 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-300">{formatMontant(row.montant_paye)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <SoldeClientCell value={row.solde} />
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <ReliquatCell value={row.reliquat} />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                        Aucune donnée pour ces critères
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
