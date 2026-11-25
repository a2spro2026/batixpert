import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    PhoneCall, Plus, Search, RefreshCw, Trash2, History, Pencil, X,
} from 'lucide-react';
import api from '../lib/api';
import MobileRecordCard, { MobileCardList } from '../components/MobileRecordCard';

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptyFilters = { etat: '', date_from: '', date_to: '', client: '' };

const MOTIFS = [
    { value: 'relance', label: 'Relance' },
    { value: 'imp', label: 'Imp' },
    { value: 'retard', label: 'Retard' },
    { value: 'recouv', label: 'Recouv' },
];

function motifLabel(value) {
    return MOTIFS.find((item) => item.value === value)?.label || '';
}

function clientMatchesQuery(client, query) {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    const name = (client.name || '').toLowerCase();
    const code = (client.code || '').toLowerCase();
    const digits = q.replace(/^cr[-\s]?/i, '').replace(/\D/g, '').replace(/^0+/, '');
    return name.includes(q)
        || code.includes(q)
        || (digits !== '' && String(client.client_id) === digits);
}

function exactClient(clients, query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const byName = clients.find((client) => client.name.trim().toLowerCase() === q);
    if (byName) return byName;
    const compact = q.replace(/^cr[-\s]?/i, '').replace(/\D/g, '');
    if (!compact) return null;
    const padded = `cr-${compact.padStart(4, '0')}`;
    return clients.find((client) => (client.code || '').toLowerCase() === padded || (client.code || '').toLowerCase() === q) || null;
}

const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy';
function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isoToFr(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
}

function frToIso(text) {
    const match = String(text).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function maskFrDate(raw) {
    const digits = String(raw).replace(/\D/g, '').slice(0, 8);
    if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
}

function DateFrInput({ value, onChange, className, readOnly = false }) {
    const [text, setText] = useState(() => isoToFr(value));
    useEffect(() => { setText(isoToFr(value)); }, [value]);

    return (
        <input
            value={readOnly ? isoToFr(value) : text}
            readOnly={readOnly}
            inputMode="numeric"
            placeholder="JJ/MM/AAAA"
            maxLength={10}
            onChange={(e) => {
                const masked = maskFrDate(e.target.value);
                setText(masked);
                if (masked.length === 10) {
                    const iso = frToIso(masked);
                    if (iso) onChange(iso);
                } else if (masked.length === 0) {
                    onChange('');
                }
            }}
            className={`${className} normal-case`}
        />
    );
}

function Field({ label, children, className = '' }) {
    return (
        <div className={className}>
            <label className="field-label">{label}</label>
            {children}
        </div>
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

export default function ClientRelancePage() {
    const [rows, setRows] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [clientText, setClientText] = useState('');
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [nextCode, setNextCode] = useState('RL0001');
    const [panelField, setPanelField] = useState('');
    const [panel, setPanel] = useState({
        codeQuery: '',
        nameQuery: '',
        client_id: null,
        client_name: '',
        solde: null,
        motif: '',
        reponse: '',
        date_rappel: '',
    });

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
            .then((r) => {
                setClients(r.data.data ?? []);
                if (r.data.next_code) setNextCode(r.data.next_code);
            })
            .catch(() => setClients([]));
    }, []);

    const soldeFor = useCallback((name, fallback) => {
        if (!name) return fallback;
        const found = clients.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
        return found ? found.solde : fallback;
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

    const handleDelete = async (row) => {
        if (!window.confirm(`Supprimer la relance du ${row.date_appel || ''} pour « ${row.client_name} » ?`)) return;
        try {
            await api.delete(`/client-relances/${row.id}`);
            window.dispatchEvent(new Event('relances-changed'));
            load();
        } catch {}
    };

    const openPanel = () => {
        setError('');
        setEditingId(null);
        setPanelField('code');
        setPanel({
            codeQuery: '',
            nameQuery: '',
            client_id: null,
            client_name: '',
            solde: null,
            motif: '',
            reponse: '',
            date_rappel: '',
            date_appel: todayISO(),
        });
        api.get('/client-relances/meta')
            .then((r) => {
                setClients(r.data.data ?? []);
                setNextCode(r.data.next_code || 'RL0001');
            })
            .catch(() => {});
        setPanelOpen(true);
    };

    const openEdit = (row) => {
        const client = clients.find((item) => item.client_id === row.client_id)
            || clients.find((item) => item.name.trim().toLowerCase() === (row.client_name || '').trim().toLowerCase());
        setError('');
        setEditingId(row.id);
        setPanelField('');
        setNextCode(row.code || 'RL0001');
        setPanel({
            codeQuery: client?.code || '',
            nameQuery: row.client_name || '',
            client_id: client?.client_id || row.client_id || null,
            client_name: row.client_name || '',
            solde: client ? Number(client.solde) || 0 : Number(row.solde) || 0,
            motif: row.motif || '',
            reponse: row.reponse || row.remarque || '',
            date_rappel: row.date_rappel_raw || '',
            date_appel: row.date_appel_raw || '',
        });
        setPanelOpen(true);
    };

    const closePanel = () => {
        setPanelOpen(false);
        setEditingId(null);
    };

    const applyClient = (current, client, codeQuery, nameQuery) => ({
        ...current,
        codeQuery: client ? client.code : codeQuery,
        nameQuery: client ? client.name : nameQuery,
        client_id: client ? client.client_id : null,
        client_name: client ? client.name : '',
        solde: client ? Number(client.solde) || 0 : null,
    });

    const onCodeQuery = (text) => {
        const found = exactClient(clients, text);
        setPanelField('code');
        setPanel((current) => applyClient(current, found, text, found ? found.name : ''));
    };

    const onNameQuery = (text) => {
        const found = exactClient(clients, text);
        setPanelField('name');
        setPanel((current) => applyClient(current, found, found ? found.code : '', text));
    };

    const selectPanelClient = (client) => {
        setPanelField('');
        setPanel((current) => applyClient(current, client, client.code, client.name));
    };

    const handleAdd = async () => {
        if (!panel.client_id || !panel.client_name.trim()) {
            setError('Saisissez un code ou un nom de client reconnu.');
            return;
        }
        if (!panel.motif) {
            setError('Choisissez le motif de l\'appel.');
            return;
        }
        setAdding(true);
        setError('');
        const payload = {
            client_id: panel.client_id,
            client_name: panel.client_name.trim(),
            date_appel: editingId ? panel.date_appel : todayISO(),
            motif: panel.motif,
            reponse: panel.reponse.trim() || null,
            date_rappel: panel.date_rappel || null,
        };
        try {
            if (editingId) {
                await api.put(`/client-relances/${editingId}`, payload);
            } else {
                await api.post('/client-relances', payload);
            }
            setPanelOpen(false);
            setEditingId(null);
            window.dispatchEvent(new Event('relances-changed'));
            load();
        } catch (err) {
            const first = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : null;
            setError(first || (editingId ? 'Impossible de modifier cette relance.' : 'Impossible d\'ajouter cette relance.'));
        } finally {
            setAdding(false);
        }
    };

    const panelSuggestions = useMemo(() => {
        const q = (panelField === 'name' ? panel.nameQuery : panel.codeQuery).trim();
        if (!q || panel.client_id || !panelField) return [];
        return clients.filter((client) => clientMatchesQuery(client, q)).slice(0, 8);
    }, [clients, panel.codeQuery, panel.nameQuery, panel.client_id, panelField]);

    const columns = ['N°', 'Date', 'Code client', 'Nom client', 'Solde', 'Motif', 'Réponse', 'Date à rappeler', 'Actions'];

    const renderRowCells = (row) => {
        const clientCode = clients.find((client) => client.name.trim().toLowerCase() === (row.client_name || '').trim().toLowerCase())?.code || '';
        const cell = 'px-3 py-3 text-center align-middle text-slate-800 dark:text-slate-100';
        return (
            <>
                <td className={`${cell} font-bold whitespace-nowrap`}>{row.code}</td>
                <td className={`${cell} whitespace-nowrap normal-case`}>{row.date_appel || '—'}</td>
                <td className={`${cell} font-semibold whitespace-nowrap`}>{clientCode || '—'}</td>
                <td className={cell}>{row.client_name || '—'}</td>
                <td className={cell}><SoldeCell value={soldeFor(row.client_name, row.solde)} /></td>
                <td className={cell}>{motifLabel(row.motif) || '—'}</td>
                <td className={`${cell} normal-case whitespace-pre-wrap min-w-[240px]`}>{row.reponse || row.remarque || '—'}</td>
                <td className={`${cell} whitespace-nowrap normal-case`}>{row.date_rappel || '—'}</td>
                <td className={cell}>
                    <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30" title="Modifier">
                            <Pencil className="w-4 h-4" />
                        </button>
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
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto overscroll-contain gap-4">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Relance Clients</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                Cliquez sur Ajouter pour noter un appel. Le solde se remplit dès que le client est reconnu.
                </p>
            </div>

            <div className="glass-card relative z-40 p-4 shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="grid grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_auto] gap-2.5 items-end">
                    <Field label="Client / Ville">
                        <ClientAutocomplete
                            clients={clients}
                            value={clientText}
                            onChangeText={handleClientText}
                            onSelect={selectFilterClient}
                            placeholder="Ex : fes, ou nom du client…"
                        />
                    </Field>
                    <Field label="Appels du">
                        <DateFrInput value={filters.date_from} onChange={(value) => setFilter('date_from', value)} className={inputClass} />
                    </Field>
                    <Field label="Au">
                        <DateFrInput value={filters.date_to} onChange={(value) => setFilter('date_to', value)} className={inputClass} />
                    </Field>
                    <div className="col-span-2 lg:col-span-1 flex gap-2">
                        <button type="button" onClick={() => setApplied({ ...filters })} className="btn-secondary text-xs h-[34px] px-4 flex-1 lg:flex-none">
                            <Search className="w-3.5 h-3.5" /> Rechercher
                        </button>
                        <button type="button" onClick={resetAll} className="btn-secondary text-xs h-[34px] px-3" title="Réinitialiser les filtres">
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={openPanel} className="btn-primary text-xs h-[34px] px-4">
                            <Plus className="w-3.5 h-3.5" /> Ajouter
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

                <div className="md:hidden">
                    <MobileCardList loading={loading} empty="Aucune relance. Cliquez sur Ajouter.">
                        {rows.length > 0 && rows.map((row) => (
                            <MobileRecordCard
                                key={row.id}
                                title={row.client_name}
                                subtitle={`${row.code || ''} · ${row.date_appel || '—'}`}
                                fields={[
                                    { label: 'Code client', value: clients.find((client) => client.name.trim().toLowerCase() === row.client_name.trim().toLowerCase())?.code || '—' },
                                    { label: 'Solde', value: row.solde > 0 ? formatMontant(row.solde) : '—', className: row.solde > 0 ? 'text-red-600 dark:text-red-400 font-bold' : '' },
                                    { label: 'Motif', value: motifLabel(row.motif) || '—' },
                                    { label: 'Réponse', value: row.reponse || row.remarque || '—', full: true },
                                    { label: 'Date à rappeler', value: row.date_rappel || '—' },
                                ]}
                                actions={[
                                    { label: 'Modifier', icon: Pencil, color: 'amber', onClick: () => openEdit(row) },
                                    { label: 'Historique', icon: History, color: 'blue', onClick: () => showHistory(row.client_name) },
                                    { label: 'Supprimer', icon: Trash2, color: 'red', onClick: () => handleDelete(row) },
                                ]}
                            />
                        ))}
                    </MobileCardList>
                </div>

                {/* Ordinateur : tableau d'affichage */}
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
                                rows.map((row) => (
                                    <tr key={row.id} className="transition-colors hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                                        {renderRowCells(row)}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                        Aucune relance pour ces critères. Cliquez sur Ajouter pour noter un appel.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {panelOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={closePanel}>
                    <div className="bg-white dark:bg-slate-900 w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-h-[92dvh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-700 to-brand-navy">
                            <h3 className="text-white font-bold text-sm uppercase">{editingId ? 'Modifier l\'appel' : 'Nouvel appel'}</h3>
                            <button type="button" onClick={closePanel} className="p-1.5 text-white/80 hover:text-white" aria-label="Fermer"><X className="w-4 h-4" /></button>
                        </div>
                        <form
                            className="p-5 space-y-3"
                            onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
                        >
                            {error && <p className="text-xs font-medium text-red-600 dark:text-red-300 normal-case">{error}</p>}
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="N°">
                                    <input value={nextCode} readOnly className={`${inputClass} font-bold bg-slate-50 dark:bg-slate-800/80`} />
                                </Field>
                                <Field label="Date">
                                    <input value={isoToFr(editingId ? panel.date_appel : todayISO())} readOnly className={`${inputClass} normal-case bg-slate-50 dark:bg-slate-800/80`} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label="Code client">
                                    <div className="relative">
                                        <input
                                            value={panel.codeQuery}
                                            onChange={(e) => onCodeQuery(e.target.value)}
                                            onFocus={() => setPanelField('code')}
                                            placeholder="CR-0001"
                                            className={`${inputClass} normal-case`}
                                            autoComplete="off"
                                            autoFocus
                                        />
                                        {panelField === 'code' && panelSuggestions.length > 0 && (
                                            <div className="absolute z-30 mt-1 w-[min(20rem,calc(100vw-3rem))] max-h-52 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                                                {panelSuggestions.map((client) => (
                                                    <button
                                                        key={client.client_id}
                                                        type="button"
                                                        onMouseDown={(e) => { e.preventDefault(); selectPanelClient(client); }}
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                                    >
                                                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 normal-case">{client.code} · {client.name}</span>
                                                        <span className={`block text-[11px] normal-case ${Number(client.solde) > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>Solde : {formatMontant(client.solde)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Field>
                                <Field label="Nom client">
                                    <div className="relative">
                                        <input
                                            value={panel.nameQuery}
                                            onChange={(e) => onNameQuery(e.target.value)}
                                            onFocus={() => setPanelField('name')}
                                            placeholder="Nom du client"
                                            className={`${inputClass} normal-case`}
                                            autoComplete="off"
                                        />
                                        {panelField === 'name' && panelSuggestions.length > 0 && (
                                            <div className="absolute z-30 mt-1 w-[min(20rem,calc(100vw-3rem))] max-h-52 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                                                {panelSuggestions.map((client) => (
                                                    <button
                                                        key={client.client_id}
                                                        type="button"
                                                        onMouseDown={(e) => { e.preventDefault(); selectPanelClient(client); }}
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                                    >
                                                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 normal-case">{client.code} · {client.name}</span>
                                                        <span className={`block text-[11px] normal-case ${Number(client.solde) > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>Solde : {formatMontant(client.solde)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Field>
                                <Field label="Solde">
                                    <input
                                        value={panel.client_id ? formatMontant(panel.solde) : ''}
                                        readOnly
                                        placeholder="—"
                                        className={`${inputClass} normal-case font-bold bg-slate-50 dark:bg-slate-800/80 ${Number(panel.solde) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}
                                    />
                                </Field>
                            </div>
                            <div className="sm:max-w-[11rem]">
                                <Field label="Motif">
                                    <select
                                        value={panel.motif}
                                        onChange={(e) => setPanel((current) => ({ ...current, motif: e.target.value }))}
                                        className={`${inputClass} normal-case`}
                                        required
                                    >
                                        <option value="">Choisir</option>
                                        {MOTIFS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                    </select>
                                </Field>
                            </div>
                            <Field label="Réponse">
                                <textarea
                                    value={panel.reponse}
                                    onChange={(e) => setPanel((current) => ({ ...current, reponse: e.target.value }))}
                                    rows={6}
                                    placeholder="Réponse du client"
                                    className={`${inputClass} normal-case min-h-40 resize-y`}
                                />
                            </Field>
                            <div className="sm:max-w-[11rem]">
                                <Field label="Date à rappeler">
                                    <DateFrInput
                                        value={panel.date_rappel}
                                        onChange={(value) => setPanel((current) => ({ ...current, date_rappel: value }))}
                                        className={inputClass}
                                    />
                                </Field>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={closePanel} className="btn-secondary text-xs px-4">Fermer</button>
                                <button type="submit" disabled={adding} className="btn-primary text-xs px-4">{adding ? 'Validation…' : 'Valider'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
