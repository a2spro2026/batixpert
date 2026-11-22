import { useEffect, useState } from 'react';
import { Eye, Printer, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import { openPrintPreview } from '../../lib/printDocument';
import MobileRecordCard, { MobileCardList } from '../../components/MobileRecordCard';

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
<tr><th>Ville</th><td>${row.city || '—'}</td><th>Adresse Livraison</th><td>${row.address || '—'}</td></tr>
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

function ViewModal({ row, onClose, onPrint }) {
    if (!row) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[90dvh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 px-4 py-3 bg-gradient-to-r from-brand-navy to-blue-800 text-white flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase text-blue-100">Bon de vente</p>
                        <h3 className="font-bold">{row.reference}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-bold">Fermer</button>
                </div>
                <div className="p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                        <p><span className="text-slate-400 text-[10px] uppercase block">Date</span>{row.order_date || '—'}</p>
                        <p><span className="text-slate-400 text-[10px] uppercase block">Ville</span>{row.city || '—'}</p>
                        <p><span className="text-slate-400 text-[10px] uppercase block">Montant</span><strong>{formatMontant(row.montant)}</strong></p>
                        <p><span className="text-slate-400 text-[10px] uppercase block">Solde</span><strong className="text-red-600">{formatMontant(row.solde)}</strong></p>
                        <p className="col-span-2"><span className="text-slate-400 text-[10px] uppercase block">Adresse</span>{row.address || '—'}</p>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    {['Réf', 'Désignation', 'U', 'Qté', 'P/U', 'Total'].map((h) => (
                                        <th key={h} className="px-2 py-2 text-center">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
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
                    <button type="button" onClick={() => onPrint(row)} className="btn-primary w-full text-xs py-2.5">
                        <Printer className="w-4 h-4" /> Imprimer
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PortalOrdersPage() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ count: 0, total_montant: 0, total_solde: 0 });
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState(null);

    const load = () => {
        setLoading(true);
        api.get('/portal/orders')
            .then((r) => {
                setRows(r.data.data ?? []);
                setMeta(r.data.meta ?? { count: 0, total_montant: 0, total_solde: 0 });
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const printRow = (row) => openPrintPreview(buildBonHtml(row), {
        title: `Bon de vente ${row.reference || ''}`,
        filename: `bon-vente-${row.reference || row.id}`,
    });

    return (
        <div className="space-y-4">
            <ViewModal row={view} onClose={() => setView(null)} onPrint={printRow} />

            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mes bons de vente</h2>
                    <p className="text-sm text-slate-500">Consultation et impression uniquement</p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700" title="Actualiser">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-xl bg-brand-navy text-white p-3">
                    <p className="text-[10px] uppercase text-blue-100">Bons</p>
                    <p className="text-xl font-bold tabular-nums">{meta.count}</p>
                </div>
                <div className="rounded-xl bg-orange-500 text-white p-3">
                    <p className="text-[10px] uppercase text-orange-100">Total</p>
                    <p className="text-sm sm:text-lg font-bold tabular-nums">{formatMontant(meta.total_montant)}</p>
                </div>
                <div className="rounded-xl bg-red-600 text-white p-3 col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase text-red-100">Solde restant</p>
                    <p className="text-sm sm:text-lg font-bold tabular-nums">{formatMontant(meta.total_solde)}</p>
                </div>
            </div>

            <div className="glass-card overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
                <div className="md:hidden">
                    <MobileCardList loading={loading} empty="Aucun bon de vente">
                        {rows.map((row) => (
                            <MobileRecordCard
                                key={row.id}
                                title={row.reference}
                                subtitle={row.order_date}
                                fields={[
                                    { label: 'Montant', value: formatMontant(row.montant) },
                                    { label: 'Solde', value: formatMontant(row.solde), className: 'text-red-600 font-bold' },
                                    { label: 'Payé', value: formatMontant(row.montant_paye) },
                                    { label: 'Ville', value: row.city || '—' },
                                ]}
                                actions={[
                                    { label: 'Voir', icon: Eye, color: 'blue', onClick: () => setView(row) },
                                    { label: 'Imprimer', icon: Printer, color: 'slate', onClick: () => printRow(row) },
                                ]}
                            />
                        ))}
                    </MobileCardList>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800">
                                {['Date', 'Référence', 'Montant', 'Payé', 'Solde', 'Ville', 'Actions'].map((h) => (
                                    <th key={h} className="px-3 py-3 text-[11px] font-bold uppercase text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i}><td colSpan={7} className="px-3 py-3"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td></tr>
                                ))
                            ) : rows.length ? rows.map((row) => (
                                <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                                    <td className="px-3 py-2.5 text-center">{row.order_date}</td>
                                    <td className="px-3 py-2.5 text-center font-mono font-bold text-brand-navy dark:text-orange-400">{row.reference}</td>
                                    <td className="px-3 py-2.5 text-center tabular-nums font-semibold">{formatMontant(row.montant)}</td>
                                    <td className="px-3 py-2.5 text-center tabular-nums text-emerald-700">{formatMontant(row.montant_paye)}</td>
                                    <td className="px-3 py-2.5 text-center tabular-nums font-bold text-red-600">{formatMontant(row.solde)}</td>
                                    <td className="px-3 py-2.5 text-center">{row.city || '—'}</td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex justify-center gap-1">
                                            <button type="button" onClick={() => setView(row)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Voir"><Eye className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => printRow(row)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Imprimer"><Printer className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-400">Aucun bon de vente</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
