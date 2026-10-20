import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    PhoneCall, Plus, Search, RefreshCw, Pencil, Trash2, History, X,
    CalendarClock, AlarmClock, CalendarCheck, ListFilter, Phone,
} from 'lucide-react';
import api from '../lib/api';
import MobileRecordCard, { MobileCardList } from '../components/MobileRecordCard';

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptyFilters = { etat: '', date_from: '', date_to: '', client: '' };
const emptyForm = () => ({ date_appel: todayISO(), client_name: '', remarque: '', date_rappel: '' });

const QUICK_NOTES = ['Sans réponse', 'Occupé', 'À rappeler', 'Promesse de paiement', 'Rendez-vous pris'];

const ETATS = {
    en_retard: { label: 'En retard', classes: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800' },
    aujourd_hui: { label: "Aujourd'hui", classes: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800' },
    a_venir: { label: 'À venir', classes: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800' },
    sans_rappel: { label: 'Historique', classes: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
};

const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy';

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

function SummaryCard({ label, value, gradient, icon: Icon, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-4 shadow-lg text-white text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${active ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900' : ''}`}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />
            <div className="relative flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{label}</p>
                    <p className="mt-1.5 text-xl sm:text-2xl font-bold tabular-nums leading-tight">{value}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/15 ring-1 ring-white/20 shrink-0">
                    <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
            </div>
        </button>
    );
}

export default function ClientRelancePage() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ total: 0, en_retard: 0, aujourd_hui: 0, a_venir: 0, sans_rappel: 0 });
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [clientText, setClientText] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (applied.etat) params.etat = applied.etat;
        if (applied.date_from) params.date_from = applied.date_from;
        if (applied.date_to) params.date_to = applied.date_to;
        if (applied.client) params.client = applied.client;

        api.get('/client-relances', { params })
            .then((res) => {
                setRows(res.data.data ?? []);
                setMeta(res.data.meta ?? { total: 0, en_retard: 0, aujourd_hui: 0, a_venir: 0, sans_rappel: 0 });
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, [applied]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        api.get('/client-relances/meta')
            .then((r) => setClients(r.data.data ?? []))
            .catch(() => setClients([]));
    }, []);

    const matchedClient = useMemo(() => {
        const key = form.client_name.trim().toLowerCase();
        if (!key) return null;
        return clients.find((c) => c.name.trim().toLowerCase() === key) || null;
    }, [form.client_name, clients]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm());
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        setForm({
            date_appel: row.date_appel_raw || todayISO(),
            client_name: row.client_name || '',
            remarque: row.remarque || '',
            date_rappel: row.date_rappel_raw || '',
        });
        setFormError('');
        setFormOpen(true);
    };

    const addQuickNote = (note) => {
        setForm((f) => {
            const current = (f.remarque || '').trim();
            if (!current) return { ...f, remarque: note };
            if (current.toLowerCase().includes(note.toLowerCase())) return f;
            return { ...f, remarque: `${current} — ${note}` };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.client_name.trim()) {
            setFormError('Choisissez un client dans la liste (Fiche Client).');
            return;
        }
        setSaving(true);
        setFormError('');
        const payload = {
            client_id: matchedClient?.client_id ?? null,
            client_name: form.client_name.trim(),
            date_appel: form.date_appel,
            remarque: form.remarque.trim() || null,
            date_rappel: form.date_rappel || null,
        };
        try {
            if (editing) {
                await api.put(`/client-relances/${editing.id}`, payload);
            } else {
                await api.post('/client-relances', payload);
            }
            setFormOpen(false);
            setEditing(null);
            load();
        } catch (err) {
            const first = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : null;
            setFormError(first || "Impossible d'enregistrer cette relance.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Supprimer la relance du ${row.date_appel || ''} pour « ${row.client_name} » ?`)) return;
        try {
            await api.delete(`/client-relances/${row.id}`);
            load();
        } catch {}
    };

    const showHistory = (row) => {
        const next = { ...emptyFilters, client: row.client_name };
        setFilters(next);
        setApplied(next);
        setClientText(row.client_name);
    };

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

    const filterByEtat = (etat) => {
        const next = { ...applied, etat: applied.etat === etat ? '' : etat };
        setFilters(next);
        setApplied(next);
    };

    const columns = ["Date d'appel", 'Client', 'Solde', 'Remarque', 'Date de rappel', 'État', 'Actions'];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Relance Clients</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Appels, discussions téléphoniques et rendez-vous à ne pas oublier</p>
                </div>
                <button type="button" onClick={openCreate} className="btn-primary text-xs px-4 py-2.5">
                    <Plus className="w-4 h-4" /> Nouvelle relance
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard label="En retard" value={meta.en_retard} gradient="from-red-500 via-rose-600 to-red-800" icon={AlarmClock} active={applied.etat === 'en_retard'} onClick={() => filterByEtat('en_retard')} />
                <SummaryCard label="À appeler aujourd'hui" value={meta.aujourd_hui} gradient="from-amber-400 via-orange-500 to-orange-700" icon={PhoneCall} active={applied.etat === 'aujourd_hui'} onClick={() => filterByEtat('aujourd_hui')} />
                <SummaryCard label="À venir" value={meta.a_venir} gradient="from-blue-600 via-brand-navy to-slate-900" icon={CalendarClock} active={applied.etat === 'a_venir'} onClick={() => filterByEtat('a_venir')} />
                <SummaryCard label="Total relances" value={meta.total} gradient="from-slate-600 via-slate-700 to-slate-900" icon={ListFilter} active={!applied.etat && !applied.client} onClick={resetAll} />
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

            {formOpen && (
                <form onSubmit={handleSave} className="glass-card relative z-30 p-4 shadow-card border-2 border-brand-orange/40 dark:border-brand-orange/40 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                            {editing ? 'Modifier la relance' : 'Nouvelle relance'}
                        </h3>
                        <button type="button" onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800" title="Fermer">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <Field label="Date d'appel *">
                            <input type="date" required value={form.date_appel} onChange={(e) => setField('date_appel', e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Client appelé *" className="col-span-2 lg:col-span-2">
                            <ClientAutocomplete
                                clients={clients}
                                value={form.client_name}
                                onChangeText={(text) => setField('client_name', text)}
                                onSelect={(c) => setField('client_name', c.name)}
                                placeholder="Nom du client ou ville…"
                            />
                        </Field>
                        <Field label="Date de rappel">
                            <input type="date" value={form.date_rappel} onChange={(e) => setField('date_rappel', e.target.value)} className={inputClass} />
                        </Field>
                    </div>

                    {matchedClient && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                            {matchedClient.phone && (
                                <span className="inline-flex items-center gap-1">
                                    <Phone className="w-3.5 h-3.5" />
                                    <a href={`tel:${matchedClient.phone}`} className="font-semibold text-brand-navy dark:text-orange-400">{matchedClient.phone}</a>
                                </span>
                            )}
                            {matchedClient.city && <span>Ville : <strong>{matchedClient.city}</strong></span>}
                            <span>
                                Solde (Balance Fournisseur) :{' '}
                                <strong className={matchedClient.solde > 0 ? 'text-red-600 dark:text-red-400' : ''}>
                                    {matchedClient.solde === null || matchedClient.solde === undefined ? '—' : formatMontant(matchedClient.solde)}
                                </strong>
                            </span>
                        </p>
                    )}

                    <Field label="Remarque sur l'appel">
                        <textarea
                            value={form.remarque}
                            onChange={(e) => setField('remarque', e.target.value)}
                            rows={2}
                            placeholder="Ex : Sans réponse, promet de payer vendredi, rendez-vous le…"
                            className={`${inputClass} resize-none`}
                        />
                    </Field>
                    <div className="flex flex-wrap gap-1.5">
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

                    {formError && <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>}

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary text-xs px-4">Annuler</button>
                        <button type="submit" disabled={saving} className="btn-primary text-xs px-5 disabled:opacity-60">
                            <CalendarCheck className="w-4 h-4" /> {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            )}

            <div className="glass-card relative z-10 overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 via-brand-navy to-slate-900 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Tableau de relance</h3>
                    <button type="button" onClick={load} disabled={loading} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Actualiser">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="md:hidden">
                    <MobileCardList loading={loading} empty="Aucune relance pour ces critères">
                        {rows.length > 0 && rows.map((row) => (
                            <MobileRecordCard
                                key={row.id}
                                title={row.client_name}
                                subtitle={`Appel du ${row.date_appel || '—'}`}
                                badge={<EtatBadge etat={row.etat} />}
                                fields={[
                                    { label: 'Solde', value: row.solde > 0 ? formatMontant(row.solde) : '—', className: row.solde > 0 ? 'text-red-600 dark:text-red-400 font-bold' : '' },
                                    { label: 'Date de rappel', value: row.date_rappel || '—' },
                                    { label: 'Remarque', value: row.remarque || '—', full: true },
                                    ...(row.appele_par ? [{ label: 'Appelé par', value: row.appele_par }] : []),
                                    ...(row.phone ? [{ label: 'Téléphone', value: row.phone }] : []),
                                ]}
                                actions={[
                                    { label: 'Historique', icon: History, color: 'blue', onClick: () => showHistory(row) },
                                    { label: 'Modifier', icon: Pencil, color: 'amber', onClick: () => openEdit(row) },
                                    { label: 'Supprimer', icon: Trash2, color: 'red', onClick: () => handleDelete(row) },
                                ]}
                            />
                        ))}
                    </MobileCardList>
                </div>

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
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i}>
                                        {columns.map((__, j) => (
                                            <td key={j} className="px-4 py-3 text-center">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto max-w-[80px]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors ${row.etat === 'en_retard' ? 'bg-red-50/50 dark:bg-red-900/10' : row.etat === 'aujourd_hui' ? 'bg-orange-50/60 dark:bg-orange-900/10' : ''}`}>
                                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.date_appel || '—'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <button type="button" onClick={() => showHistory(row)} title="Voir l'historique de ce client" className="font-medium text-brand-navy dark:text-orange-400 hover:underline">
                                                {row.client_name}
                                            </button>
                                            {(row.phone || row.city) && (
                                                <span className="block text-[11px] text-slate-400">
                                                    {[row.city, row.phone].filter(Boolean).join(' · ')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center"><SoldeCell value={row.solde} /></td>
                                        <td className="px-4 py-2.5 text-left text-slate-700 dark:text-slate-200 max-w-[260px]">
                                            <span className="line-clamp-2" title={row.remarque || ''}>{row.remarque || '—'}</span>
                                            {row.appele_par && <span className="block text-[11px] text-slate-400">Par {row.appele_par}</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-center whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{row.date_rappel || '—'}</td>
                                        <td className="px-4 py-2.5 text-center"><EtatBadge etat={row.etat} /></td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center gap-1">
                                                <button type="button" onClick={() => showHistory(row)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30" title="Historique du client">
                                                    <History className="w-4 h-4" />
                                                </button>
                                                <button type="button" onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30" title="Modifier">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button type="button" onClick={() => handleDelete(row)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30" title="Supprimer">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                        Aucune relance pour ces critères. Cliquez sur « Nouvelle relance » pour noter un appel.
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
