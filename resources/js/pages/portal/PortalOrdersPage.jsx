import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Banknote, Eye, Printer, X } from 'lucide-react';
import api from '../../lib/api';
import { openPrintPreview } from '../../lib/printDocument';
import { MobileCardList } from '../../components/MobileRecordCard';

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statutKey(statut) {
    const s = String(statut || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
    if (s === 'paye' || s === 'solde') return 'paye';
    if (s === 'imp' || s === 'impaye') return 'imp';
    if (s === 'devalide' || s === 'deva') return 'deva';
    if (s === 'repo' || s === 'reporte' || s === 'report') return 'repo';
    return 'inst';
}

function statutBadgeClass(statut) {
    const key = statutKey(statut);
    if (key === 'paye') return 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700';
    if (key === 'imp') return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700';
    if (key === 'deva') return 'bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700';
    if (key === 'repo') return 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700';
    return 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700';
}

function buildBonHtml(row) {
    const itemsRows = (row.items?.length ? row.items : [{
        article_ref: row.article_ref,
        description: row.designation,
        unit: row.unit,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total: row.subtotal,
    }]).map((i) => `<tr>
<td>${i.article_ref || '—'}</td>
<td>${i.description || '—'}</td>
<td>${i.unit || '—'}</td>
<td>${i.quantity ?? '—'}</td>
<td>${formatMontant(i.unit_price)}</td>
<td><strong>${formatMontant(i.total)}</strong></td>
</tr>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bon ${row.reference}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{color:#1e3a5f;font-size:22px}
table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e2e8f0;padding:8px;font-size:12px;text-align:center}
th{background:#f8fafc;font-weight:700}.badge{background:#fff7ed;color:#ea580c;padding:4px 10px;border-radius:999px;font-weight:700}
</style></head><body>
<h1>BATIXPERT — Bon de Vente <span class="badge">${row.reference}</span></h1>
<table>
<tr><th>Date</th><td>${row.order_date || '—'}</td><th>Client</th><td>${row.client || '—'}</td></tr>
<tr><th>Fournisseur</th><td>${row.fournisseur || '—'}</td><th>Ville</th><td>${row.city || '—'}</td></tr>
<tr><th>Adresse Livraison</th><td colspan="3">${row.address || '—'}</td></tr>
<tr><th>Type Régl / Échéance</th><td>${row.reglement || '—'} / ${row.echeance || '—'}</td><th>Chauffeur</th><td>${row.chauffeur || '—'}</td></tr>
</table>
<table>
<thead><tr><th>Réf</th><th>Désignation</th><th>U</th><th>Qté</th><th>P/U</th><th>S/Total</th></tr></thead>
<tbody>${itemsRows}</tbody>
</table>
<p style="text-align:right;font-weight:700;margin-top:12px">Total : ${formatMontant(row.subtotal ?? row.montant)}</p>
<p style="text-align:right">Payé : ${formatMontant(row.montant_paye)} — Solde : ${formatMontant(row.solde)}</p>
</body></html>`;
}

function ViewModal({ row, onClose }) {
    if (!row) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[90dvh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 px-4 py-3 bg-gradient-to-r from-brand-navy to-blue-800 text-white flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase text-blue-100">Bon de vente</p>
                        <h3 className="font-bold truncate">{row.reference}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg bg-white/15 shrink-0" title="Fermer" aria-label="Fermer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 space-y-3 text-sm text-slate-800 dark:text-slate-100">
                    <div className="grid grid-cols-3 gap-2 items-start">
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">B-V</p>
                            <p className="font-mono text-[13px] font-bold text-brand-navy dark:text-orange-400 truncate">{row.reference}</p>
                        </div>
                        <div className="min-w-0 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Date</p>
                            <p className="text-[13px] font-semibold tabular-nums">{row.order_date || '—'}</p>
                        </div>
                        <div className="min-w-0 text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Fournisseur</p>
                            <p className="text-[13px] font-medium truncate">{row.fournisseur || '—'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Montant</p>
                            <p className="text-[13px] font-bold underline decoration-2 underline-offset-2 text-slate-900 dark:text-white tabular-nums truncate">
                                {formatMontant(row.montant)}
                            </p>
                        </div>
                        <div className="min-w-0 text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Solde</p>
                            <p className="text-[13px] font-bold text-red-600 dark:text-red-400 tabular-nums truncate">
                                {formatMontant(row.solde)}
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                <tr>
                                    {['Réf', 'Désignation', 'U', 'Qté', 'P/U', 'Total'].map((h) => (
                                        <th key={h} className="px-2 py-2 text-center">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-slate-700 dark:text-slate-200">
                                {(row.items || []).map((i, idx) => (
                                    <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-2 py-2 text-center">{i.article_ref || '—'}</td>
                                        <td className="px-2 py-2 text-center">{i.description || '—'}</td>
                                        <td className="px-2 py-2 text-center">{i.unit || '—'}</td>
                                        <td className="px-2 py-2 text-center">{i.quantity ?? '—'}</td>
                                        <td className="px-2 py-2 text-center">{formatMontant(i.unit_price)}</td>
                                        <td className="px-2 py-2 text-center font-bold">{formatMontant(i.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PaymentsPanel({ order, onClose }) {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ count: 0, total_affecte: 0, solde: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!order?.id) return;
        setLoading(true);
        api.get(`/portal/orders/${order.id}/payments`)
            .then((r) => {
                setRows(r.data.data ?? []);
                setMeta(r.data.meta ?? { count: 0, total_affecte: 0, solde: 0 });
            })
            .catch(() => {
                setRows([]);
                setMeta({ count: 0, total_affecte: 0, solde: 0 });
            })
            .finally(() => setLoading(false));
    }, [order?.id]);

    if (!order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90dvh] overflow-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase text-emerald-100">Règlements du bon</p>
                        <h3 className="font-bold truncate">{order.reference}</h3>
                        <p className="text-xs text-emerald-100 mt-0.5">{order.order_date || '—'} · {order.fournisseur || '—'}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg bg-white/15" aria-label="Fermer">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                            <p className="text-[10px] uppercase text-slate-400">Total affecté</p>
                            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatMontant(meta.total_affecte)}</p>
                        </div>
                        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
                            <p className="text-[10px] uppercase text-red-400">Solde bon</p>
                            <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">{formatMontant(meta.solde)}</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                            ))}
                        </div>
                    ) : rows.length ? (
                        <div className="space-y-2.5">
                            {rows.map((row) => (
                                <div
                                    key={row.allocation_id || row.id}
                                    className="rounded-2xl border border-slate-200 dark:border-slate-700 border-l-[4px] !border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20 p-3.5 space-y-2"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-mono text-[13px] font-bold text-brand-navy dark:text-orange-400">{row.reference}</p>
                                        <div className="text-right shrink-0 space-y-1">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statutBadgeClass(row.statut)}`}>
                                                {row.statut || 'Inst'}
                                            </span>
                                            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{row.payment_date || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Type</p>
                                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{row.reglement || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">N°</p>
                                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{row.numero || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Affecté</p>
                                            <p className="text-[13px] font-bold underline decoration-2 underline-offset-2 text-slate-900 dark:text-white tabular-nums">
                                                {formatMontant(row.amount)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Aucun règlement lié à ce bon</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function OrderMobileCard({ row, onOpen, onPayments }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 border-l-[4px] !border-l-brand-navy dark:!border-l-orange-400 shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <button type="button" onClick={onOpen} className="w-full text-left px-3.5 pt-3 pb-2 active:bg-slate-50 dark:active:bg-slate-800/50">
                <div className="grid grid-cols-3 gap-2 items-start">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">B-V</p>
                        <p className="font-mono text-[13px] font-bold text-brand-navy dark:text-orange-400 truncate">{row.reference}</p>
                    </div>
                    <div className="min-w-0 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Date</p>
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{row.order_date || '—'}</p>
                    </div>
                    <div className="min-w-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Fournisseur</p>
                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{row.fournisseur || '—'}</p>
                    </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Montant</p>
                        <p className="text-[13px] font-bold underline decoration-2 underline-offset-2 text-slate-900 dark:text-white tabular-nums truncate">
                            {formatMontant(row.montant)}
                        </p>
                    </div>
                    <div className="min-w-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Solde</p>
                        <p className="text-[13px] font-bold text-red-600 dark:text-red-400 tabular-nums truncate">
                            {formatMontant(row.solde)}
                        </p>
                    </div>
                </div>
            </button>

            <div className="flex border-t border-slate-100 dark:border-slate-800">
                <button
                    type="button"
                    onClick={onPayments}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 active:bg-emerald-50 dark:active:bg-emerald-900/20"
                >
                    <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        <Banknote className="w-4 h-4" />
                    </span>
                    Paiements
                </button>
            </div>
        </div>
    );
}

export default function PortalOrdersPage() {
    const { setRefreshHandler, setRefreshing } = useOutletContext() || {};
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ count: 0, total_montant: 0, total_solde: 0 });
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState(null);
    const [paymentsFor, setPaymentsFor] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        setRefreshing?.(true);
        api.get('/portal/orders')
            .then((r) => {
                setRows(r.data.data ?? []);
                setMeta(r.data.meta ?? { count: 0, total_montant: 0, total_solde: 0 });
            })
            .catch(() => setRows([]))
            .finally(() => {
                setLoading(false);
                setRefreshing?.(false);
            });
    }, [setRefreshing]);

    useEffect(() => {
        setRefreshHandler?.(load);
        return () => setRefreshHandler?.(null);
    }, [load, setRefreshHandler]);

    useEffect(() => { load(); }, [load]);

    const printRow = (row) => openPrintPreview(buildBonHtml(row), {
        title: `Bon de vente ${row.reference || ''}`,
        filename: `bon-vente-${row.reference || row.id}`,
    });

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <ViewModal row={view} onClose={() => setView(null)} />
            <PaymentsPanel order={paymentsFor} onClose={() => setPaymentsFor(null)} />

            <div className="shrink-0 space-y-2.5 pb-2.5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mes bons de vente</h2>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <div className="rounded-xl bg-brand-navy text-white p-2 sm:p-3 shadow-md min-w-0">
                        <p className="text-[9px] sm:text-[10px] uppercase text-blue-100 truncate">Bons</p>
                        <p className="text-base sm:text-xl font-bold tabular-nums truncate">{meta.count}</p>
                    </div>
                    <div className="rounded-xl bg-orange-500 text-white p-2 sm:p-3 shadow-md min-w-0">
                        <p className="text-[9px] sm:text-[10px] uppercase text-orange-100 truncate">Total</p>
                        <p className="text-[11px] sm:text-lg font-bold tabular-nums truncate">{formatMontant(meta.total_montant)}</p>
                    </div>
                    <div className="rounded-xl bg-red-600 text-white p-2 sm:p-3 shadow-md min-w-0">
                        <p className="text-[9px] sm:text-[10px] uppercase text-red-100 truncate">Solde</p>
                        <p className="text-[11px] sm:text-lg font-bold tabular-nums truncate">{formatMontant(meta.total_solde)}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 glass-card overflow-hidden border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/60 flex flex-col">
                <div className="md:hidden flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
                    <MobileCardList loading={loading} empty="Aucun bon de vente">
                        {rows.map((row) => (
                            <OrderMobileCard
                                key={row.id}
                                row={row}
                                onOpen={() => setView(row)}
                                onPayments={() => setPaymentsFor(row)}
                            />
                        ))}
                    </MobileCardList>
                </div>

                <div className="hidden md:block flex-1 min-h-0 overflow-auto overscroll-contain">
                    <table className="w-full text-sm min-w-[760px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {['Référence', 'Date', 'Fournisseur', 'Ville', 'Montant total', 'Solde', 'Actions'].map((h) => (
                                    <th key={h} className="px-3 py-3 text-[11px] font-bold uppercase text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i}><td colSpan={7} className="px-3 py-3"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td></tr>
                                ))
                            ) : rows.length ? rows.map((row) => (
                                <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                                    <td className="px-3 py-2.5 text-center font-mono font-bold text-brand-navy dark:text-orange-400">{row.reference}</td>
                                    <td className="px-3 py-2.5 text-center">{row.order_date || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">{row.fournisseur || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">{row.city || '—'}</td>
                                    <td className="px-3 py-2.5 text-center tabular-nums font-bold underline decoration-2 underline-offset-2">{formatMontant(row.montant)}</td>
                                    <td className="px-3 py-2.5 text-center tabular-nums font-bold text-red-600 dark:text-red-400">{formatMontant(row.solde)}</td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex justify-center gap-1">
                                            <button type="button" onClick={() => setPaymentsFor(row)} className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" title="Paiements"><Banknote className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => setView(row)} className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Voir"><Eye className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => printRow(row)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" title="Imprimer"><Printer className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-400 dark:text-slate-500">Aucun bon de vente</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
