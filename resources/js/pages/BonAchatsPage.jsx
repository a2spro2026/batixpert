import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, Plus, Eye, Pencil, Trash2, Printer, FileText, X, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import DesignationPicker from '../components/DesignationPicker';

const CONSISTANCE_OPTIONS = ['', 'F', 'M', 'F+M'];
const UNIT_OPTIONS = ['', 'JEU', 'KG', 'KM', 'KM-UNIF', 'M', 'M²', 'M³', 'ML', 'T', 'U'];
const REGLEMENT_OPTIONS = ['', 'Esp', 'Chq', 'Eff', 'Vir', 'Vers'];
const ECHEANCE_OPTIONS = ['', 'Esp', 'A vue', '30Jrs', '45Jrs', '60Jrs', '75Jrs', '90Jrs'];
const CHANTIER_TYPE_OPTIONS = ['', 'Public', 'Privé'];

const emptyForm = {
    supplier_id: '',
    order_date: '',
    designation: '',
    consistance: '',
    unit: '',
    unit_price: '',
    subtotal: '',
    reglement: '',
    echeance: '',
    city: '',
    address: '',
    chantier_type: '',
    responsible_name: '',
};

function Field({ label, children, className = '', compact = false }) {
    return (
        <div className={className}>
            <label className={`block font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 truncate text-center ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                {label}
            </label>
            {children}
        </div>
    );
}

const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-1.5 text-xs text-center outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy transition-all';
const inputCompact = `${inputClass} py-1 text-[11px]`;
const readOnlyClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-2 py-1.5 text-xs text-center cursor-not-allowed';
const readOnlyCompact = `${readOnlyClass} py-1 text-[11px]`;

function formatMontant(value) {
    const n = Number(value) || 0;
    return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildBonHtml(row) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bon ${row.reference}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{color:#1e3a5f;font-size:22px}
table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #e2e8f0;padding:10px;font-size:13px;text-align:center}
th{background:#f8fafc;font-weight:600}.badge{background:#fff7ed;color:#ea580c;padding:4px 10px;border-radius:999px;font-weight:700}
</style></head><body>
<h1>BATIXPERT — Bon d'Achat</h1>
<table>
<tr><th>Date</th><td>${row.order_date || '—'}</td></tr>
<tr><th>Réf Bon</th><td><span class="badge">${row.reference}</span></td></tr>
<tr><th>Fournisseur</th><td>${row.fournisseur || '—'}</td></tr>
<tr><th>Désignation</th><td>${row.designation || '—'}</td></tr>
<tr><th>Consistance</th><td>${row.consistance || '—'}</td></tr>
<tr><th>Unité</th><td>${row.unit || '—'}</td></tr>
<tr><th>Prix U</th><td>${formatMontant(row.unit_price)}</td></tr>
<tr><th>Sous-Total</th><td><strong>${formatMontant(row.subtotal)}</strong></td></tr>
<tr><th>Règlement</th><td>${row.reglement || '—'}</td></tr>
<tr><th>Échéance</th><td>${row.echeance || '—'}</td></tr>
<tr><th>Ville</th><td>${row.city || '—'}</td></tr>
<tr><th>Adresse</th><td>${row.address || '—'}</td></tr>
<tr><th>Type Chantier</th><td>${row.chantier_type || '—'}</td></tr>
<tr><th>Responsable</th><td>${row.responsible_name || '—'}</td></tr>
</table></body></html>`;
}

function openPrintable(row) {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(buildBonHtml(row));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
}

function ActionBtn({ title, onClick, icon: Icon, color = 'slate' }) {
    const colors = {
        blue: 'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400',
        amber: 'hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400',
        red: 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400',
        slate: 'hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        orange: 'hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400',
    };
    return (
        <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg text-slate-400 transition-colors ${colors[color]}`}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
    );
}

function ViewModal({ row, onClose }) {
    if (!row) return null;
    const fields = [
        ['Date', row.order_date], ['Réf Bon', row.reference], ['Fournisseur', row.fournisseur],
        ['Désignation', row.designation], ['Consistance', row.consistance], ['Unité', row.unit],
        ['Prix U', formatMontant(row.unit_price)], ['Sous-Total', formatMontant(row.subtotal)],
        ['Règlement', row.reglement], ['Échéance', row.echeance], ['Ville', row.city],
        ['Adresse', row.address], ['Type Chantier', row.chantier_type], ['Responsable', row.responsible_name],
    ];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-navy to-blue-800">
                    <div>
                        <p className="text-[10px] text-blue-200 uppercase tracking-wider">Bon d'Achat</p>
                        <h3 className="text-white font-bold">{row.reference}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-2 text-sm max-h-[60vh] overflow-y-auto">
                    {fields.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
                            <span className="font-medium text-slate-800 dark:text-white text-right">{value || '—'}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button type="button" onClick={() => openPrintable(row)} className="btn-secondary text-xs flex-1"><Printer className="w-3.5 h-3.5" /> Imprimer</button>
                    <button type="button" onClick={() => openPrintable(row)} className="btn-primary text-xs flex-1"><FileText className="w-3.5 h-3.5" /> PDF</button>
                </div>
            </div>
        </div>
    );
}

export default function BonAchatsPage() {
    const [form, setForm] = useState(emptyForm);
    const [rows, setRows] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [meta, setMeta] = useState({ next_ref: '—', date: '—' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [viewRow, setViewRow] = useState(null);

    const subtotalCalc = useMemo(() => {
        const price = parseFloat(form.unit_price) || 0;
        return price.toFixed(2);
    }, [form.unit_price]);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            api.get('/purchase-orders', { params: { all: 1 } }),
            api.get('/suppliers', { params: { all: 1 } }),
            api.get('/products', { params: { all: 1 } }),
        ])
            .then(([ordersRes, suppliersRes, productsRes]) => {
                setRows(ordersRes.data.data ?? []);
                setMeta(ordersRes.data.meta ?? { next_ref: '—', date: '—' });
                setSuppliers(suppliersRes.data.data ?? []);
                setProducts(productsRes.data.data ?? []);
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setForm((f) => ({ ...f, order_date: new Date().toISOString().slice(0, 10) }));
        load();
    }, [load]);

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const handleDesignationSelect = (product) => {
        setForm((f) => ({
            ...f,
            designation: product.name,
            consistance: product.consistance || f.consistance,
            unit: product.unit || f.unit,
        }));
    };

    const resetForm = () => {
        setForm({ ...emptyForm, order_date: new Date().toISOString().slice(0, 10) });
        setEditingId(null);
        setError('');
        load();
    };

    const handleNewBon = () => {
        resetForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const fillForm = (row) => {
        setForm({
            supplier_id: row.supplier_id || '',
            order_date: row.order_date_raw || '',
            designation: row.designation || '',
            consistance: row.consistance || '',
            unit: row.unit || '',
            unit_price: row.unit_price ?? '',
            subtotal: row.subtotal ?? '',
            reglement: row.reglement || '',
            echeance: row.echeance || '',
            city: row.city || '',
            address: row.address || '',
            chantier_type: row.chantier_type || '',
            responsible_name: row.responsible_name || '',
        });
        setEditingId(row.id);
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Supprimer le bon « ${row.reference} » ?`)) return;
        try {
            await api.delete(`/purchase-orders/${row.id}`);
            if (editingId === row.id) resetForm();
            load();
        } catch {
            setError('Impossible de supprimer ce bon d\'achat');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        const payload = {
            ...form,
            supplier_id: form.supplier_id,
            order_date: form.order_date || new Date().toISOString().slice(0, 10),
            unit_price: parseFloat(form.unit_price) || 0,
            subtotal: parseFloat(subtotalCalc) || 0,
            quantity: 1,
        };
        try {
            if (editingId) {
                await api.put(`/purchase-orders/${editingId}`, payload);
            } else {
                await api.post('/purchase-orders', payload);
            }
            resetForm();
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
        } finally {
            setSaving(false);
        }
    };

    const currentRef = editingId
        ? rows.find((r) => r.id === editingId)?.reference ?? meta.next_ref
        : meta.next_ref;

    return (
        <div className="space-y-6">
            <ViewModal row={viewRow} onClose={() => setViewRow(null)} />

            <form onSubmit={handleSubmit} className="glass-card p-4 lg:p-5 shadow-card border border-slate-200/60 dark:border-slate-700/60">
                {error && (
                    <div className="mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-800">{error}</div>
                )}
                {editingId && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-800">
                        Mode modification — Mettez à jour puis enregistrez
                    </div>
                )}

                <div className="overflow-x-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid xl:grid-cols-[68px_72px_minmax(110px,1fr)_minmax(130px,1.3fr)_58px_68px_72px_82px_68px_72px_82px_72px_minmax(100px,1fr)_minmax(90px,1fr)] gap-2 items-end min-w-[1280px]">
                        <Field label="Date" compact>
                            <input type="text" readOnly value={meta.date} className={readOnlyCompact} />
                        </Field>
                        <Field label="Réf Bon" compact>
                            <input type="text" readOnly value={currentRef} className={readOnlyCompact} />
                        </Field>
                        <Field label="Fournisseur">
                            <select required value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)} className={inputClass}>
                                <option value="">— Sélectionner —</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Désignation">
                            <DesignationPicker
                                products={products}
                                value={form.designation}
                                onSelect={handleDesignationSelect}
                            />
                        </Field>
                        <Field label="Consistance" compact>
                            <select value={form.consistance} onChange={(e) => set('consistance', e.target.value)} className={inputCompact}>
                                {CONSISTANCE_OPTIONS.map((v) => <option key={v || 'e'} value={v}>{v || '—'}</option>)}
                            </select>
                        </Field>
                        <Field label="Unité" compact>
                            <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className={inputCompact}>
                                {UNIT_OPTIONS.map((v) => <option key={v || 'e'} value={v}>{v || '—'}</option>)}
                            </select>
                        </Field>
                        <Field label="Prix U" compact>
                            <input type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} className={inputCompact} placeholder="0.00" />
                        </Field>
                        <Field label="Sous-Total" compact>
                            <input type="text" readOnly value={subtotalCalc ? `${parseFloat(subtotalCalc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}` : ''} className={readOnlyCompact} />
                        </Field>
                        <Field label="Règlement" compact>
                            <select value={form.reglement} onChange={(e) => set('reglement', e.target.value)} className={inputCompact}>
                                {REGLEMENT_OPTIONS.map((v) => <option key={v || 'e'} value={v}>{v || '—'}</option>)}
                            </select>
                        </Field>
                        <Field label="Échéance" compact>
                            <select value={form.echeance} onChange={(e) => set('echeance', e.target.value)} className={inputCompact}>
                                {ECHEANCE_OPTIONS.map((v) => <option key={v || 'e'} value={v}>{v || '—'}</option>)}
                            </select>
                        </Field>
                        <Field label="Type Chantier" compact>
                            <select value={form.chantier_type} onChange={(e) => set('chantier_type', e.target.value)} className={inputCompact}>
                                {CHANTIER_TYPE_OPTIONS.map((v) => <option key={v || 'e'} value={v}>{v || '—'}</option>)}
                            </select>
                        </Field>
                        <Field label="Ville">
                            <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ville" className={inputClass} />
                        </Field>
                        <Field label="Adresse">
                            <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Adresse" className={inputClass} />
                        </Field>
                        <Field label="Responsable">
                            <input type="text" value={form.responsible_name} onChange={(e) => set('responsible_name', e.target.value)} placeholder="Responsable" className={inputClass} />
                        </Field>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button type="submit" disabled={saving} className="btn-primary text-sm">
                        <Save className="w-4 h-4" />
                        {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Enregistrer'}
                    </button>
                    <button type="button" onClick={handleNewBon} className="btn-secondary text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <Plus className="w-4 h-4" />
                        Nouveau Bon
                    </button>
                    <button type="button" onClick={load} disabled={loading} className="btn-secondary text-sm" title="Actualiser">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualiser
                    </button>
                    {editingId && (
                        <button type="button" onClick={handleNewBon} className="btn-secondary text-sm">
                            <RotateCcw className="w-4 h-4" /> Annuler
                        </button>
                    )}
                </div>
            </form>

            {/* Tableau */}
            <div className="glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-orange-700 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Liste des bons d'achat</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                {['Date', 'Fournisseur', 'Bon N°', 'Montant', 'Ville', 'Type Chantier', 'Nom Responsable', 'Actions'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}>{[...Array(8)].map((__, j) => (
                                        <td key={j} className="px-4 py-3 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" /></td>
                                    ))}</tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className={`hover:bg-orange-50/40 dark:hover:bg-slate-800/40 transition-colors ${editingId === row.id ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.order_date}</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.fournisseur || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-mono text-xs font-semibold text-brand-navy dark:text-orange-400">{row.reference}</td>
                                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-brand-navy dark:text-orange-400">{formatMontant(row.montant)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{row.city || '—'}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${row.chantier_type === 'Public' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'}`}>
                                                {row.chantier_type || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.responsible_name || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <ActionBtn title="Voir" icon={Eye} color="blue" onClick={() => setViewRow(row)} />
                                                <ActionBtn title="Modifier" icon={Pencil} color="amber" onClick={() => fillForm(row)} />
                                                <ActionBtn title="Supprimer" icon={Trash2} color="red" onClick={() => handleDelete(row)} />
                                                <ActionBtn title="Imprimer" icon={Printer} color="slate" onClick={() => openPrintable(row)} />
                                                <ActionBtn title="PDF" icon={FileText} color="orange" onClick={() => openPrintable(row)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Aucun bon d'achat enregistré</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
