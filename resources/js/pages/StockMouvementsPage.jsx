import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, FileText, Printer, RefreshCw } from 'lucide-react';
import api from '../lib/api';

function formatQtyStrict(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

function MonthCell({ achat, vente }) {
    const a = Number(achat) || 0;
    const v = Number(vente) || 0;
    const empty = Math.abs(a) < 0.0005 && Math.abs(v) < 0.0005;

    if (empty) {
        return (
            <div className="mx-auto flex h-[42px] w-[52px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-900/30">
                <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
            </div>
        );
    }

    return (
        <div className="mx-auto flex h-[42px] w-[52px] flex-col items-stretch justify-center overflow-hidden rounded-lg border border-slate-200/70 dark:border-slate-600/70 bg-white dark:bg-slate-800 shadow-sm">
            <div className={`flex-1 flex items-center justify-center text-[10px] font-bold tabular-nums leading-none ${a > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-slate-300 dark:text-slate-600'}`}>
                {a > 0 ? `+${formatQtyStrict(a)}` : '—'}
            </div>
            <div className="h-px bg-slate-200/80 dark:bg-slate-600/80" />
            <div className={`flex-1 flex items-center justify-center text-[10px] font-bold tabular-nums leading-none ${v > 0 ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'text-slate-300 dark:text-slate-600'}`}>
                {v > 0 ? `−${formatQtyStrict(v)}` : '—'}
            </div>
        </div>
    );
}

function buildPrintHtml(row, year, monthsMeta) {
    const monthCells = monthsMeta.map((m) => {
        const data = row.months?.[m.num] || { achat: 0, vente: 0 };
        return `<td style="text-align:center;font-size:11px;padding:6px">
            <div style="font-weight:700;margin-bottom:4px">${m.short}</div>
            <div style="color:#047857">A ${formatQtyStrict(data.achat)}</div>
            <div style="color:#be123c">V ${formatQtyStrict(data.vente)}</div>
        </td>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mouvement ${row.reference || ''}</title>
<style>
body{font-family:Arial,sans-serif;padding:28px;color:#1e293b}
h1{color:#1e3a5f;font-size:20px;margin:0 0 4px}
.sub{color:#64748b;font-size:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #e2e8f0;padding:8px;font-size:12px}
th{background:#f8fafc;font-weight:700;text-align:center}
.badge{background:#ecfdf5;color:#059669;padding:3px 8px;border-radius:999px;font-weight:700;font-size:11px}
</style></head><body>
<h1>BATIXPERT — Mouvement Stock</h1>
<p class="sub">Année ${year} · <span class="badge">${row.reference || '—'}</span> ${row.designation || ''}</p>
<table>
<tr>
<th>Réf</th><th>Désignation</th><th>Stock Initial</th>
${monthsMeta.map((m) => `<th>${m.short}</th>`).join('')}
<th>Stock Actuel</th>
</tr>
<tr>
<td style="text-align:center;font-family:monospace;font-weight:700">${row.reference || '—'}</td>
<td style="text-align:center">${row.designation || '—'}</td>
<td style="text-align:center;font-weight:700">${formatQtyStrict(row.stock_initial)}</td>
${monthCells}
<td style="text-align:center;font-weight:700;color:#1e3a5f">${formatQtyStrict(row.stock_actuel)}</td>
</tr>
</table>
<p style="margin-top:12px;font-size:11px;color:#64748b">Légende mois : A = Achats · V = Ventes</p>
</body></html>`;
}

function openPrintable(row, year, monthsMeta) {
    const w = window.open('', '_blank', 'width=1200,height=700');
    if (!w) return;
    w.document.write(buildPrintHtml(row, year, monthsMeta));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
}

function ActionBtn({ title, icon: Icon, color = 'slate', onClick }) {
    const colors = {
        slate: 'hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        orange: 'hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400',
    };
    return (
        <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg text-slate-400 transition-colors ${colors[color]}`}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
    );
}

export default function StockMouvementsPage() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [rows, setRows] = useState([]);
    const [monthsMeta, setMonthsMeta] = useState([]);
    const [loading, setLoading] = useState(true);

    const yearOptions = useMemo(() => {
        const list = [];
        for (let y = currentYear; y >= currentYear - 5; y--) list.push(y);
        return list;
    }, [currentYear]);

    const load = useCallback(() => {
        setLoading(true);
        api.get('/stock-mouvements', { params: { year } })
            .then((r) => {
                setRows(r.data.data ?? []);
                setMonthsMeta(r.data.meta?.months ?? []);
            })
            .catch(() => {
                setRows([]);
                setMonthsMeta([]);
            })
            .finally(() => setLoading(false));
    }, [year]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-4 h-full min-h-0 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mouvement Stock</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Achats et ventes mensuels par produit
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Année</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-navy/30"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-brand-navy hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        title="Actualiser"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
                    Achat (+)
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-rose-100 border border-rose-300" />
                    Vente (−)
                </span>
            </div>

            <div className="flex-1 min-h-0 glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60 flex flex-col">
                <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-800 border-b border-white/10 flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-white/80" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Tableau des mouvements — {year}</h3>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-sm border-collapse min-w-[1400px]">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]">
                                    Réf
                                </th>
                                <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap sticky left-[88px] z-30 bg-slate-50 dark:bg-slate-800 shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)] min-w-[160px]">
                                    Désignation
                                </th>
                                <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                                    Stock Initial
                                </th>
                                {monthsMeta.map((m) => (
                                    <th key={m.num} className="px-1.5 py-2 text-center" title={m.full}>
                                        <div className="mx-auto w-[52px] rounded-md bg-gradient-to-b from-brand-navy to-slate-800 px-1 py-1.5 shadow-sm">
                                            <span className="block text-[10px] font-bold uppercase tracking-wide text-white leading-none">
                                                {m.short}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                                    Stock Actuel
                                </th>
                                <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}>
                                        {[...Array(16)].map((__, j) => (
                                            <td key={j} className="px-2 py-3 text-center">
                                                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[60px]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-emerald-50/30 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-brand-navy dark:text-emerald-400 sticky left-0 z-10 bg-white dark:bg-slate-900 shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]">
                                            {row.reference}
                                        </td>
                                        <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-white max-w-[180px] truncate sticky left-[88px] z-10 bg-white dark:bg-slate-900 shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]" title={row.designation}>
                                            {row.designation || '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                                            {formatQtyStrict(row.stock_initial)}
                                        </td>
                                        {monthsMeta.map((m) => {
                                            const cell = row.months?.[m.num] || { achat: 0, vente: 0 };
                                            return (
                                                <td key={m.num} className="px-1.5 py-2 text-center align-middle">
                                                    <MonthCell achat={cell.achat} vente={cell.vente} />
                                                </td>
                                            );
                                        })}
                                        <td className="px-3 py-2.5 text-center tabular-nums font-bold text-brand-navy dark:text-emerald-400">
                                            {formatQtyStrict(row.stock_actuel)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <ActionBtn
                                                    title="Imprimer"
                                                    icon={Printer}
                                                    onClick={() => openPrintable(row, year, monthsMeta)}
                                                />
                                                <ActionBtn
                                                    title="PDF"
                                                    icon={FileText}
                                                    color="orange"
                                                    onClick={() => openPrintable(row, year, monthsMeta)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={16} className="px-4 py-12 text-center text-slate-400">
                                        Aucun produit enregistré
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
