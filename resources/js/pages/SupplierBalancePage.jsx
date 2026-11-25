import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, RefreshCw, Search, Scale, Wallet, Receipt, X } from 'lucide-react';
import api from '../lib/api';
import { printBalance } from '../lib/printBalance';
import { ReliquatCell } from './clients/clientAmountUtils';
import { PageVisibilityHeader, usePageVisibility } from '../components/PageVisibility';

const emptyFilters = {
    mois: '',
    supplier_id: '',
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

function SoldeFournisseurCell({ value }) {
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

const columns = ['Date', 'Fournisseur', 'Total Achats', 'Montant Payé', 'Solde', 'Reliquat'];
const detailColumns = ['Nom Fournisseur', 'Client', 'Montant', 'Montant Payé', 'Solde', 'Reliquat'];

function ClientDetailModal({ open, supplierName, rows, loading, onClose }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 shrink-0">
                    <div>
                        <p className="text-[10px] text-orange-100 uppercase tracking-wider">Détail par client</p>
                        <h3 className="text-white font-bold">{supplierName || 'Fournisseur'}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-auto min-h-0 flex-1">
                    <table className="w-full text-sm min-w-[760px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                {detailColumns.map((h) => (
                                    <th
                                        key={h}
                                        className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 whitespace-nowrap text-center"
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
                                        {detailColumns.map((__, j) => (
                                            <td key={j} className="px-4 py-3 text-center">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row, idx) => (
                                    <tr key={`${row.client}-${idx}`} className="hover:bg-orange-50/40 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.fournisseur || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-700 dark:text-slate-200">{row.client || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-brand-navy dark:text-orange-400">{formatMontant(row.montant)}</td>
                                        <td className="px-4 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-300">{formatMontant(row.montant_paye)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <SoldeFournisseurCell value={row.solde} />
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <ReliquatCell value={row.reliquat} />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={detailColumns.length} className="px-4 py-12 text-center text-slate-400">
                                        Aucun bon d&apos;achat pour ce fournisseur
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <button type="button" onClick={onClose} className="btn-secondary text-xs px-5">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SupplierBalancePage() {
    const visibility = usePageVisibility({ actions: false, kpi: true, filters: true });
    const [params, setParams] = useSearchParams();
    const [filters, setFilters] = useState(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ total_achats: 0, solde_total: 0, reliquat_total: 0 });
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailName, setDetailName] = useState('');
    const [detailRows, setDetailRows] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const months = monthOptions();
    const autoPrint = useRef(params.get('print') === '1');
    const bootstrapped = useRef(false);
    const requestRef = useRef(0);

    const load = useCallback(() => {
        const token = ++requestRef.current;
        setLoading(true);
        const query = {};
        if (appliedFilters.mois) query.mois = appliedFilters.mois;
        if (appliedFilters.supplier_id) query.supplier_id = appliedFilters.supplier_id;

        api.get('/purchase-orders/balance', { params: query })
            .then((res) => {
                if (token !== requestRef.current) return;
                setRows(res.data.data ?? []);
                setSummary({
                    total_achats: Number(res.data.meta?.total_achats) || 0,
                    solde_total: Number(res.data.meta?.solde_total) || 0,
                    reliquat_total: Number(res.data.meta?.reliquat_total) || 0,
                });
            })
            .catch(() => {
                if (token !== requestRef.current) return;
                setRows([]);
                setSummary({ total_achats: 0, solde_total: 0, reliquat_total: 0 });
            })
            .finally(() => {
                if (token === requestRef.current) setLoading(false);
            });
    }, [appliedFilters]);

    useEffect(() => {
        api.get('/suppliers', { params: { all: 1 } })
            .then((r) => setSuppliers(r.data.data ?? []))
            .catch(() => setSuppliers([]));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (bootstrapped.current) return;
        bootstrapped.current = true;
        const supplierId = params.get('supplier_id') || '';
        if (!supplierId && !autoPrint.current) return;
        const next = { mois: params.get('mois') || '', supplier_id: supplierId };
        setFilters(next);
        setAppliedFilters(next);
    }, [params]);

    const printCurrent = () => {
        const supplierName = suppliers.find((supplier) => String(supplier.id) === String(appliedFilters.supplier_id))?.name
            || (appliedFilters.supplier_id ? rows[0]?.fournisseur : '');
        printBalance({
            title: 'Balance fournisseur',
            subtitle: supplierName || 'Tous les fournisseurs',
            columns,
            rows: rows.map((row) => [
                row.date || '—',
                row.fournisseur || '—',
                formatMontant(row.total_achats),
                formatMontant(row.montant_paye),
                formatMontant(row.solde),
                formatMontant(row.reliquat),
            ]),
            summary: [
                `Total achats : ${formatMontant(summary.total_achats)}`,
                `Solde total : ${formatMontant(summary.solde_total)}`,
                `Reliquat : ${formatMontant(summary.reliquat_total)}`,
            ],
        });
    };

    useEffect(() => {
        if (!autoPrint.current || loading) return;
        const wanted = params.get('supplier_id') || '';
        if ((appliedFilters.supplier_id || '') !== wanted) return;
        autoPrint.current = false;
        printCurrent();
        const next = new URLSearchParams(params);
        next.delete('print');
        setParams(next, { replace: true });
    }, [loading, appliedFilters, rows, params, setParams]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    const handleSearch = () => setAppliedFilters({ ...filters });

    const openClientDetail = (row) => {
        const supplierId = row.supplier_id || row.id;
        if (!supplierId) return;

        setDetailName(row.fournisseur || '');
        setDetailOpen(true);
        setDetailLoading(true);
        setDetailRows([]);

        const params = { supplier_id: supplierId };
        if (appliedFilters.mois) params.mois = appliedFilters.mois;

        api.get('/purchase-orders/balance-clients', { params })
            .then((res) => {
                setDetailRows(res.data.data ?? []);
                setDetailName(res.data.meta?.fournisseur || row.fournisseur || '');
            })
            .catch(() => setDetailRows([]))
            .finally(() => setDetailLoading(false));
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto overscroll-contain gap-4">
            <ClientDetailModal
                open={detailOpen}
                supplierName={detailName}
                rows={detailRows}
                loading={detailLoading}
                onClose={() => setDetailOpen(false)}
            />
            <PageVisibilityHeader
                title="Balance Fournisseur"
                subtitle="Situation consolidée par fournisseur"
                visibility={visibility}
            />

            {visibility.showKpi && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard
                    label="Total Achats"
                    value={summary.total_achats}
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
                    <Field label="Fournisseur">
                        <select value={filters.supplier_id} onChange={(e) => setFilter('supplier_id', e.target.value)} className={filterClass}>
                            <option value="">Tous les fournisseurs</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
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
                <div className="px-5 py-3.5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Balance fournisseurs</h3>
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
                                    <tr
                                        key={row.id}
                                        className="hover:bg-orange-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                        onDoubleClick={() => openClientDetail(row)}
                                        title="Double-clic pour le détail par client"
                                    >
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.date || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.fournisseur}</td>
                                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-brand-navy dark:text-orange-400">{formatMontant(row.total_achats)}</td>
                                        <td className="px-4 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-300">{formatMontant(row.montant_paye)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <SoldeFournisseurCell value={row.solde} />
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
