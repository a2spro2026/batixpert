import { useCallback, useEffect, useState } from 'react';
import {
    Plus, Eye, EyeOff, Pencil, Trash2, Printer, FileText, X, RefreshCw, Receipt, Upload, Image, Package,
} from 'lucide-react';
import api from '../lib/api';

const DEPOT_OPTIONS = [
    { value: 'depot_a', label: 'Ste A. BOUYAHYA' },
    { value: 'depot_b', label: 'Ste Fatari et Associes' },
    { value: 'depot_c', label: 'Ste Aabach Lilbinae' },
];

const emptyLine = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    article_reference: '',
    description: '',
    quantity: '1',
    unit_price: '',
});

const emptyForm = {
    supplier_id: '',
    depot: 'depot_a',
    reference: '',
    invoice_date: '',
    payment_mode: '',
    photo: null,
    photo_url: null,
};

function Field({ label, children }) {
    return (
        <div className="min-w-0">
            <label className="field-label field-label-compact">{label}</label>
            {children}
        </div>
    );
}

const inputClass =
    'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs text-center outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy transition-all';
const lineInput =
    'w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-1.5 py-1 text-[11px] text-center outline-none focus:ring-1 focus:ring-brand-navy/30';

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQty(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

function lineTotal(line) {
    const qty = parseFloat(String(line.quantity).replace(',', '.')) || 0;
    const price = parseFloat(String(line.unit_price).replace(',', '.')) || 0;
    return qty * price;
}

function ActionBtn({ title, icon: Icon, color = 'slate', onClick }) {
    const colors = {
        blue: 'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400',
        amber: 'hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400',
        red: 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400',
        orange: 'hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400',
        slate: 'hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
    };
    return (
        <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg text-slate-400 transition-colors ${colors[color]}`}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
    );
}

function DepotBadge({ label }) {
    const tones = {
        'Ste A. BOUYAHYA': 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        'Ste Fatari et Associes': 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
        'Ste Aabach Lilbinae': 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    };
    const tone = tones[label] || 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${tone}`}>
            {label}
        </span>
    );
}

function buildPrintHtml(row) {
    const itemsRows = (row.items || []).map((i) =>
        `<tr><td>${i.article_reference || '—'}</td><td>${i.description || '—'}</td><td>${i.quantity}</td><td>${formatMontant(i.unit_price)}</td><td><strong>${formatMontant(i.total)}</strong></td></tr>`
    ).join('') || '<tr><td colspan="5">—</td></tr>';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Facture ${row.reference}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{color:#1e3a5f;font-size:22px}
table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e2e8f0;padding:8px;font-size:12px;text-align:center}
th{background:#f8fafc;font-weight:700}.badge{background:#dbeafe;color:#1d4ed8;padding:4px 10px;border-radius:999px;font-weight:700}
</style></head><body>
<h1>BATIXPERT — Facture Achat <span class="badge">${row.reference || ''}</span></h1>
<table>
<tr><th>Date</th><td>${row.invoice_date || '—'}</td><th>Fournisseur</th><td>${row.fournisseur || '—'}</td></tr>
<tr><th>Destination</th><td>${row.depot_label || '—'}</td><th>Mode Paiement</th><td>${row.payment_mode || '—'}</td></tr>
<tr><th>Total HT</th><td>${formatMontant(row.total_ht)}</td><th>TVA</th><td>${formatMontant(row.tva)}</td></tr>
<tr><th>Total TTC</th><td colspan="3"><strong>${formatMontant(row.total_ttc)}</strong></td></tr>
</table>
<table><thead><tr><th>Réf Article</th><th>Désignation</th><th>Qté</th><th>P/U</th><th>Total</th></tr></thead><tbody>${itemsRows}</tbody></table>
</body></html>`;
}

function openPrintable(row) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(buildPrintHtml(row));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
}

function ViewModal({ row, onClose }) {
    if (!row) return null;
    const fields = [
        ['N° Facture', row.reference],
        ['Date', row.invoice_date],
        ['Fournisseur', row.fournisseur],
        ['Destination', row.depot_label],
        ['Mode Paiement', row.payment_mode],
        ['Total HT', formatMontant(row.total_ht)],
        ['TVA', formatMontant(row.tva)],
        ['Total TTC', formatMontant(row.total_ttc)],
    ];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-navy to-blue-800">
                    <div>
                        <p className="text-[10px] text-blue-200 uppercase tracking-wider">Facture Achat</p>
                        <h3 className="text-white font-bold">{row.reference}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-2 text-sm max-h-[50vh] overflow-y-auto">
                    {fields.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 shrink-0">{label}</span>
                            <span className="font-medium text-slate-800 dark:text-white text-right">{value || '—'}</span>
                        </div>
                    ))}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-navy dark:text-orange-400 pt-2">Lignes</p>
                    {(row.items || []).map((i, idx) => (
                        <div key={i.id || idx} className="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs">
                            <div className="font-semibold">{i.article_reference ? `${i.article_reference} — ` : ''}{i.description}</div>
                            <div className="text-slate-500 mt-0.5">{i.quantity} × {formatMontant(i.unit_price)} = <strong>{formatMontant(i.total)}</strong></div>
                        </div>
                    ))}
                    {row.photo_url && (
                        <a href={row.photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand-navy dark:text-orange-400 font-semibold hover:underline pt-2">
                            <Image className="w-4 h-4" /> Voir la photo
                        </a>
                    )}
                </div>
                <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button type="button" onClick={() => openPrintable(row)} className="btn-secondary text-xs flex-1"><Printer className="w-3.5 h-3.5" /> Imprimer</button>
                    <button type="button" onClick={() => openPrintable(row)} className="btn-primary text-xs flex-1"><FileText className="w-3.5 h-3.5" /> PDF</button>
                </div>
            </div>
        </div>
    );
}

function FormModal({ open, form, lines, meta, editingId, saving, error, suppliers, depotLocked = false, onChange, onLineChange, onAddLine, onRemoveLine, onClose, onSubmit }) {
    if (!open) return null;

    const totalHt = lines.reduce((sum, l) => sum + lineTotal(l), 0);
    const tva = totalHt * 0.2;
    const totalTtc = totalHt + tva;
    const depotLabel = DEPOT_OPTIONS.find((d) => d.value === form.depot)?.label || form.depot || '—';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-brand-navy via-blue-800 to-indigo-900 shrink-0">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wide min-w-0 truncate">
                        {editingId ? `Modifier ${form._ref || ''}` : 'Nouvelle Facture Achat'}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-white/80 whitespace-nowrap">
                                Destination achats
                            </label>
                            {depotLocked ? (
                                <input
                                    type="text"
                                    readOnly
                                    value={depotLabel}
                                    className="min-w-[180px] max-w-[260px] rounded-lg border border-white/20 bg-white/10 text-white/90 px-2.5 py-1.5 text-xs cursor-not-allowed opacity-80"
                                    title={depotLabel}
                                />
                            ) : (
                                <select
                                    required
                                    value={form.depot}
                                    onChange={(e) => onChange('depot', e.target.value)}
                                    className="min-w-[180px] max-w-[240px] rounded-lg border border-white/25 bg-white/15 text-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-white/30"
                                >
                                    {DEPOT_OPTIONS.map((d) => (
                                        <option key={d.value} value={d.value} className="text-slate-900">{d.label}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"><X className="w-4 h-4" /></button>
                    </div>
                </div>

                <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-800">{error}</div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                            <div className="lg:col-span-2">
                            <Field label="Date">
                                <input type="date" required value={form.invoice_date} onChange={(e) => onChange('invoice_date', e.target.value)} className={inputClass} />
                            </Field>
                            </div>
                            <div className="lg:col-span-2">
                            <Field label="N° Facture">
                                <input type="text" required value={form.reference} onChange={(e) => onChange('reference', e.target.value)} placeholder="N° facture" className={inputClass} />
                            </Field>
                            </div>
                            <div className="lg:col-span-4">
                            <Field label="Fournisseur">
                                <select required value={form.supplier_id} onChange={(e) => onChange('supplier_id', e.target.value)} className={inputClass}>
                                    <option value="">—</option>
                                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </Field>
                            </div>
                            <div className="lg:col-span-4">
                            <Field label="Mode Paiement">
                                <input type="text" value={form.payment_mode} onChange={(e) => onChange('payment_mode', e.target.value)} placeholder="Espèces, chèque, virement..." className={inputClass} />
                            </Field>
                            </div>
                            <div className="sm:col-span-2 lg:col-span-12">
                                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-brand-navy/40 dark:border-orange-400/40 text-xs font-semibold text-brand-navy dark:text-orange-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
                                    <Upload className="w-4 h-4" />
                                    Importer Photo
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange('photo', e.target.files?.[0] || null)} />
                                </label>
                                <span className="ml-2 text-xs text-slate-500">
                                    {form.photo?.name || (form.photo_url ? 'Photo existante' : 'Aucune photo')}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Lignes facture</p>
                                <button type="button" onClick={onAddLine} className="text-xs text-brand-navy dark:text-orange-400 font-semibold hover:underline">+ Ligne</button>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-xs min-w-[650px]">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/80">
                                            {['Réf Article', 'Désignation', 'Qté', 'P/U', 'Total', ''].map((h) => (
                                                <th key={h || 'x'} className="px-2 py-2 font-bold uppercase text-slate-500">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {lines.map((line) => (
                                            <tr key={line.key}>
                                                <td className="px-2 py-1.5 w-32">
                                                    <input type="text" value={line.article_reference} onChange={(e) => onLineChange(line.key, 'article_reference', e.target.value)} placeholder="Réf Article" className={lineInput} />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <input type="text" required value={line.description} onChange={(e) => onLineChange(line.key, 'description', e.target.value)} placeholder="Désignation" className={lineInput} />
                                                </td>
                                                <td className="px-2 py-1.5 w-20">
                                                    <input type="number" step="0.001" min="0.001" required value={line.quantity} onChange={(e) => onLineChange(line.key, 'quantity', e.target.value)} className={lineInput} />
                                                </td>
                                                <td className="px-2 py-1.5 w-24">
                                                    <input type="number" step="0.01" min="0" required value={line.unit_price} onChange={(e) => onLineChange(line.key, 'unit_price', e.target.value)} className={lineInput} />
                                                </td>
                                                <td className="px-2 py-1.5 text-center font-semibold tabular-nums w-24">{formatMontant(lineTotal(line))}</td>
                                                <td className="px-2 py-1.5 w-10">
                                                    {lines.length > 1 && (
                                                        <button type="button" onClick={() => onRemoveLine(line.key)} className="p-1 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end gap-4 mt-3 text-sm">
                                <span>HT : <strong className="tabular-nums">{formatMontant(totalHt)}</strong></span>
                                <span>TVA : <strong className="tabular-nums">{formatMontant(tva)}</strong></span>
                                <span>TTC : <strong className="tabular-nums text-brand-navy dark:text-orange-400">{formatMontant(totalTtc)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                        <button type="button" onClick={onClose} className="btn-secondary text-xs px-4">Fermer</button>
                        <button type="submit" disabled={saving} className="btn-primary text-xs px-4">{saving ? '...' : 'Valider'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function FactureAchatsPage({ depotFilter = null, pageTitle = '', pageSubtitle = '' }) {
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ total_ht: 0, total_ttc: 0, count: 0 });
    const [meta, setMeta] = useState({ next_ref: 'FA-0001', date_raw: '' });
    const [suppliers, setSuppliers] = useState([]);
    const [form, setForm] = useState({ ...emptyForm, depot: depotFilter || 'depot_a' });
    const [lines, setLines] = useState([emptyLine()]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [viewRow, setViewRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [stockVisible, setStockVisible] = useState(false);
    const [stockRows, setStockRows] = useState([]);
    const [stockLoading, setStockLoading] = useState(false);

    const loadMeta = useCallback(() => {
        api.get('/supplier-invoices/meta').then((r) => setMeta(r.data ?? {})).catch(() => {});
    }, []);

    const loadSuppliers = useCallback(() => {
        api.get('/suppliers', { params: { all: 1 } }).then((r) => setSuppliers(r.data.data ?? r.data ?? [])).catch(() => setSuppliers([]));
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (depotFilter) params.depot = depotFilter;
        api.get('/supplier-invoices', { params })
            .then((r) => {
                setRows(r.data.data ?? []);
                setSummary({
                    total_ht: Number(r.data.meta?.total_ht) || 0,
                    total_ttc: Number(r.data.meta?.total_ttc) || 0,
                    count: Number(r.data.meta?.count) || 0,
                });
            })
            .catch(() => {
                setRows([]);
                setSummary({ total_ht: 0, total_ttc: 0, count: 0 });
            })
            .finally(() => setLoading(false));
    }, [depotFilter]);

    useEffect(() => {
        loadMeta();
        loadSuppliers();
        load();
    }, [load, loadMeta, loadSuppliers]);

    const onChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const onLineChange = (key, field, value) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
    const onAddLine = () => setLines((prev) => [...prev, emptyLine()]);
    const onRemoveLine = (key) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

    const openNouveau = () => {
        const today = meta.date_raw || new Date().toISOString().slice(0, 10);
        setForm({
            ...emptyForm,
            depot: depotFilter || 'depot_a',
            invoice_date: today,
            reference: '',
        });
        setLines([emptyLine()]);
        setEditingId(null);
        setError('');
        loadMeta();
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setForm({
            supplier_id: row.supplier_id || '',
            depot: row.depot || depotFilter || 'depot_a',
            reference: row.reference || '',
            invoice_date: row.invoice_date_raw || '',
            payment_mode: row.payment_mode || '',
            photo: null,
            photo_url: row.photo_url || null,
            _ref: row.reference || '',
        });
        setLines((row.items?.length ? row.items : [{ article_reference: '', description: '', quantity: 1, unit_price: 0 }]).map((i) => ({
            key: `${i.id || Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            article_reference: i.article_reference || '',
            description: i.description || '',
            quantity: String(i.quantity ?? 1),
            unit_price: String(i.unit_price ?? ''),
        })));
        setEditingId(row.id);
        setError('');
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        setError('');
        setForm(emptyForm);
        setLines([emptyLine()]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const payload = new FormData();
            payload.append('supplier_id', form.supplier_id);
            payload.append('depot', form.depot);
            payload.append('reference', form.reference);
            payload.append('invoice_date', form.invoice_date);
            payload.append('payment_mode', form.payment_mode || '');
            if (form.photo) payload.append('photo', form.photo);
            lines.forEach((line, index) => {
                payload.append(`items[${index}][article_reference]`, line.article_reference || '');
                payload.append(`items[${index}][description]`, line.description);
                payload.append(`items[${index}][quantity]`, parseFloat(String(line.quantity).replace(',', '.')) || 0);
                payload.append(`items[${index}][unit_price]`, parseFloat(String(line.unit_price).replace(',', '.')) || 0);
            });
            if (editingId) {
                payload.append('_method', 'PUT');
                await api.post(`/supplier-invoices/${editingId}`, payload);
            } else {
                await api.post('/supplier-invoices', payload);
            }
            closeModal();
            load();
            loadMeta();
            if (stockVisible) loadStock();
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Supprimer la facture ${row.reference} ?`)) return;
        try {
            await api.delete(`/supplier-invoices/${row.id}`);
            if (editingId === row.id) closeModal();
            load();
            if (stockVisible) loadStock();
        } catch {
            setError('Impossible de supprimer cette facture');
        }
    };

    const loadStock = async () => {
        setStockLoading(true);
        try {
            const response = await api.get('/supplier-invoices/stock', { params: { depot: depotFilter } });
            setStockRows(response.data.data ?? []);
        } catch {
            setStockRows([]);
        } finally {
            setStockLoading(false);
        }
    };

    const toggleStock = () => {
        const nextVisible = !stockVisible;
        setStockVisible(nextVisible);
        if (nextVisible && !stockRows.length) loadStock();
    };

    const headers = ['Date', 'N° Facture', 'Fournisseur', 'Destination', 'Mode Paiement', 'Total HT', 'TVA', 'Total TTC', 'Actions'];

    const accent = depotFilter === 'depot_b'
        ? 'from-violet-600 via-purple-700 to-indigo-900'
        : depotFilter === 'depot_c'
            ? 'from-emerald-600 via-teal-700 to-slate-900'
            : depotFilter === 'depot_a'
                ? 'from-blue-600 via-brand-navy to-slate-900'
                : 'from-brand-navy via-blue-800 to-indigo-900';

    return (
        <div className="space-y-3">
            <ViewModal row={viewRow} onClose={() => setViewRow(null)} />
            <FormModal
                open={modalOpen}
                form={form}
                lines={lines}
                meta={meta}
                editingId={editingId}
                saving={saving}
                error={error}
                suppliers={suppliers}
                depotLocked={Boolean(depotFilter)}
                onChange={onChange}
                onLineChange={onLineChange}
                onAddLine={onAddLine}
                onRemoveLine={onRemoveLine}
                onClose={closeModal}
                onSubmit={handleSubmit}
            />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">{pageTitle}</h1>
                    {pageSubtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{pageSubtitle}</p>}
                </div>
                <div className="flex items-center gap-2 self-start">
                    {depotFilter && (
                        <button type="button" onClick={toggleStock} className="btn-secondary text-sm">
                            {stockVisible ? <EyeOff className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            Stock {stockVisible ? '(Masquer)' : '(Afficher)'}
                        </button>
                    )}
                    <button type="button" onClick={openNouveau} className="btn-primary text-sm">
                        <Plus className="w-4 h-4" /> Nouveau
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-3xl -mt-1">
                <div className="rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 p-4 text-white shadow-lg">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Nombre</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{summary.count}</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-4 text-white shadow-lg">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Total HT</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{formatMontant(summary.total_ht)}</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 p-4 text-white shadow-lg">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Total TTC</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{formatMontant(summary.total_ttc)}</p>
                </div>
            </div>

            {stockVisible && (
                <div className="glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                    <div className={`px-5 py-3 bg-gradient-to-r ${accent} text-white flex items-center justify-between`}>
                        <h3 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                            <Package className="w-4 h-4" /> Stock - {pageTitle}
                        </h3>
                        <button type="button" onClick={toggleStock} className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10" title="Masquer">
                            <EyeOff className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                        <table className="w-full text-sm min-w-[700px]">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                                    {['Réf', 'Désignation', 'Stock Initial', 'Vente/mois', 'Stock Actuel'].map((heading) => (
                                        <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 text-center">{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stockLoading ? (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Chargement...</td></tr>
                                ) : stockRows.length ? stockRows.map((stock) => (
                                    <tr key={`${stock.reference}-${stock.designation}`} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-2.5 text-center font-mono text-xs font-semibold text-brand-navy dark:text-orange-400">{stock.reference || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{stock.designation || '—'}</td>
                                        <td className="px-4 py-2.5 text-center tabular-nums">{formatQty(stock.stock_initial)}</td>
                                        <td className="px-4 py-2.5 text-center tabular-nums text-rose-700 dark:text-rose-400">{formatQty(stock.vente_mois)}</td>
                                        <td className="px-4 py-2.5 text-center tabular-nums font-bold text-brand-navy dark:text-orange-400">{formatQty(stock.stock_actuel)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Aucun produit en stock</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className={`px-5 py-3.5 bg-gradient-to-r ${accent} border-b border-white/10 flex items-center justify-between`}>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Liste des factures
                    </h3>
                    <button type="button" onClick={load} disabled={loading} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Actualiser">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1000px]">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-100 via-slate-200/90 to-slate-100 dark:from-slate-800 dark:via-slate-700/80 dark:to-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                                {headers.map((h) => (
                                    <th key={h} className="px-3 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 whitespace-nowrap text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i}>{[...Array(9)].map((__, j) => (
                                        <td key={j} className="px-3 py-3 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" /></td>
                                    ))}</tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.invoice_date}</td>
                                        <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-brand-navy dark:text-orange-400">{row.reference}</td>
                                        <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.fournisseur}</td>
                                        <td className="px-3 py-2.5 text-center"><DepotBadge label={row.depot_label} /></td>
                                        <td className="px-3 py-2.5 text-center text-xs text-slate-600 dark:text-slate-300">{row.payment_mode || '—'}</td>
                                        <td className="px-3 py-2.5 text-center tabular-nums font-semibold">{formatMontant(row.total_ht)}</td>
                                        <td className="px-3 py-2.5 text-center tabular-nums">{formatMontant(row.tva)}</td>
                                        <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-brand-navy dark:text-orange-400">{formatMontant(row.total_ttc)}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <ActionBtn title="Voir" icon={Eye} color="blue" onClick={() => setViewRow(row)} />
                                                <ActionBtn title="Modifier" icon={Pencil} color="amber" onClick={() => openEdit(row)} />
                                                <ActionBtn title="Imprimer" icon={Printer} color="slate" onClick={() => openPrintable(row)} />
                                                <ActionBtn title="PDF" icon={FileText} color="orange" onClick={() => openPrintable(row)} />
                                                <ActionBtn title="Supprimer" icon={Trash2} color="red" onClick={() => handleDelete(row)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Aucune facture enregistrée</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
