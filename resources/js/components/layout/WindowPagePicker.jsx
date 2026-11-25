import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { navigation } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

function flattenPages(can) {
    const pages = [];
    navigation.forEach((item) => {
        if (item.to && item.to !== '/' && !item.disabled && can(item.perm)) {
            pages.push({ to: item.to, label: item.label, section: item.label, icon: item.icon });
        }
        (item.children || []).forEach((child) => {
            if (child.disabled || !child.to) return;
            const hasSection = can(item.perm);
            if (!hasSection && !can(child.perm)) return;
            pages.push({
                to: child.to,
                label: child.label,
                section: item.label,
                icon: child.icon,
            });
        });
    });
    return pages;
}

export default function WindowPagePicker({ open, onClose }) {
    const { can } = useAuth();
    const { openSide, panes, canAddPane } = useWorkspace();
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    const openPaths = useMemo(
        () => new Set(panes.map((p) => p.path.split('?')[0])),
        [panes],
    );

    const pages = useMemo(() => flattenPages(can), [can]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return pages;
        return pages.filter(
            (p) => p.label.toLowerCase().includes(q) || p.section.toLowerCase().includes(q),
        );
    }, [pages, query]);

    useEffect(() => {
        if (!open) {
            setQuery('');
            return undefined;
        }
        const t = window.setTimeout(() => inputRef.current?.focus(), 50);
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            window.clearTimeout(t);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    if (!open) return null;

    const pick = (to) => {
        if (!canAddPane) return;
        const added = openSide(to);
        if (added !== false) onClose?.();
    };

    const grouped = filtered.reduce((acc, page) => {
        if (!acc[page.section]) acc[page.section] = [];
        acc[page.section].push(page);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/50 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={onClose}>
            <div
                role="dialog"
                aria-label="Ouvrir une fenêtre"
                className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher une page…"
                        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
                    />
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[min(24rem,50vh)] overflow-y-auto p-2">
                    {Object.keys(grouped).length === 0 ? (
                        <p className="px-3 py-8 text-center text-sm text-slate-500">Aucune page trouvée</p>
                    ) : (
                        Object.entries(grouped).map(([section, items]) => (
                            <div key={section} className="mb-2">
                                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section}</p>
                                <div className="space-y-0.5">
                                    {items.map((page) => {
                                        const Icon = page.icon;
                                        const already = openPaths.has(page.to);
                                        return (
                                            <button
                                                key={page.to}
                                                type="button"
                                                disabled={already}
                                                onClick={() => pick(page.to)}
                                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-slate-800/70"
                                            >
                                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-brand-navy dark:bg-slate-800 dark:text-brand-orange">
                                                    {Icon ? <Icon className="h-4 w-4" /> : null}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {page.label}
                                                </span>
                                                {already && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-brand-orange">Ouverte</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
