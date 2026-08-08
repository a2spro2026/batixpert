import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Plus, PlusCircle, XCircle, Eye, Pencil, Trash2, Printer, FileText, X, Package, Wallet, Scale } from 'lucide-react';
import api from '../lib/api';

const UNIT_OPTIONS = ['', 'Kg', 'U', 'Sac', 'ML', 'M²', 'M³', 'Tn', 'M'];
const REGLEMENT_OPTIONS = ['', 'Esp', 'Chq', 'Eff', 'Vir', 'Vers'];
const ECHEANCE_OPTIONS = ['', '45 Jrs', '60 Jrs', '90 Jrs', '120 Jrs'];

const emptyHeader = {
    supplier_id: '',
    order_date: '',
    city: '',
    client_livre: '',
    reglement: '',
    echeance: '',
    bc_number: '',
    chauffeur: '',
    matricule: '',
};

const emptyLine = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product_id: '',
    article_ref: '',
    description: '',
    unit: '',
    quantity: '1',
    unit_price: '',
});

function Field({ label, children, className = '' }) {
    return (
        <div className={`min-w-0 ${className}`}>
            <label className="field-label field-label-compact">{label}</label>
            {children}
        </div>
    );
}

const inputClass =
    'w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-1.5 py-1 text-[11px] text-center outline-none focus:ring-1 focus:ring-brand-navy/30 focus:border-brand-navy transition-all';
const readOnlyClass =
    'w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-1.5 py-1 text-[11px] text-center cursor-not-allowed';
const tableInput =
    'w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-1.5 py-1 text-[11px] text-center outline-none focus:ring-1 focus:ring-brand-navy/30 focus:border-brand-navy';

function formatMontant(value) {
    return (Number(value) || 0).toFixed(2);
}

function formatMontantDisplay(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineSubtotal(line) {
    const qty = parseFloat(String(line.quantity).replace(',', '.')) || 0;
    const price = parseFloat(String(line.unit_price).replace(',', '.')) || 0;
    return (qty * price).toFixed(2);
}

function orderTotalQuantity(order) {
    if (order.items?.length) {
        return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }

    return Number(order.quantity) || 0;
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
<h1>BATIXPERT — Bon d'Achat <span class="badge">${row.reference}</span></h1>
<table>
<tr><th>Date</th><td>${row.order_date || '—'}</td><th>Fournisseur</th><td>${row.fournisseur || '—'}</td></tr>
<tr><th>N° Frns</th><td>${row.bc_number || '—'}</td><th>Client Livré</th><td>${row.client_livre || '—'}</td></tr>
<tr><th>Ville Livraison</th><td>${row.city || '—'}</td><th>Type Rég / Échéance</th><td>${row.reglement || '—'} / ${row.echeance || '—'}</td></tr>
<tr><th>Chauffeur</th><td>${row.chauffeur || '—'}</td><th>Matricule</th><td>${row.matricule || '—'}</td></tr>
</table>
<table>
<thead><tr><th>Réf</th><th>Désignation</th><th>U</th><th>Qté</th><th>P/U</th><th>S/Total</th></tr></thead>
<tbody>${itemsRows}</tbody>
</table>
<p style="text-align:right;font-weight:700;margin-top:12px">Total : ${formatMontant(row.subtotal ?? row.montant)}</p>
</body></html>`;
}

function openPrintable(row) {
    const win = window.open('', '_blank', 'width=900,height=700');
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

    const items = row.items?.length
        ? row.items
        : [{
            article_ref: row.article_ref,
            description: row.designation,
            quantity: row.quantity,
            unit_price: row.unit_price,
            total: row.subtotal ?? row.montant,
        }];

    const total = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-navy to-blue-800 shrink-0">
                    <div>
                        <p className="text-[10px] text-blue-200 uppercase tracking-wider">Bon d&apos;Achat</p>
                        <h3 className="text-white font-bold">{row.reference}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            ['Date Bon', row.order_date],
                            ['N° Bon', row.reference],
                            ['Nom Fournisseur', row.fournisseur],
                            ['Client Livré', row.client_livre],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">{value || '—'}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[640px]">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                        {['Réf', 'Désignation', 'Qte', 'Prix/U', 'Sous-Total'].map((h) => (
                                            <th key={h} className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {items.map((i, idx) => (
                                        <tr key={i.id || idx} className="bg-white dark:bg-slate-900">
                                            <td className="px-3 py-2 text-center font-mono text-xs font-semibold text-brand-navy dark:text-blue-300">{i.article_ref || '—'}</td>
                                            <td className="px-3 py-2 text-center text-slate-700 dark:text-slate-200">{i.description || '—'}</td>
                                            <td className="px-3 py-2 text-center tabular-nums text-slate-700 dark:text-slate-200">
                                                {(Number(i.quantity) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                                            </td>
                                            <td className="px-3 py-2 text-center tabular-nums font-medium text-slate-800 dark:text-white">{formatMontantDisplay(i.unit_price)}</td>
                                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-brand-navy dark:text-orange-400">{formatMontantDisplay(i.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
                                        <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Total</td>
                                        <td className="px-3 py-2.5 text-center tabular-nums font-bold text-brand-navy dark:text-orange-400">{formatMontantDisplay(total || row.subtotal || row.montant)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <button type="button" onClick={() => openPrintable(row)} className="btn-primary text-xs flex-1">
                        <Printer className="w-3.5 h-3.5" /> Imprimer
                    </button>
                    <button type="button" onClick={onClose} className="btn-danger text-xs flex-1">
                        <XCircle className="w-3.5 h-3.5" /> Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function BonAchatsPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState(emptyHeader);
    const [lines, setLines] = useState([emptyLine()]);
    const [rows, setRows] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [clients, setClients] = useState([]);
    const [products, setProducts] = useState([]);
    const [meta, setMeta] = useState({ next_ref: '—', date: '—', total_reglements: 0, reliquat: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [viewRow, setViewRow] = useState(null);
    const [formOpen, setFormOpen] = useState(false);

    const totalBon = useMemo(
        () => lines.reduce((sum, l) => sum + (parseFloat(lineSubtotal(l)) || 0), 0).toFixed(2),
        [lines],
    );

    const totalQteBons = useMemo(
        () => rows.reduce((sum, row) => sum + orderTotalQuantity(row), 0),
        [rows],
    );

    const totalMontantBons = useMemo(
        () => rows.reduce((sum, row) => sum + (Number(row.subtotal ?? row.montant) || 0), 0),
        [rows],
    );

    const totalReglements = useMemo(
        () => Number(meta.total_reglements) || 0,
        [meta.total_reglements],
    );

    // Reliquat = Montant total des bons − Montant des règlements saisis
    const reliquat = useMemo(
        () => Math.round((totalMontantBons - totalReglements) * 100) / 100,
        [totalMontantBons, totalReglements],
    );

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            api.get('/purchase-orders', { params: { all: 1 } }),
            api.get('/suppliers', { params: { all: 1 } }),
            api.get('/clients', { params: { all: 1 } }),
            api.get('/products', { params: { all: 1 } }),
        ])
            .then(([ordersRes, suppliersRes, clientsRes, productsRes]) => {
                setRows(ordersRes.data.data ?? []);
                setMeta(ordersRes.data.meta ?? { next_ref: '—', date: '—', total_reglements: 0, reliquat: 0 });
                setSuppliers(suppliersRes.data.data ?? []);
                setClients(clientsRes.data.data ?? []);
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

    const updateLine = (key, patch) => {
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    };

    const handleSelectProduct = (lineKey, productId) => {
        const product = products.find((p) => String(p.id) === String(productId));
        if (!product) {
            updateLine(lineKey, { product_id: '', article_ref: '', description: '', unit: '' });
            return;
        }
        updateLine(lineKey, {
            product_id: product.id,
            article_ref: product.article_id || product.reference || '',
            description: product.name || '',
            unit: product.unit || '',
        });
    };

    const addLine = () => setLines((prev) => [...prev, emptyLine()]);

    const removeLine = (key) => {
        setLines((prev) => (prev.length <= 1 ? [emptyLine()] : prev.filter((l) => l.key !== key)));
    };

    const resetForm = (reload = true) => {
        setForm({ ...emptyHeader, order_date: new Date().toISOString().slice(0, 10) });
        setLines([emptyLine()]);
        setEditingId(null);
        setError('');
        setFormOpen(false);
        if (reload) load();
    };

    const handleNewBon = () => {
        setForm({ ...emptyHeader, order_date: new Date().toISOString().slice(0, 10) });
        setLines([emptyLine()]);
        setEditingId(null);
        setError('');
        load();
        setFormOpen(true);
    };

    const handleClose = () => {
        resetForm(false);
        navigate('/');
    };

    const closeFormPanel = () => {
        setForm({ ...emptyHeader, order_date: new Date().toISOString().slice(0, 10) });
        setLines([emptyLine()]);
        setEditingId(null);
        setError('');
        setFormOpen(false);
    };

    const fillForm = (row) => {
        setForm({
            supplier_id: row.supplier_id || '',
            order_date: row.order_date_raw || '',
            city: row.city || '',
            client_livre: row.client_livre || '',
            reglement: row.reglement || '',
            echeance: row.echeance || '',
            bc_number: row.bc_number || '',
            chauffeur: row.chauffeur || '',
            matricule: row.matricule || '',
        });
        if (row.items?.length) {
            setLines(row.items.map((i) => ({
                key: `edit-${i.id}`,
                product_id: i.product_id || '',
                article_ref: i.article_ref || '',
                description: i.description || '',
                unit: i.unit || '',
                quantity: i.quantity != null ? String(i.quantity) : '1',
                unit_price: i.unit_price != null ? String(i.unit_price) : '',
            })));
        } else {
            setLines([{
                ...emptyLine(),
                article_ref: row.article_ref || '',
                description: row.designation || '',
                unit: row.unit || '',
                quantity: row.quantity != null ? String(row.quantity) : '1',
                unit_price: row.unit_price != null ? String(row.unit_price) : '',
            }]);
        }
        setEditingId(row.id);
        setError('');
        setFormOpen(true);
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Supprimer le bon « ${row.reference} » ?`)) return;
        try {
            await api.delete(`/purchase-orders/${row.id}`);
            if (editingId === row.id) resetForm();
            else load();
        } catch {
            setError('Impossible de supprimer ce bon d\'achat');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const validLines = lines.filter((l) => l.description?.trim());
        if (!validLines.length) {
            setError('Ajoutez au moins un article avec une désignation');
            return;
        }

        setSaving(true);
        const payload = {
            supplier_id: form.supplier_id,
            order_date: form.order_date || new Date().toISOString().slice(0, 10),
            city: form.city || null,
            client_livre: form.client_livre || null,
            reglement: form.reglement || null,
            echeance: form.echeance || null,
            bc_number: form.bc_number || null,
            chauffeur: form.chauffeur || null,
            matricule: form.matricule || null,
            status: 'valide',
            items: validLines.map((l) => ({
                product_id: l.product_id || null,
                article_ref: l.article_ref || null,
                description: l.description,
                unit: l.unit || null,
                quantity: parseFloat(String(l.quantity).replace(',', '.')) || 1,
                unit_price: parseFloat(String(l.unit_price).replace(',', '.')) || 0,
            })),
        };

        try {
            if (editingId) {
                await api.put(`/purchase-orders/${editingId}`, payload);
            } else {
                await api.post('/purchase-orders', payload);
            }
            resetForm();
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de la validation');
        } finally {
            setSaving(false);
        }
    };

    const currentRef = editingId
        ? rows.find((r) => r.id === editingId)?.reference ?? meta.next_ref
        : meta.next_ref;

    return (
        <div className="space-y-4">
            <ViewModal row={viewRow} onClose={() => setViewRow(null)} />

            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={closeFormPanel}>
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[min(98vw,1600px)] max-h-[96vh] overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-brand-navy via-blue-800 to-blue-900 shrink-0">
                            <h3 className="text-white font-bold text-sm uppercase tracking-wide">
                                {editingId ? `Modifier Bon d'Achat ${currentRef}` : 'Nouveau Bon d\'Achat'}
                            </h3>
                            <button type="button" onClick={closeFormPanel} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
                            {error && (
                                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-800">{error}</div>
                            )}

                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-2.5">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-2 items-end">
                                    <Field label="Date">
                                        <input type="date" required value={form.order_date} onChange={(e) => set('order_date', e.target.value)} className={inputClass} />
                                    </Field>
                                    <Field label="N° B-A">
                                        <input type="text" readOnly value={currentRef} className={readOnlyClass} />
                                    </Field>
                                    <Field label="Nom Fournisseur" className="sm:col-span-2 md:col-span-1 xl:col-span-1">
                                        <select required value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)} className={inputClass}>
                                            <option value="">—</option>
                                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="N° Frns">
                                        <input type="text" value={form.bc_number} onChange={(e) => set('bc_number', e.target.value)} placeholder="N° Frns" className={inputClass} />
                                    </Field>
                                    <Field label="Client Livré">
                                        <select value={form.client_livre} onChange={(e) => set('client_livre', e.target.value)} className={inputClass}>
                                            <option value="">—</option>
                                            {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Ville Livraison">
                                        <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ville" className={inputClass} />
                                    </Field>
                                    <Field label="Type Rég">
                                        <select value={form.reglement} onChange={(e) => set('reglement', e.target.value)} className={inputClass}>
                                            {REGLEMENT_OPTIONS.map((v) => <option key={v || 'r'} value={v}>{v || '—'}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Échéance">
                                        <select value={form.echeance} onChange={(e) => set('echeance', e.target.value)} className={inputClass}>
                                            {ECHEANCE_OPTIONS.map((v) => <option key={v || 'e'} value={v}>{v || '—'}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Chauffeur">
                                        <input type="text" value={form.chauffeur} onChange={(e) => set('chauffeur', e.target.value)} placeholder="Chauffeur" className={inputClass} />
                                    </Field>
                                    <Field label="Matricule">
                                        <input type="text" value={form.matricule} onChange={(e) => set('matricule', e.target.value)} placeholder="Matricule" className={inputClass} />
                                    </Field>
                                </div>
                            </div>

                            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                <div className="px-4 py-2 bg-gradient-to-r from-brand-navy via-blue-800 to-blue-900 flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wide">Tableau de saisie</h4>
                                    <span className="text-[10px] text-blue-200 font-semibold tabular-nums">Total : {totalBon}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[860px]">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                                {['Réf', 'Désignation', 'U', 'Qté', 'P/U', 'S/Total', ''].map((h) => (
                                                    <th key={h || 'act'} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {lines.map((line) => (
                                                <tr key={line.key} className="hover:bg-orange-50/30 dark:hover:bg-slate-800/30">
                                                    <td className="px-2 py-1.5 w-[120px]">
                                                        <select value={line.product_id} onChange={(e) => handleSelectProduct(line.key, e.target.value)} className={tableInput} title="Liste des références">
                                                            <option value="">— Réf —</option>
                                                            {products.map((p) => (
                                                                <option key={p.id} value={p.id}>{p.article_id || p.reference || p.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1.5 min-w-[180px]">
                                                        <input type="text" value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} placeholder="Désignation" className={`${tableInput} text-left`} />
                                                    </td>
                                                    <td className="px-2 py-1.5 w-[72px]">
                                                        <select value={line.unit} onChange={(e) => updateLine(line.key, { unit: e.target.value })} className={tableInput}>
                                                            {UNIT_OPTIONS.map((v) => <option key={v || 'u'} value={v}>{v || '—'}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1.5 w-[80px]">
                                                        <input type="number" step="0.001" min="0" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} className={tableInput} />
                                                    </td>
                                                    <td className="px-2 py-1.5 w-[95px]">
                                                        <input type="number" step="0.01" min="0" value={line.unit_price} onChange={(e) => updateLine(line.key, { unit_price: e.target.value })} placeholder="0.00" className={tableInput} />
                                                    </td>
                                                    <td className="px-2 py-1.5 w-[95px]">
                                                        <input type="text" readOnly value={lineSubtotal(line)} className={readOnlyClass} />
                                                    </td>
                                                    <td className="px-2 py-1.5 w-[44px] text-center">
                                                        <button type="button" title="Supprimer la ligne" onClick={() => removeLine(line.key)} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                    <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide text-brand-navy dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
                                        <PlusCircle className="w-4 h-4" /> Ajouter article
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <button type="button" onClick={closeFormPanel} className="btn-secondary text-xs px-4">
                                    <XCircle className="w-3.5 h-3.5" /> Fermer
                                </button>
                                <button type="submit" disabled={saving} className="btn-primary text-xs px-4">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {saving ? 'Validation...' : 'Valider'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={handleNewBon} className="btn-primary">
                    <Plus className="w-4 h-4" /> Nouveau
                </button>
                <button type="button" onClick={handleClose} className="btn-secondary">
                    <XCircle className="w-4 h-4" /> Fermer
                </button>

                <div className="ml-auto flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-emerald-200 dark:border-emerald-800">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                            <Package className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Qté</p>
                            <p className="text-base font-bold tabular-nums leading-tight text-emerald-700 dark:text-emerald-300">
                                {totalQteBons.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-amber-200 dark:border-amber-800">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                            <Wallet className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Montant</p>
                            <p className="text-base font-bold tabular-nums leading-tight text-brand-navy dark:text-orange-300">
                                {formatMontantDisplay(totalMontantBons)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 border-rose-200 dark:border-rose-800">
                        <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                            <Scale className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Reliquat</p>
                            <p className={`text-base font-bold tabular-nums leading-tight ${reliquat < 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                {formatMontantDisplay(reliquat)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-orange-700 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Tableau des Bon D&apos;achats</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1100px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                {['Date', 'N° B-A', 'Fournisseur', 'N° Frns', 'Client Livré', 'Ville', 'Qté totale', 'Total', 'Échéance', 'Actions'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}>{[...Array(10)].map((__, j) => (
                                        <td key={j} className="px-4 py-3 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" /></td>
                                    ))}</tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-orange-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                        onDoubleClick={() => setViewRow(row)}
                                        title="Double-clic pour afficher"
                                    >
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.order_date}</td>
                                        <td className="px-4 py-2.5 text-center font-mono text-xs font-semibold text-brand-navy dark:text-orange-400">{row.reference}</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.fournisseur || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-600 dark:text-slate-300">{row.bc_number || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.client_livre || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.city || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                                            {orderTotalQuantity(row).toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-brand-navy dark:text-orange-400">{formatMontantDisplay(row.subtotal ?? row.montant)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                                {row.echeance || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5" onDoubleClick={(e) => e.stopPropagation()}>
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
                                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Aucun bon d&apos;achat enregistré</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
