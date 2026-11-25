import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handshake, Plus, Pencil, Trash2, PauseCircle, PlayCircle, RefreshCw, X, Ban } from 'lucide-react';
import api from '../lib/api';

const emptyForm = {
    client_id: '',
    login: '',
    password: '',
    permissions: [],
    tresoreries: [],
};

const columns = ['Client', 'Contact', 'Login', 'Mot de passe', 'Accès côté client', 'Actions'];

function Field({ label, children, required = false }) {
    return (
        <div className="min-w-0">
            <label className="field-label field-label-compact">
                {label}{required ? ' *' : ''}
            </label>
            {children}
        </div>
    );
}

const inputClass =
    'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy';

const TREASURY_LABELS = {
    CAISSE: 'Caisse',
    'CMPT PERS': 'Compte personnel',
    'CMPT STE': 'Compte société',
};

function treasuryLabel(name) {
    const key = String(name || '').trim().toLocaleUpperCase('fr-FR');
    if (TREASURY_LABELS[key]) return TREASURY_LABELS[key];
    return key
        .toLocaleLowerCase('fr-FR')
        .replace(/(^|[\s-])(\p{L})/gu, (match, sep, letter) => sep + letter.toLocaleUpperCase('fr-FR'));
}

function CheckAll({ checked, indeterminate, onChange }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
        <label className="inline-flex items-center gap-2 mb-2 text-sm normal-case font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
                ref={ref}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="rounded border-slate-300 text-brand-navy"
            />
            Tout cocher
        </label>
    );
}

export default function PartnersPage() {
    const [rows, setRows] = useState([]);
    const [clients, setClients] = useState([]);
    const [sections, setSections] = useState([]);
    const [tresoreries, setTresoreries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        api.get('/partners')
            .then((res) => {
                setRows(res.data.data ?? []);
                setClients(res.data.meta?.clients ?? []);
                setSections(res.data.meta?.sections ?? []);
                setTresoreries(res.data.meta?.tresoreries ?? []);
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const availableClients = useMemo(() => {
        const taken = new Set(rows.map((row) => row.client_id));
        return clients.filter((client) => !taken.has(client.id) || client.id === editingId);
    }, [clients, rows, editingId]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setFormOpen(true);
    };

    const openEdit = (row) => {
        setEditingId(row.id);
        setForm({
            client_id: String(row.client_id),
            login: row.login || '',
            password: '',
            permissions: row.permissions || [],
            tresoreries: row.tresoreries === null ? (tresoreries.length ? [...tresoreries] : []) : (row.tresoreries || []),
        });
        setError('');
        setFormOpen(true);
    };

    const toggleList = (key, value) => {
        setForm((current) => {
            const has = current[key].includes(value);
            return {
                ...current,
                [key]: has
                    ? current[key].filter((item) => item !== value)
                    : [...current[key], value],
            };
        });
    };

    const allTreasuriesChecked = tresoreries.length > 0 && tresoreries.every((name) => form.tresoreries.includes(name));
    const someTreasuriesChecked = form.tresoreries.length > 0 && !allTreasuriesChecked;

    const toggleAllTreasuries = () => {
        setForm((current) => ({
            ...current,
            tresoreries: tresoreries.every((name) => current.tresoreries.includes(name)) ? [] : [...tresoreries],
        }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                client_id: Number(form.client_id),
                login: form.login,
                permissions: form.permissions,
                tresoreries: form.tresoreries,
            };
            if (form.password) payload.password = form.password;
            if (editingId) {
                await api.put(`/partners/${editingId}`, payload);
            } else {
                await api.post('/partners', payload);
            }
            setFormOpen(false);
            load();
        } catch (err) {
            setError(
                err.response?.data?.message
                || Object.values(err.response?.data?.errors || {}).flat()?.[0]
                || 'Enregistrement impossible',
            );
        } finally {
            setSaving(false);
        }
    };

    const onSuspend = async (row) => {
        const action = row.is_active ? 'suspendre' : 'réactiver';
        if (!window.confirm(`Voulez-vous ${action} l'accès de « ${row.name} » ?`)) return;
        try {
            await api.patch(`/partners/${row.id}/suspend`);
            load();
        } catch (err) {
            alert(err.response?.data?.message || 'Action impossible');
        }
    };

    const onDelete = async (row) => {
        if (!window.confirm(`Retirer l'accès partenaire de « ${row.name} » ? Le client reste dans les fiches.`)) return;
        try {
            await api.delete(`/partners/${row.id}`);
            load();
        } catch (err) {
            alert(err.response?.data?.message || 'Suppression impossible');
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto overscroll-contain gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Handshake className="w-5 h-5 text-brand-navy" /> Partenaire
                    </h1>
                    <p className="text-sm normal-case text-slate-500 dark:text-slate-400">
                        Choisir un client, lui donner un accès, et cocher ce qu&apos;il voit dans son espace.
                    </p>
                </div>
                <button type="button" onClick={openCreate} className="btn-primary text-xs px-4">
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
            </div>

            <div className="glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3.5 bg-gradient-to-r from-slate-700 via-slate-800 to-brand-navy flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Tableau Partenaires</h3>
                    <button type="button" onClick={load} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10" title="Actualiser">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[860px]">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                {columns.map((heading) => (
                                    <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 text-center">
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">Chargement…</td></tr>
                            ) : rows.length ? rows.map((row) => (
                                <tr key={row.id} className={!row.is_active ? 'opacity-60' : ''}>
                                    <td className="px-4 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.name}</td>
                                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.phone || row.city || '—'}</td>
                                    <td className="px-4 py-2.5 text-center font-mono text-xs text-brand-navy dark:text-violet-300">{row.login}</td>
                                    <td className="px-4 py-2.5 text-center tracking-widest text-slate-400">{row.password_mask}</td>
                                    <td className="px-4 py-2.5 text-center text-xs text-slate-600 dark:text-slate-300">
                                        <div>{row.access_labels?.length ? row.access_labels.join(' · ') : 'Aucun'}</div>
                                        <div className="mt-1 text-[11px] normal-case text-slate-500">
                                            {row.tresoreries === null
                                                ? 'Trésorerie : toutes'
                                                : row.tresoreries.length
                                                    ? `Trésorerie : ${row.tresoreries.map(treasuryLabel).join(' · ')}`
                                                    : 'Trésorerie : aucune'}
                                        </div>
                                        {!row.is_active && (
                                            <div className="mt-1 text-[10px] font-semibold uppercase text-red-500 inline-flex items-center gap-1">
                                                <Ban className="w-3 h-3" /> Suspendu
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="inline-flex gap-1">
                                            <button type="button" title="Modifier" onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button type="button" title="Retirer l'accès" onClick={() => onDelete(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                            <button type="button" title={row.is_active ? 'Suspendre' : 'Réactiver'} onClick={() => onSuspend(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50">
                                                {row.is_active ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">Aucun partenaire — cliquez sur Ajouter</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setFormOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 max-h-[90dvh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-700 to-brand-navy">
                            <h3 className="text-white font-bold text-sm uppercase">{editingId ? 'Modifier partenaire' : 'Ajouter partenaire'}</h3>
                            <button type="button" onClick={() => setFormOpen(false)} className="p-1.5 text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={onSubmit} className="p-5 space-y-4" autoComplete="off">
                            {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label="Client" required>
                                    <select required value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))} className={inputClass} disabled={!!editingId}>
                                        <option value="">Sélectionner</option>
                                        {availableClients.map((client) => (
                                            <option key={client.id} value={client.id}>{client.name}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Login" required>
                                    <input required value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} className={inputClass} placeholder="Login" autoComplete="off" />
                                </Field>
                                <Field label="Mot de passe" required={!editingId}>
                                    <input type="password" required={!editingId} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} placeholder={editingId ? 'Laisser vide pour conserver' : 'Mot de passe'} autoComplete="new-password" />
                                </Field>
                            </div>
                            <div>
                                <p className="field-label field-label-compact mb-2">Ce qu&apos;il peut voir côté client</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {sections.map((section) => (
                                        <label key={section.slug} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm normal-case cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.permissions.includes(section.slug)}
                                                onChange={() => toggleList('permissions', section.slug)}
                                                className="rounded border-slate-300 text-brand-navy"
                                            />
                                            {section.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="field-label field-label-compact mb-2">Trésoreries qu&apos;il peut voir</p>
                                <CheckAll
                                    checked={allTreasuriesChecked}
                                    indeterminate={someTreasuriesChecked}
                                    onChange={toggleAllTreasuries}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {tresoreries.map((name) => (
                                        <label key={name} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm normal-case cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.tresoreries.includes(name)}
                                                onChange={() => toggleList('tresoreries', name)}
                                                className="rounded border-slate-300 text-brand-navy shrink-0"
                                            />
                                            <span className="min-w-0 break-words">{treasuryLabel(name)}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="mt-2 text-[11px] normal-case text-slate-400">
                                    Le partenaire ne voit que les règlements des trésoreries cochées. Si aucune n&apos;est cochée, il ne voit aucun règlement.
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary text-xs px-4">Fermer</button>
                                <button type="submit" disabled={saving} className="btn-primary text-xs px-4">{saving ? '...' : 'Valider'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
