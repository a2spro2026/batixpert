import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    PhoneCall, Plus, Search, RefreshCw, Trash2, History, X,
    Check, CalendarClock,
} from 'lucide-react';
import api from '../lib/api';
import MobileRecordCard, { MobileCardList } from '../components/MobileRecordCard';

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptyFilters = { etat: '', date_from: '', date_to: '', client: '' };

const QUICK_NOTES = ['Sans réponse', 'Occupé', 'À rappeler', 'Promesse de paiement', 'Rendez-vous pris'];

const ETATS = {
    en_retard: { label: 'En retard', classes: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800' },
    aujourd_hui: { label: "Aujourd'hui", classes: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800' },
    a_venir: { label: 'À venir', classes: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800' },
    sans_rappel: { label: 'Historique', classes: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
};

function computeEtat(dateRappel) {
    if (!dateRappel) return 'sans_rappel';
    const today = todayISO();
    if (dateRappel < today) return 'en_retard';
    if (dateRappel === today) return 'aujourd_hui';
    return 'a_venir';
}

const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy';
const cellInputClass = 'w-full rounded-md border border-transparent bg-transparent text-xs text-slate-800 dark:text-slate-100 px-1.5 py-1.5 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:border-brand-orange focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-orange/25 transition-colors';

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Field({ label, children, className = '' }) {
    return (
        <div className={className}>
            <label className="field-label">{label}</label>
            {children}
        </div>
    );
}

function EtatBadge({ etat }) {
    const e = ETATS[etat] || ETATS.sans_rappel;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 whitespace-nowrap ${e.classes}`}>
            {e.label}
        </span>
    );
}

function SoldeCell({ value }) {
    if (value === null || value === undefined || Number(value) <= 0) {
        return <span className="tabular-nums text-slate-400">—</span>;
    }
    return <span className="tabular-nums font-bold text-red-600 dark:text-red-400">{formatMontant(value)}</span>;
}

function ClientAutocomplete({ clients, value, onChangeText, onSelect, placeholder = 'Nom du client ou ville…' }) {
    const [open, setOpen] = useState(false);

    const suggestions = useMemo(() => {
        const q = value.trim().toLowerCase();
        const list = q
            ? clients.filter((c) => c.name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q))
            : clients;
        return list.slice(0, 12);
    }, [clients, value]);

    return (
        <div className="relative">
            <input
                value={value}
                onChange={(e) => { onChangeText(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder}
                className={inputClass}
                autoComplete="off"
            />
            {open && (
                <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                    {suggestions.length ? suggestions.map((c) => (
                        <button
                            key={c.client_id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); onSelect(c); setOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{c.name}</span>
                                {c.city && (
                                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/30 text-[10px] font-bold uppercase text-orange-700 dark:text-orange-300 ring-1 ring-orange-200 dark:ring-orange-800">
                                        {c.city}
                                    </span>
                                )}
                            </span>
                            <span className="block mt-0.5 text-[11px] text-slate-400 truncate">
                                {c.phone || 'Sans téléphone'}
                                {c.solde > 0 ? ` · Solde : ${formatMontant(c.solde)}` : ''}
                            </span>
                        </button>
                    )) : (
                        <p className="px-3 py-3 text-xs text-slate-400">Aucun client trouvé dans la Fiche Client</p>
                    )}
                </div>
            )}
        </div>
    );
}

function ClientSelect({ clients, value, onChange, extraName }) {
    const hasValue = value && clients.some((c) => c.name === value);
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${cellInputClass} cursor-pointer`}>
            <option value="">— Choisir —</option>
            {extraName && !hasValue && <option value={extraName}>{extraName}</option>}
            {clients.map((c) => (
                <option key={c.client_id} value={c.name}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
            ))}
        </select>
    );
}

export default function ClientRelancePage() {
    const [rows, setRows] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [clientText, setClientText] = useState('');
    const [edits, setEdits] = useState({});
    const [savingId, setSavingId] = useState(null);
    const [error, setError] = useState('');
    const [newRow, setNewRow] = useState({ date_appel: todayISO(), client_name: '', remarque: '', date_rappel: '' });
    const [adding, setAdding] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (applied.etat) params.etat = applied.etat;
        if (applied.date_from) params.date_from = applied.date_from;
        if (applied.date_to) params.date_to = applied.date_to;
        if (applied.client) params.client = applied.client;

        api.get('/client-relances', { params })
            .then((res) => setRows(res.data.data ?? []))
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, [applied]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        api.get('/client-relances/meta')
            .then((r) => setClients(r.data.data ?? []))
            .catch(() => setClients([]));
    }, []);

    const soldeFor = useCallback((name, fallback) => {
        if (!name) return fallback;
        const found = clients.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
        return found ? found.solde : fallback;
    }, [clients]);

    const clientIdFor = useCallback((name) => {
        const found = clients.find((c) => c.name.trim().toLowerCase() === (name || '').trim().toLowerCase());
        return found?.client_id ?? null;
    }, [clients]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    const resetAll = () => {
        setFilters(emptyFilters);
        setApplied(emptyFilters);
        setClientText('');
    };

    const handleClientText = (text) => {
        setClientText(text);
        setFilters((f) => (f.client && f.client !== text ? { ...f, client: '' } : f));
    };

    const selectFilterClient = (client) => {
        const next = { ...filters, client: client.name };
        setClientText(client.name);
        setFilters(next);
        setApplied(next);
    };

    const showHistory = (name) => {
        const next = { ...emptyFilters, client: name };
        setFilters(next);
        setApplied(next);
        setClientText(name);
    };

    // --- Édition directe dans le tableau ---
    const rowValue = (row, field) => edits[row.id]?.[field] ?? row[`${field}_raw`] ?? row[field] ?? '';

    const isDirty = (row) => {
        const e = edits[row.id];
        if (!e) return false;
        return ['date_appel', 'client_name', 'remarque', 'date_rappel'].some(
            (f) => (e[f] ?? '') !== (row[`${f}_raw`] ?? row[f] ?? ''),
        );
    };

    const setEdit = (row, field, value) => {
        setEdits((prev) => ({
            ...prev,
            [row.id]: {
                date_appel: rowValue(row, 'date_appel'),
                client_name: rowValue(row, 'client_name'),
                remarque: rowValue(row, 'remarque'),
                date_rappel: rowValue(row, 'date_rappel'),
                ...prev[row.id],
                [field]: value,
            },
        }));
    };

    const cancelEdit = (id) => setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
    });

    const saveRow = async (row) => {
        const e = edits[row.id];
        if (!e) return;
        if (!e.client_name?.trim() || !e.date_appel) {
            setError('Le client et la date d\u2019appel sont obligatoires.');
            return;
        }
        setSavingId(row.id);
        setError('');
        try {
            await api.put(`/client-relances/${row.id}`, {
                client_id: clientIdFor(e.client_name),
                client_name: e.client_name.trim(),
                date_appel: e.date_appel,
                remarque: e.remarque?.trim() || null,
                date_rappel: e.date_rappel || null,
            });
            cancelEdit(row.id);
            load();
        } catch (err) {
            const first = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : null;
            setError(first || 'Impossible d\u2019enregistrer cette ligne.');
        } finally {
            setSavingId(null);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Supprimer la relance du ${row.date_appel || ''} pour « ${row.client_name} » ?`)) return;
        try {
            await api.delete(`/client-relances/${row.id}`);
            cancelEdit(row.id);
            load();
        } catch {}
    };

    // --- Nouvelle ligne ---
    const setNew = (field, value) => setNewRow((r) => ({ ...r, [field]: value }));

    const addQuickNote = (note) => {
        setNewRow((r) => {
            const current = (r.remarque || '').trim();
            if (!current) return { ...r, remarque: note };
            if (current.toLowerCase().includes(note.toLowerCase())) return r;
            return { ...r, remarque: `${current} — ${note}` };
        });
    };

    const handleAdd = async () => {
        if (!newRow.client_name.trim()) {
            setError('Choisissez un client dans la première ligne du tableau.');
            return;
        }
        if (!newRow.date_appel) {
            setError('La date d\u2019appel est obligatoire.');
            return;
        }
        setAdding(true);
        setError('');
        try {
            await api.post('/client-relances', {
                client_id: clientIdFor(newRow.client_name),
                client_name: newRow.client_name.trim(),
                date_appel: newRow.date_appel,
                remarque: newRow.remarque.trim() || null,
                date_rappel: newRow.date_rappel || null,
            });
            setNewRow({ date_appel: todayISO(), client_name: '', remarque: '', date_rappel: '' });
            load();
        } catch (err) {
            const first = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : null;
            setError(first || 'Impossible d\u2019ajouter cette relance.');
        } finally {
            setAdding(false);
        }
    };

    const columns = ["Date d'appel", 'Client', 'Solde', 'Remarque', 'Date de rappel', 'État', 'Actions'];

    const renderRowCells = (row) => {
        const clientName = rowValue(row, 'client_name');
        const dateRappel = rowValue(row, 'date_rappel');
        const dirty = isDirty(row);
        return (
            <>
                <td className="px-2 py-1.5 min-w-[130px]">
                    <input type="date" value={rowValue(row, 'date_appel')} onChange={(e) => setEdit(row, 'date_appel', e.target.value)} className={cellInputClass} />
                </td>
                <td className="px-2 py-1.5 min-w-[190px]">
                    <ClientSelect clients={clients} value={clientName} extraName={row.client_name} onChange={(v) => setEdit(row, 'client_name', v)} />
                    {(row.phone || row.city) && clientName === row.client_name && (
                        <span className="block px-1.5 text-[11px] text-slate-400">{[row.city, row.phone].filter(Boolean).join(' · ')}</span>
                    )}
                </td>
                <td className="px-2 py-1.5 text-center"><SoldeCell value={soldeFor(clientName, row.solde)} /></td>
                <td className="px-2 py-1.5 min-w-[220px]">
                    <textarea
                        value={rowValue(row, 'remarque')}
                        onChange={(e) => setEdit(row, 'remarque', e.target.value)}
                        rows={1}
                        placeholder="Remarque…"
                        className={`${cellInputClass} resize-none`}
                    />
                </td>
                <td className="px-2 py-1.5 min-w-[130px]">
                    <input type="date" value={dateRappel} onChange={(e) => setEdit(row, 'date_rappel', e.target.value)} className={cellInputClass} />
                </td>
                <td className="px-2 py-1.5 text-center"><EtatBadge etat={computeEtat(dateRappel)} /></td>
                <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                        {dirty && (
                            <>
                                <button type="button" onClick={() => saveRow(row)} disabled={savingId === row.id} className="p-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60" title="Enregistrer la ligne">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => cancelEdit(row.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Annuler les modifications">
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <button type="button" onClick={() => showHistory(row.client_name)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30" title="Historique du client">
                            <History className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(row)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </td>
            </>
        );
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Relance Clients</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Cliquez directement dans une case pour modifier, puis enregistrez avec le bouton vert ✓
                </p>
            </div>

            <div className="glass-card relative z-40 p-4 shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2.5 items-end">
                    <Field label="Client / Ville">
                        <ClientAutocomplete
                            clients={clients}
                            value={clientText}
                            onChangeText={handleClientText}
                            onSelect={selectFilterClient}
                            placeholder="Ex : fes, ou nom du client…"
                        />
                    </Field>
                    <Field label="État du rappel">
                        <select value={filters.etat} onChange={(e) => setFilter('etat', e.target.value)} className={inputClass}>
                            <option value="">Tous</option>
                            <option value="en_retard">En retard</option>
                            <option value="aujourd_hui">Aujourd&apos;hui</option>
                            <option value="a_venir">À venir</option>
                            <option value="sans_rappel">Sans date de rappel</option>
                        </select>
                    </Field>
                    <Field label="Appels du">
                        <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Au">
                        <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} className={inputClass} />
                    </Field>
                    <div className="col-span-2 lg:col-span-1 flex gap-2">
                        <button type="button" onClick={() => setApplied({ ...filters })} className="btn-secondary text-xs h-[34px] px-4 flex-1 lg:flex-none">
                            <Search className="w-3.5 h-3.5" /> Rechercher
                        </button>
                        <button type="button" onClick={resetAll} className="btn-secondary text-xs h-[34px] px-3" title="Réinitialiser les filtres">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {applied.client && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                    <p className="text-sm text-blue-900 dark:text-blue-200">
                        <History className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                        Historique de <strong>{applied.client}</strong> — {rows.length} appel(s)
                    </p>
                    <button type="button" onClick={resetAll} className="btn-secondary text-xs px-3 py-1.5">
                        <X className="w-3.5 h-3.5" /> Voir tout
                    </button>
                </div>
            )}

            {error && (
                <p className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
                    {error}
                </p>
            )}

            <div className="glass-card relative z-10 overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 via-brand-navy to-slate-900 border-b border-white/10 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                        <PhoneCall className="w-4 h-4" /> Tableau de relance
                    </h3>
                    <button type="button" onClick={load} disabled={loading} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Actualiser">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Mobile : saisie + cartes modifiables */}
                <div className="md:hidden">
                    <div className="m-3 rounded-xl border-2 border-brand-orange/40 bg-orange-50/60 dark:bg-orange-900/10 p-3 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">Nouvel appel</p>
                        <input type="date" value={newRow.date_appel} onChange={(e) => setNew('date_appel', e.target.value)} className={inputClass} />
                        <ClientSelect clients={clients} value={newRow.client_name} onChange={(v) => setNew('client_name', v)} />
                        <textarea value={newRow.remarque} onChange={(e) => setNew('remarque', e.target.value)} rows={2} placeholder="Remarque sur l'appel…" className={`${inputClass} resize-none`} />
                        <input type="date" value={newRow.date_rappel} onChange={(e) => setNew('date_rappel', e.target.value)} className={inputClass} />
                        <button type="button" onClick={handleAdd} disabled={adding} className="btn-primary w-full text-xs py-2.5 disabled:opacity-60">
                            <Plus className="w-4 h-4" /> {adding ? 'Ajout…' : 'Ajouter'}
                        </button>
                    </div>

                    <MobileCardList loading={loading} empty="Aucune relance pour ces critères">
                        {rows.length > 0 && rows.map((row) => {
                            const dirty = isDirty(row);
                            return (
                                <MobileRecordCard
                                    key={row.id}
                                    title={row.client_name}
                                    subtitle={`Appel du ${row.date_appel || '—'}`}
                                    badge={<EtatBadge etat={computeEtat(rowValue(row, 'date_rappel'))} />}
                                    fields={[
                                        { label: 'Date d\u2019appel', value: row.date_appel || '—' },
                                        { label: 'Solde', value: row.solde > 0 ? formatMontant(row.solde) : '—', className: row.solde > 0 ? 'text-red-600 dark:text-red-400 font-bold' : '' },
                                        { label: 'Remarque', value: row.remarque || '—', full: true },
                                        { label: 'Date de rappel', value: row.date_rappel || '—' },
                                        ...(row.appele_par ? [{ label: 'Appelé par', value: row.appele_par }] : []),
                                    ]}
                                    footer={(
                                        <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="date" value={rowValue(row, 'date_appel')} onChange={(e) => setEdit(row, 'date_appel', e.target.value)} className={inputClass} />
                                                <input type="date" value={rowValue(row, 'date_rappel')} onChange={(e) => setEdit(row, 'date_rappel', e.target.value)} className={inputClass} />
                                            </div>
                                            <textarea value={rowValue(row, 'remarque')} onChange={(e) => setEdit(row, 'remarque', e.target.value)} rows={2} placeholder="Remarque…" className={`${inputClass} resize-none`} />
                                            {dirty && (
                                                <button type="button" onClick={() => saveRow(row)} disabled={savingId === row.id} className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-60">
                                                    <Check className="w-4 h-4 inline mr-1 -mt-0.5" /> Enregistrer
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    actions={[
                                        { label: 'Historique', icon: History, color: 'blue', onClick: () => showHistory(row.client_name) },
                                        { label: 'Supprimer', icon: Trash2, color: 'red', onClick: () => handleDelete(row) },
                                    ]}
                                />
                            );
                        })}
                    </MobileCardList>
                </div>

                {/* Ordinateur : tableau modifiable */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-100 via-slate-200/90 to-slate-100 dark:from-slate-800 dark:via-slate-700/80 dark:to-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                                {columns.map((h) => (
                                    <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 whitespace-nowrap text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <tr className="bg-orange-50/70 dark:bg-orange-900/10">
                                <td className="px-2 py-1.5 min-w-[130px]">
                                    <input type="date" value={newRow.date_appel} onChange={(e) => setNew('date_appel', e.target.value)} className={`${cellInputClass} border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-800`} title="Date d'appel" />
                                </td>
                                <td className="px-2 py-1.5 min-w-[190px]">
                                    <ClientSelect clients={clients} value={newRow.client_name} onChange={(v) => setNew('client_name', v)} />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <SoldeCell value={soldeFor(newRow.client_name, null)} />
                                </td>
                                <td className="px-2 py-1.5 min-w-[220px]">
                                    <textarea
                                        value={newRow.remarque}
                                        onChange={(e) => setNew('remarque', e.target.value)}
                                        rows={1}
                                        placeholder="Remarque sur l'appel…"
                                        className={`${cellInputClass} resize-none border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-800`}
                                    />
                                </td>
                                <td className="px-2 py-1.5 min-w-[130px]">
                                    <input type="date" value={newRow.date_rappel} onChange={(e) => setNew('date_rappel', e.target.value)} className={`${cellInputClass} border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-800`} title="Date de rappel" />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                                        <CalendarClock className="w-3.5 h-3.5" /> Nouveau
                                    </span>
                                </td>
                                <td className="px-2 py-1.5">
                                    <button type="button" onClick={handleAdd} disabled={adding} className="mx-auto flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-orange text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-60" title="Ajouter la ligne">
                                        <Plus className="w-4 h-4" /> {adding ? '…' : 'Ajouter'}
                                    </button>
                                </td>
                            </tr>

                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}>
                                        {columns.map((__, j) => (
                                            <td key={j} className="px-4 py-3 text-center">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => {
                                    const dirty = isDirty(row);
                                    const etat = computeEtat(rowValue(row, 'date_rappel'));
                                    return (
                                        <tr
                                            key={row.id}
                                            className={`transition-colors ${dirty ? 'bg-amber-50/80 dark:bg-amber-900/10' : etat === 'en_retard' ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : etat === 'aujourd_hui' ? 'bg-orange-50/60 dark:bg-orange-900/10' : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/40'}`}
                                        >
                                            {renderRowCells(row)}
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                        Aucune relance pour ces critères. Remplissez la première ligne orange pour noter un appel.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="hidden md:flex flex-wrap gap-1.5 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 mr-1 py-1">Remarques rapides (nouvelle ligne) :</span>
                    {QUICK_NOTES.map((note) => (
                        <button
                            key={note}
                            type="button"
                            onClick={() => addQuickNote(note)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-orange-50 hover:text-orange-700 hover:ring-orange-200 dark:hover:bg-orange-900/20 dark:hover:text-orange-300 transition-colors"
                        >
                            {note}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
