import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, X, Ban, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { authorizationSections, allAuthorizationPerms } from '../config/authorizationMenu';

const ALL_PERMS = allAuthorizationPerms();

function SectionPermissions({ section, selected, onToggle, onToggleSection }) {
    const childPerms = (section.children || []).map((c) => c.perm);
    const allChecked = childPerms.length > 0 && childPerms.every((p) => selected.has(p));
    const someChecked = childPerms.some((p) => selected.has(p));
    const parentChecked = selected.has(section.perm) || allChecked;

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <input
                    type="checkbox"
                    checked={parentChecked}
                    ref={(el) => {
                        if (el) el.indeterminate = !parentChecked && someChecked;
                    }}
                    onChange={() => onToggleSection(section)}
                    className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-xs font-bold uppercase tracking-wide text-brand-navy dark:text-orange-400">
                    {section.label}
                </span>
            </div>
            {section.children?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-3">
                    {section.children.map((child) => (
                        <label
                            key={child.perm}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(child.perm)}
                                onChange={() => onToggle(child.perm, section)}
                                className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy shrink-0"
                            />
                            <span className="truncate">{child.label}</span>
                        </label>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default function UserAuthorizationsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlUserId = Number(searchParams.get('user_id')) || null;
    const [users, setUsers] = useState([]);
    const [selectedId, setSelectedId] = useState(urlUserId);
    const [checkedUserIds, setCheckedUserIds] = useState(new Set());
    const [selectedPerms, setSelectedPerms] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        api.get('/user-authorizations')
            .then((r) => {
                const rows = r.data.data ?? [];
                setUsers(rows);
                setSelectedId((current) => {
                    if (urlUserId && rows.some((u) => u.id === urlUserId)) {
                        return urlUserId;
                    }
                    return current ?? rows[0]?.id ?? null;
                });
            })
            .catch(() => setUsers([]))
            .finally(() => setLoading(false));
    }, [urlUserId]);

    useEffect(() => {
        load();
    }, [load]);

    const selectedUser = useMemo(
        () => users.find((u) => u.id === selectedId) || null,
        [users, selectedId],
    );

    const checkedUsers = useMemo(
        () => users.filter((u) => checkedUserIds.has(u.id)),
        [users, checkedUserIds],
    );

    const allUsersChecked = users.length > 0 && users.every((u) => checkedUserIds.has(u.id));
    const someUsersChecked = users.some((u) => checkedUserIds.has(u.id));

    const toggleUserCheck = (userId, event) => {
        event?.stopPropagation();
        setCheckedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const toggleAllUsers = () => {
        setCheckedUserIds((prev) => {
            if (users.every((u) => prev.has(u.id))) {
                return new Set();
            }
            return new Set(users.map((u) => u.id));
        });
    };

    useEffect(() => {
        if (urlUserId) {
            setSelectedId(urlUserId);
        }
    }, [urlUserId]);

    useEffect(() => {
        if (!selectedUser) {
            setSelectedPerms(new Set());
            return;
        }
        setSelectedPerms(new Set(selectedUser.permissions || []));
        setMessage('');
        setError('');
    }, [selectedUser]);

    const togglePerm = (perm, section) => {
        setSelectedPerms((prev) => {
            const next = new Set(prev);
            if (next.has(perm)) {
                next.delete(perm);
            } else {
                next.add(perm);
                if (section?.perm) next.add(section.perm);
            }
            return next;
        });
    };

    const toggleSection = (section) => {
        const perms = [section.perm, ...(section.children || []).map((c) => c.perm)];
        const allOn = perms.every((p) => selectedPerms.has(p));
        setSelectedPerms((prev) => {
            const next = new Set(prev);
            perms.forEach((p) => {
                if (allOn) next.delete(p);
                else next.add(p);
            });
            return next;
        });
    };

    const allSelected = ALL_PERMS.length > 0 && ALL_PERMS.every((p) => selectedPerms.has(p));
    const someSelected = ALL_PERMS.some((p) => selectedPerms.has(p));

    const toggleSelectAll = () => {
        setSelectedPerms((prev) => {
            if (ALL_PERMS.every((p) => prev.has(p))) {
                return new Set();
            }
            return new Set(ALL_PERMS);
        });
    };

    const handleValidate = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const r = await api.put(`/users/${selectedUser.id}/authorizations`, {
                permissions: [...selectedPerms],
            });
            const updated = r.data.data;
            if (updated) {
                setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
                setSelectedPerms(new Set(updated.permissions || []));
            }
            setMessage(r.data.message || 'Autorisations enregistrées.');
        } catch (err) {
            setError(err.response?.data?.message || 'Enregistrement impossible.');
        } finally {
            setSaving(false);
        }
    };

    const handleSuspend = async () => {
        const targets = checkedUsers.length > 0 ? checkedUsers : (selectedUser ? [selectedUser] : []);
        if (!targets.length) return;

        const activeCount = targets.filter((u) => u.is_active).length;
        const suspendedCount = targets.length - activeCount;
        const actionLabel = checkedUsers.length > 1
            ? (activeCount > 0 && suspendedCount > 0
                ? `Modifier le statut de ${targets.length} utilisateurs`
                : activeCount > 0
                    ? `Suspendre ${activeCount} utilisateur(s)`
                    : `Réactiver ${suspendedCount} utilisateur(s)`)
            : (targets[0].is_active ? 'Suspendre' : 'Réactiver');

        const names = targets.map((u) => u.name).join(', ');
        if (!window.confirm(`${actionLabel} ?\n\n${names}`)) return;

        setSaving(true);
        setError('');
        try {
            const results = await Promise.all(
                targets.map((u) => api.patch(`/users/${u.id}/suspend`)),
            );
            setMessage(results[results.length - 1]?.data?.message || 'Statut mis à jour.');
            setCheckedUserIds(new Set());
            load();
        } catch (err) {
            setError(err.response?.data?.message || 'Action impossible.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 gap-3">
            <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-brand-navy dark:text-orange-400" />
                        Autorisations utilisateurs
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gestion des accès par section et sous-menu</p>
                </div>
                <button type="button" onClick={load} disabled={loading} className="btn-secondary text-xs self-start">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </button>
            </div>

            {(message || error) && (
                <div className={`shrink-0 px-4 py-2.5 rounded-xl text-sm border ${error ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                    {error || message}
                </div>
            )}

            <div className="shrink-0 glass-card overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                <div className="px-5 py-3 bg-gradient-to-r from-slate-700 via-slate-800 to-brand-navy border-b border-white/10 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Utilisateurs</h3>
                    {checkedUsers.length > 0 && (
                        <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
                            {checkedUsers.length} sélectionné(s)
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[780px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-3 py-2.5 text-center w-10">
                                    <input
                                        type="checkbox"
                                        checked={allUsersChecked}
                                        ref={(el) => {
                                            if (el) el.indeterminate = !allUsersChecked && someUsersChecked;
                                        }}
                                        onChange={toggleAllUsers}
                                        className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                                        title="Tout sélectionner"
                                    />
                                </th>
                                {['ID', 'Nom Complet', 'Statut', 'État'].map((h) => (
                                    <th key={h} className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chargement…</td></tr>
                            ) : users.length ? users.map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={() => setSelectedId(row.id)}
                                    className={`cursor-pointer transition-colors ${selectedId === row.id ? 'bg-amber-50/80 dark:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                                >
                                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={checkedUserIds.has(row.id)}
                                            onChange={(e) => toggleUserCheck(row.id, e)}
                                            className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                                        />
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold">{row.id}</td>
                                    <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-white">{row.name}</td>
                                    <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.statut_label || row.statut}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {row.is_active ? 'Actif' : 'Suspendu'}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucun utilisateur</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUser && (
                <div className="flex-1 min-h-0 glass-card flex flex-col overflow-hidden shadow-card border border-slate-200/60 dark:border-slate-700/60">
                    <div className="shrink-0 px-5 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-orange-700 border-b border-white/10">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                            Autorisations — {selectedUser.name}
                        </h3>
                    </div>
                    <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => {
                                    if (el) el.indeterminate = !allSelected && someSelected;
                                }}
                                onChange={toggleSelectAll}
                                className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                            />
                            Tout sélectionner
                        </label>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                            {selectedPerms.size} / {ALL_PERMS.length}
                        </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto p-4">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {authorizationSections.map((section) => (
                                <SectionPermissions
                                    key={section.id}
                                    section={section}
                                    selected={selectedPerms}
                                    onToggle={togglePerm}
                                    onToggleSection={toggleSection}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <button type="button" onClick={handleValidate} disabled={saving} className="btn-primary text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valider
                        </button>
                        <button type="button" onClick={handleSuspend} disabled={saving || (!checkedUsers.length && !selectedUser)} className="btn-secondary text-xs">
                            <Ban className="w-3.5 h-3.5" />
                            {checkedUsers.length > 1
                                ? `Suspendre (${checkedUsers.length})`
                                : checkedUsers.length === 1
                                    ? (checkedUsers[0].is_active ? 'Suspendre' : 'Réactiver')
                                    : (selectedUser?.is_active ? 'Suspendre' : 'Réactiver')}
                        </button>
                        <button type="button" onClick={() => navigate('/configuration/utilisateurs')} className="btn-muted text-xs">
                            <X className="w-3.5 h-3.5" />
                            Fermer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
