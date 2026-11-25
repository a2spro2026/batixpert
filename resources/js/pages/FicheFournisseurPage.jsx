import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Pencil, Plus, Trash2, Printer, FileText, X, Wallet } from 'lucide-react';
import api from '../lib/api';
import { downloadPdf, openPrintPreview } from '../lib/printDocument';
import DraggableFormPanel, { FicheField, ficheBarClass, ficheBarReadOnlyClass } from '../components/forms/DraggableFormPanel';
import { PageVisibilityHeader, usePageVisibility } from '../components/PageVisibility';

const REGLEMENT_OPTIONS = [
    { value: '', label: '—' },
    { value: 'Esp', label: 'Esp' },
    { value: 'Chq', label: 'Chq' },
    { value: 'Eff', label: 'Eff' },
    { value: 'Vir', label: 'Vir' },
    { value: 'Vers', label: 'Vers' },
];

const ECHEANCE_OPTIONS = [
    { value: '', label: '—' },
    { value: '45 Jrs', label: '45 Jrs' },
    { value: '60 Jrs', label: '60 Jrs' },
    { value: '90 Jrs', label: '90 Jrs' },
    { value: '120 Jrs', label: '120 Jrs' },
];

const emptyForm = {
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    reglement: '',
    echeance: '',
    initial_balance: '',
};

function formatSolde(value) {
    const n = Number(String(value ?? '').replace(',', '.')) || 0;
    return n.toFixed(2);
}

function parseSoldeInput(value) {
    if (value === '' || value == null) return '';
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n.toFixed(2) : '';
}

function hasSoldeInitial(value) {
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) && n !== 0;
}

function buildFicheHtml(row) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche ${row.code}</title>
<style>
body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}
h1{color:#1e3a5f;margin:0 0 4px;font-size:22px}
.sub{color:#64748b;font-size:12px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #e2e8f0;padding:10px 12px;text-align:left;font-size:13px}
th{background:#f8fafc;width:180px;font-weight:700}
.footer{margin-top:32px;font-size:11px;color:#94a3b8;text-align:center}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#fff7ed;color:#ea580c;font-weight:700}
</style></head><body>
<h1>BATIXPERT — Fiche Fournisseur</h1>
<p class="sub">Document généré le ${new Date().toLocaleDateString('fr-FR')}</p>
<table>
<tr><th>ID</th><td><span class="badge">${row.code}</span></td></tr>
<tr><th>Nom Fournisseur</th><td>${row.name || '—'}</td></tr>
<tr><th>Contact</th><td>${row.contact || '—'}</td></tr>
<tr><th>E-mail</th><td>${row.email || '—'}</td></tr>
<tr><th>Adresse</th><td>${row.address || '—'}</td></tr>
<tr><th>Ville</th><td>${row.city || '—'}</td></tr>
<tr><th>Règlement</th><td>${row.reglement || '—'}</td></tr>
<tr><th>Échéance</th><td>${row.echeance || row.payment_terms || '—'}</td></tr>
<tr><th>Solde Initial</th><td><strong>${formatSolde(row.initial_balance ?? row.solde)}</strong></td></tr>
<tr><th>Date création</th><td>${row.created_at || '—'}</td></tr>
</table>
<p class="footer">© BatiXpert — A2SPRO</p>
</body></html>`;
}

function openPrintable(row, asPdf = false) {
    const options = { title: `Fiche fournisseur ${row.name || ''}`, filename: `fiche-fournisseur-${row.name || row.id}` };
    if (asPdf) {
        downloadPdf(buildFicheHtml(row), options).catch(() => window.alert('Impossible de générer le PDF.'));
        return;
    }
    openPrintPreview(buildFicheHtml(row), options);
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
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`p-1.5 rounded-lg text-slate-400 transition-colors ${colors[color]}`}
        >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
    );
}

function ViewModal({ row, onClose }) {
    if (!row) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-navy to-blue-800">
                    <div>
                        <p className="text-[10px] text-blue-200 uppercase tracking-wider">Fiche Fournisseur</p>
                        <h3 className="text-white font-bold">{row.code}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-5 space-y-3 text-sm">
                    {[
                        ['Nom Fournisseur', row.name],
                        ['Contact', row.contact],
                        ['E-mail', row.email],
                        ['Adresse', row.address],
                        ['Ville', row.city],
                        ['Règlement', row.reglement],
                        ['Échéance', row.echeance || row.payment_terms],
                        ['Solde Initial', formatSolde(row.initial_balance ?? row.solde), hasSoldeInitial(row.initial_balance ?? row.solde)],
                        ['Date', row.created_at],
                    ].map(([label, value, isRed]) => (
                        <div key={label} className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
                            <span className={`font-medium text-right ${isRed ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-800 dark:text-white'}`}>{value || '—'}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button type="button" onClick={() => openPrintable(row)} className="btn-secondary text-xs flex-1">
                        <Printer className="w-3.5 h-3.5" /> Imprimer
                    </button>
                    <button type="button" onClick={() => openPrintable(row, true)} className="btn-primary text-xs flex-1">
                        <FileText className="w-3.5 h-3.5" /> PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function FicheFournisseurPage() {
    const visibility = usePageVisibility({ actions: true, kpi: true, filters: false });
    const [form, setForm] = useState(emptyForm);
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ next_id: '—', date: '—' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [viewRow, setViewRow] = useState(null);
    const [panelOpen, setPanelOpen] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        api.get('/suppliers', { params: { all: 1 } })
            .then((r) => {
                setRows(r.data.data ?? []);
                setMeta(r.data.meta ?? { next_id: '—', date: '—' });
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const totalSoldes = useMemo(
        () => rows.reduce((sum, r) => sum + (Number(r.initial_balance ?? r.solde) || 0), 0),
        [rows]
    );

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const closePanel = () => {
        setPanelOpen(false);
        setForm(emptyForm);
        setEditingId(null);
        setError('');
    };

    const openCreate = () => {
        setForm(emptyForm);
        setEditingId(null);
        setError('');
        setPanelOpen(true);
    };

    const fillForm = (row) => {
        setForm({
            name: row.name || '',
            phone: row.phone || row.contact || '',
            email: row.email || '',
            address: row.address || '',
            city: row.city || '',
            reglement: row.reglement || '',
            echeance: row.echeance || row.payment_terms || '',
            initial_balance: parseSoldeInput(row.initial_balance ?? row.solde),
        });
        setEditingId(row.id);
        setError('');
        setPanelOpen(true);
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Supprimer le fournisseur « ${row.name} » ?`)) return;
        try {
            await api.delete(`/suppliers/${row.id}`);
            if (editingId === row.id) closePanel();
            load();
        } catch {
            setError('Impossible de supprimer ce fournisseur');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        const payload = {
            name: form.name,
            phone: form.phone || null,
            email: form.email || null,
            address: form.address || null,
            city: form.city || null,
            reglement: form.reglement || null,
            payment_terms: form.echeance || null,
            initial_balance: form.initial_balance === '' ? 0 : Number(parseSoldeInput(form.initial_balance) || 0),
        };
        try {
            if (editingId) {
                await api.put(`/suppliers/${editingId}`, payload);
            } else {
                await api.post('/suppliers', payload);
            }
            closePanel();
            load();
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto overscroll-contain gap-4">
            <ViewModal row={viewRow} onClose={() => setViewRow(null)} />

            <PageVisibilityHeader
                title="Fiche fournisseur"
                subtitle="Annuaire et soldes fournisseurs"
                visibility={visibility}
            />

            {visibility.showActions && (
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-orange px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-orange-500">
                        <Plus className="w-4 h-4" />
                        Ajouter
                    </button>
                </div>
            )}

            {visibility.showKpi && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border self-start ${totalSoldes !== 0 ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'}`}>
                    <Wallet className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Total soldes</span>
                    <span className="text-sm font-bold tabular-nums">{formatSolde(totalSoldes)}</span>
                </div>
            )}

            <div className="glass-card min-w-0 max-w-full overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-brand-navy via-blue-800 to-blue-900 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Fiche fournisseur</h3>
                </div>
                <div className="min-w-0 overflow-x-auto">
                    <table className="w-full text-sm min-w-[960px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                {['ID', 'Nom Fournisseur', 'Contact', 'Adresse', 'Ville', 'Règlement', 'Échéance', 'Solde Initial', 'Actions'].map((h) => (
                                    <th
                                        key={h}
                                        className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap text-center"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}>
                                        {[...Array(9)].map((__, j) => (
                                            <td key={j} className="px-4 py-3 text-center">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className={`hover:bg-orange-50/40 dark:hover:bg-slate-800/40 transition-colors ${editingId === row.id ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
                                        <td className="px-4 py-2.5 text-center font-mono text-xs font-semibold text-brand-navy dark:text-orange-400">{row.code}</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.name}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.contact || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300 max-w-[160px] truncate mx-auto">{row.address || '—'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                {row.city || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-brand-navy dark:text-blue-300">
                                                {row.reglement || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                                {row.echeance || row.payment_terms || '—'}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-2.5 text-center font-semibold tabular-nums ${hasSoldeInitial(row.initial_balance ?? row.solde) ? 'text-red-600 dark:text-red-400' : 'text-brand-navy dark:text-orange-400'}`}>
                                            {formatSolde(row.initial_balance ?? row.solde)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <ActionBtn title="Voir" icon={Eye} color="blue" onClick={() => setViewRow(row)} />
                                                <ActionBtn title="Modifier" icon={Pencil} color="amber" onClick={() => fillForm(row)} />
                                                <ActionBtn title="Supprimer" icon={Trash2} color="red" onClick={() => handleDelete(row)} />
                                                <ActionBtn title="Imprimer" icon={Printer} color="slate" onClick={() => openPrintable(row)} />
                                                <ActionBtn title="PDF" icon={FileText} color="orange" onClick={() => openPrintable(row, true)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                                        Aucun fournisseur. Cliquez sur Ajouter pour saisir une fiche.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {panelOpen && (
                <DraggableFormPanel
                    title={editingId ? 'Modifier la fiche fournisseur' : 'Nouvelle fiche fournisseur'}
                    onClose={closePanel}
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-800">
                                {error}
                            </div>
                        )}
                        <div className="min-w-0 overflow-x-auto pb-1">
                            <div className="flex w-full flex-nowrap items-end gap-2.5 min-w-[72rem]">
                                <FicheField label="Date" className="min-w-[7.5rem] flex-1">
                                    <input type="text" readOnly value={meta.date} className={ficheBarReadOnlyClass} />
                                </FicheField>
                                <FicheField label="ID" className="min-w-[6rem] flex-1">
                                    <input type="text" readOnly value={editingId ? rows.find((r) => r.id === editingId)?.code ?? meta.next_id : meta.next_id} className={ficheBarReadOnlyClass} />
                                </FicheField>
                                <FicheField label="Nom Fournisseur" className="min-w-[12rem] flex-[1.6]">
                                    <input type="text" required autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Raison sociale" className={ficheBarClass} />
                                </FicheField>
                                <FicheField label="Contact" className="min-w-[9rem] flex-1">
                                    <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06 XX XX XX XX" className={ficheBarClass} />
                                </FicheField>
                                <FicheField label="E-mail" className="min-w-[11rem] flex-[1.2]">
                                    <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@..." className={ficheBarClass} />
                                </FicheField>
                                <FicheField label="Adresse" className="min-w-[11rem] flex-[1.2]">
                                    <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Adresse" className={ficheBarClass} />
                                </FicheField>
                                <FicheField label="Ville" className="min-w-[7rem] flex-1">
                                    <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ville" className={ficheBarClass} />
                                </FicheField>
                                <FicheField label="Régl" className="min-w-[5.5rem] flex-1">
                                    <select value={form.reglement} onChange={(e) => set('reglement', e.target.value)} className={ficheBarClass}>
                                        {REGLEMENT_OPTIONS.map((opt) => (
                                            <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </FicheField>
                                <FicheField label="Échéance" className="min-w-[6.5rem] flex-1">
                                    <select value={form.echeance} onChange={(e) => set('echeance', e.target.value)} className={ficheBarClass}>
                                        {ECHEANCE_OPTIONS.map((opt) => (
                                            <option key={opt.value || 'echeance-empty'} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </FicheField>
                                <FicheField label="Solde Initial" className="min-w-[7.5rem] flex-1">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={form.initial_balance}
                                        onChange={(e) => set('initial_balance', e.target.value.replace(/[^\d.,\-]/g, ''))}
                                        onBlur={() => set('initial_balance', parseSoldeInput(form.initial_balance))}
                                        placeholder="0.00"
                                        className={`${ficheBarClass} ${hasSoldeInitial(form.initial_balance) ? 'border-red-400 text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/30 focus:ring-red-400/40 focus:border-red-500' : ''}`}
                                    />
                                </FicheField>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <button type="submit" disabled={saving} className="btn-primary text-sm">
                                <Check className="w-4 h-4" />
                                {saving ? 'Validation...' : 'Valider'}
                            </button>
                            <button type="button" onClick={closePanel} className="btn-muted text-sm">
                                Annuler
                            </button>
                        </div>
                    </form>
                </DraggableFormPanel>
            )}
        </div>
    );
}
