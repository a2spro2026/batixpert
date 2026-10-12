import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, X, RefreshCw, FileText } from 'lucide-react';
import api from '../lib/api';
import { downloadPdf, openPrintPreview } from '../lib/printDocument';
import { useAuth } from '../contexts/AuthContext';

const emptyFilters = {
    mois: '',
    supplier_id: '',
    client: '',
};

const emptyTotals = {
    count: 0,
    total_montant_bon: 0,
    total_reg: 0,
    total_reliquat: 0,
};

const columns = ['Date', 'N° Bon', 'Fournisseur', 'Nom Client', 'Montant Bon', 'Total Rég', 'Total Reliquat'];

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMois(mois) {
    if (!mois) return '';
    const [year, month] = mois.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function Field({ label, children }) {
    return (
        <div className="min-w-0">
            <label className="field-label field-label-compact">{label}</label>
            {children}
        </div>
    );
}

const filterClass =
    'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const PRINT_LOGO = `<svg viewBox="0 0 48 48" width="46" height="46" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a5f"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
<rect width="48" height="48" rx="10" fill="url(#g)"/>
<rect x="8" y="26" width="7" height="14" fill="#fff" opacity=".9"/><rect x="17" y="20" width="6" height="20" fill="#fff" opacity=".9"/>
<rect x="25" y="24" width="6" height="16" fill="#fff" opacity=".9"/><rect x="33" y="28" width="7" height="12" fill="#fff" opacity=".9"/>
<text x="24" y="17" text-anchor="middle" fill="#fff" font-family="Arial Black,Arial" font-size="11" font-weight="900">BX</text>
<circle cx="40" cy="40" r="5" fill="#f97316"/></svg>`;

function buildPrintHtml({ rows, totals, filters }) {
    const now = new Date();
    const editedOn = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const editedAt = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const body = rows.map((row, idx) => `<tr>
        <td class="c muted">${idx + 1}</td>
        <td class="c">${escapeHtml(row.date || '—')}</td>
        <td class="c ref">${escapeHtml(row.reference || '—')}</td>
        <td>${escapeHtml(row.fournisseur || '—')}</td>
        <td>${escapeHtml(row.client || '—')}</td>
        <td class="num">${formatMontant(row.montant_bon)}</td>
        <td class="num">${formatMontant(row.total_reg)}</td>
        <td class="num strong">${formatMontant(row.reliquat)}</td>
    </tr>`).join('');

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Etat Reliquat Fournisseur — ${escapeHtml(editedOn)}</title>
<style>
@page{size:A4 portrait;margin:14mm 12mm 16mm;
  @bottom-left{content:"BatiXpert — Etat reliquat fournisseur";font:8px Arial,sans-serif;color:#94a3b8}
  @bottom-right{content:"Page " counter(page) " / " counter(pages);font:8px Arial,sans-serif;color:#94a3b8}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0}
body{font-family:"Segoe UI",Arial,sans-serif;color:#1e293b;font-size:10.5px;background:#e2e8f0}
.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 12mm 16mm;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.18)}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid #1e3a5f;position:relative}
.header:after{content:"";position:absolute;left:0;bottom:-3px;width:90px;height:3px;background:#f97316}
.brand{display:flex;align-items:center;gap:10px}
.brand-name{font-size:22px;font-weight:900;letter-spacing:.06em;color:#1e3a5f;line-height:1}
.brand-name b{color:#f97316}
.brand-tag{font-size:8.5px;color:#64748b;margin-top:4px;letter-spacing:.02em}
.doc{text-align:right}
.doc-title{font-size:15px;font-weight:800;color:#1e3a5f;text-transform:uppercase;letter-spacing:.08em}
.doc-sub{font-size:9px;color:#64748b;margin-top:3px}
.doc-meta{margin-top:8px;display:inline-grid;grid-template-columns:auto auto;gap:2px 10px;font-size:9px;text-align:left}
.doc-meta dt{color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;font-size:8px;padding-top:1px}
.doc-meta dd{margin:0;font-weight:600;color:#334155}
.criteria{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 12px}
.criterion{border:1px solid #e2e8f0;border-left:3px solid #1e3a5f;border-radius:6px;padding:6px 9px;background:#f8fafc}
.criterion label{display:block;font-size:7.5px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;font-weight:700}
.criterion div{font-size:10.5px;font-weight:700;color:#1e293b;margin-top:2px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.kpi{border-radius:8px;padding:9px 10px;color:#fff}
.kpi label{display:block;font-size:7.5px;text-transform:uppercase;letter-spacing:.1em;opacity:.85;font-weight:700}
.kpi div{font-size:13px;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums}
.k1{background:#475569}.k2{background:#1e3a5f}.k3{background:#047857}.k4{background:#ea580c}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
thead th{background:#1e3a5f;color:#fff;font-size:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;padding:7px 6px;text-align:left;border:1px solid #1e3a5f}
thead th.num,thead th.c{text-align:center}
tbody td{padding:6px;border-bottom:1px solid #e2e8f0;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9}
tbody tr:nth-child(even) td{background:#f8fafc}
tbody tr{page-break-inside:avoid}
td.c{text-align:center}td.num{text-align:right;white-space:nowrap}
td.ref{font-family:Consolas,"Courier New",monospace;font-weight:700;color:#1e3a5f}
td.muted{color:#94a3b8}td.strong{font-weight:800;color:#ea580c}
tfoot td{background:#0f172a;color:#fff;font-weight:800;padding:8px 6px;font-size:10.5px}
tfoot td.label{text-align:right;text-transform:uppercase;letter-spacing:.08em;font-size:8.5px}
tfoot td.hl{background:#ea580c}
.empty{text-align:center;padding:28px;color:#94a3b8;font-style:italic}
.note{margin-top:10px;font-size:8.5px;color:#64748b;line-height:1.5}
.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px;page-break-inside:avoid}
.sign{border:1px dashed #cbd5e1;border-radius:6px;height:70px;padding:6px 9px}
.sign label{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;font-weight:700}
.footer{margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8px;color:#94a3b8}
@media print{
  body{background:#fff}
  .sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}
  .footer{display:none}
}
</style></head><body>
<div class="sheet">
  <div class="header">
    <div class="brand">${PRINT_LOGO}
      <div>
        <div class="brand-name">BATI<b>XPERT</b></div>
        <div class="brand-tag">Construisons l'avenir avec une gestion intelligente</div>
      </div>
    </div>
    <div class="doc">
      <div class="doc-title">Etat Reliquat Fournisseur</div>
      <div class="doc-sub">Bons d'achat réglés dont le règlement dépasse le montant du bon</div>
      <dl class="doc-meta">
        <dt>Édité le</dt><dd>${escapeHtml(editedOn)} à ${escapeHtml(editedAt)}</dd>
        ${filters.editedBy ? `<dt>Édité par</dt><dd>${escapeHtml(filters.editedBy)}</dd>` : ''}
      </dl>
    </div>
  </div>

  <div class="criteria">
    <div class="criterion"><label>Période</label><div>${escapeHtml(filters.mois ? formatMois(filters.mois) : 'Tous les mois')}</div></div>
    <div class="criterion"><label>Fournisseur</label><div>${escapeHtml(filters.supplierName || 'Tous les fournisseurs')}</div></div>
    <div class="criterion"><label>Client</label><div>${escapeHtml(filters.client || 'Tous les clients')}</div></div>
  </div>

  <div class="kpis">
    <div class="kpi k1"><label>Nombre de bons</label><div>${totals.count}</div></div>
    <div class="kpi k2"><label>Montant des bons</label><div>${formatMontant(totals.total_montant_bon)}</div></div>
    <div class="kpi k3"><label>Total règlements</label><div>${formatMontant(totals.total_reg)}</div></div>
    <div class="kpi k4"><label>Total reliquat</label><div>${formatMontant(totals.total_reliquat)}</div></div>
  </div>

  <table>
    <thead><tr>
      <th class="c" style="width:26px">#</th>
      ${columns.map((c, i) => `<th class="${i >= 4 ? 'num' : i < 2 ? 'c' : ''}">${c}</th>`).join('')}
    </tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length + 1}" class="empty">Aucun bon d'achat avec reliquat pour ces critères</td></tr>`}</tbody>
    ${rows.length ? `<tfoot><tr>
      <td colspan="5" class="label">Total — ${totals.count} bon(s)</td>
      <td class="num">${formatMontant(totals.total_montant_bon)}</td>
      <td class="num">${formatMontant(totals.total_reg)}</td>
      <td class="num hl">${formatMontant(totals.total_reliquat)}</td>
    </tr></tfoot>` : ''}
  </table>

  <p class="note">Total Rég : règlements effectifs affectés au bon, hors règlements impayés, dévalidés ou reportés. Total Reliquat : Total Rég − Montant Bon.</p>

  <div class="signatures">
    <div class="sign"><label>Établi par</label></div>
    <div class="sign"><label>Visa comptabilité</label></div>
    <div class="sign"><label>Visa direction</label></div>
  </div>

  <div class="footer">
    <span>BatiXpert — Etat reliquat fournisseur</span>
    <span>Édité le ${escapeHtml(editedOn)} à ${escapeHtml(editedAt)}</span>
  </div>
</div>
</body></html>`;
}

function printOptions(filters) {
    return {
        title: 'Etat reliquat fournisseur',
        filename: `etat-reliquat-${filters.mois || new Date().toISOString().slice(0, 10)}`,
    };
}

export default function SupplierReliquatPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [filters, setFilters] = useState(emptyFilters);
    const [suppliers, setSuppliers] = useState([]);
    const [clients, setClients] = useState([]);
    const [rows, setRows] = useState([]);
    const [totals, setTotals] = useState(emptyTotals);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pdfBusy, setPdfBusy] = useState(false);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        const params = {};
        if (filters.mois) params.mois = filters.mois;
        if (filters.supplier_id) params.supplier_id = filters.supplier_id;
        if (filters.client) params.client = filters.client;

        api.get('/supplier-reliquats', { params })
            .then((r) => {
                setRows(r.data.data ?? []);
                setTotals({ ...emptyTotals, ...(r.data.meta ?? {}) });
            })
            .catch((err) => {
                setRows([]);
                setTotals(emptyTotals);
                setError(err.response?.data?.message || 'Impossible de charger l\'état reliquat.');
            })
            .finally(() => setLoading(false));
    }, [filters]);

    useEffect(() => {
        Promise.all([
            api.get('/suppliers', { params: { all: 1 } }),
            api.get('/clients', { params: { all: 1 } }),
        ])
            .then(([suppliersRes, clientsRes]) => {
                setSuppliers(suppliersRes.data.data ?? []);
                setClients(clientsRes.data.data ?? []);
            })
            .catch(() => {
                setSuppliers([]);
                setClients([]);
            });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const supplierName = suppliers.find((s) => String(s.id) === String(filters.supplier_id))?.name;

    const printHtml = () => buildPrintHtml({
        rows,
        totals,
        filters: {
            mois: filters.mois,
            supplierName,
            client: filters.client,
            editedBy: user?.name,
        },
    });

    const handlePrint = () => openPrintPreview(printHtml(), printOptions(filters));

    const handlePdf = () => {
        setPdfBusy(true);
        downloadPdf(printHtml(), printOptions(filters))
            .catch(() => window.alert('Impossible de générer le PDF.'))
            .finally(() => setPdfBusy(false));
    };

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 gap-3">
            <div className="shrink-0 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Etat reliquat fournisseur</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Bons d&apos;achat réglés dont le règlement dépasse le montant du bon</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={handlePdf} disabled={loading || pdfBusy} className="btn-danger text-xs">
                            <FileText className="w-3.5 h-3.5" /> {pdfBusy ? 'PDF…' : 'PDF'}
                        </button>
                        <button type="button" onClick={handlePrint} disabled={loading} className="btn-primary text-xs">
                            <Printer className="w-3.5 h-3.5" /> Imprimer
                        </button>
                        <button type="button" onClick={() => navigate('/')} className="btn-muted text-xs">
                            <X className="w-3.5 h-3.5" /> Fermer
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="px-4 py-2.5 rounded-xl text-sm border bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                        {error}
                    </div>
                )}

                <div className="glass-card p-3 shadow-card border border-slate-200/60 dark:border-slate-700/60">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.3fr_1.3fr_auto] gap-2.5 items-end">
                        <Field label="Mois">
                            <input type="month" value={filters.mois} onChange={(e) => setFilter('mois', e.target.value)} className={filterClass} />
                        </Field>
                        <Field label="Fournisseur">
                            <select value={filters.supplier_id} onChange={(e) => setFilter('supplier_id', e.target.value)} className={filterClass}>
                                <option value="">Tous les fournisseurs</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Client">
                            <select value={filters.client} onChange={(e) => setFilter('client', e.target.value)} className={filterClass}>
                                <option value="">Tous les clients</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </Field>
                        <div className="flex items-center gap-1.5 self-end">
                            <button type="button" onClick={load} disabled={loading} className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-brand-navy hover:bg-slate-50 dark:hover:bg-slate-800" title="Actualiser">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button type="button" onClick={() => setFilters(emptyFilters)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Réinitialiser les filtres">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60 flex flex-col">
                <div className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-orange-700 border-b border-white/10 shrink-0 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Tableau Etat Reliquat</h3>
                    <span className="text-[11px] font-semibold text-white/85 tabular-nums">{totals.count} bon(s)</span>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                                {columns.map((h) => (
                                    <th key={h} className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300 whitespace-nowrap text-center bg-slate-100 dark:bg-slate-800">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}>
                                        {columns.map((__, j) => (
                                            <td key={j} className="px-3 py-3 text-center">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[70px]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-orange-50/40 dark:hover:bg-slate-800/40">
                                        <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.date || '—'}</td>
                                        <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-brand-navy dark:text-orange-400">{row.reference}</td>
                                        <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.fournisseur || '—'}</td>
                                        <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{row.client || '—'}</td>
                                        <td className="px-3 py-2.5 text-center tabular-nums text-slate-700 dark:text-slate-200">{formatMontant(row.montant_bon)}</td>
                                        <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatMontant(row.total_reg)}</td>
                                        <td className="px-3 py-2.5 text-center tabular-nums font-bold text-orange-600 dark:text-orange-400">{formatMontant(row.reliquat)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                        Aucun bon d&apos;achat avec reliquat pour ces critères
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {!loading && rows.length > 0 && (
                            <tfoot className="sticky bottom-0">
                                <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                                    <td colSpan={4} className="px-3 py-3 text-right text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">Total</td>
                                    <td className="px-3 py-3 text-center tabular-nums text-slate-800 dark:text-white">{formatMontant(totals.total_montant_bon)}</td>
                                    <td className="px-3 py-3 text-center tabular-nums text-emerald-700 dark:text-emerald-400">{formatMontant(totals.total_reg)}</td>
                                    <td className="px-3 py-3 text-center tabular-nums text-orange-600 dark:text-orange-400">{formatMontant(totals.total_reliquat)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
