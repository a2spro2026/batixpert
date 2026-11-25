import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    AppWindow, ChevronDown, LayoutGrid, Columns2, Grid2X2, Plus, Square, X,
} from 'lucide-react';
import { useWorkspace, MAX_WINDOWS } from '../../contexts/WorkspaceContext';
import { getPageTitle } from '../../lib/pageMeta';

function LayoutPreview({ count }) {
    if (count <= 1) {
        return (
            <span className="grid h-4 w-5 grid-cols-1 gap-0.5 rounded-[3px] border border-current/40 p-0.5 opacity-80">
                <span className="rounded-[1px] bg-current/70" />
            </span>
        );
    }
    if (count === 2) {
        return (
            <span className="grid h-4 w-5 grid-cols-2 gap-0.5 rounded-[3px] border border-current/40 p-0.5 opacity-80">
                <span className="rounded-[1px] bg-current/70" />
                <span className="rounded-[1px] bg-current/40" />
            </span>
        );
    }
    return (
        <span className="grid h-4 w-5 grid-cols-2 grid-rows-2 gap-0.5 rounded-[3px] border border-current/40 p-0.5 opacity-80">
            <span className="rounded-[1px] bg-current/70" />
            <span className="rounded-[1px] bg-current/45" />
            <span className="rounded-[1px] bg-current/45" />
            <span className={`rounded-[1px] ${count >= 4 ? 'bg-current/45' : 'bg-current/15'}`} />
        </span>
    );
}

export default function WorkspaceSwitcher() {
    const { pathname } = useLocation();
    const { panes, windowCount, closePane, closeSide, canAddPane, requestAddPane } = useWorkspace();
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const mainTitle = getPageTitle(pathname);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (!rootRef.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                title="Espaces de travail"
                className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    open || windowCount > 1
                        ? 'border-brand-navy/25 bg-brand-navy text-white shadow-sm shadow-brand-navy/20 dark:border-white/20 dark:bg-white/15'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
            >
                <LayoutPreview count={windowCount} />
                <span className="hidden sm:inline">Espaces</span>
                <span className={`tabular-nums ${open || windowCount > 1 ? 'text-white/80' : 'text-slate-400'}`}>
                    {windowCount}/{MAX_WINDOWS}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Gestion des espaces"
                    className="absolute right-0 z-[80] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
                >
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Multi-fenêtres</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                            Cliquez sur <span className="text-brand-orange">+</span> à côté d’un sous-menu
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                            {windowCount === 1 && <><Square className="h-3.5 w-3.5" /> Plein écran</>}
                            {windowCount === 2 && <><Columns2 className="h-3.5 w-3.5" /> Côte à côte</>}
                            {windowCount >= 3 && <><Grid2X2 className="h-3.5 w-3.5" /> Grille 2×2</>}
                            <span className="ml-auto inline-flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300">
                                <LayoutGrid className="h-3.5 w-3.5" />
                                {windowCount}/{MAX_WINDOWS}
                            </span>
                        </div>
                    </div>

                    <div className="max-h-[min(18rem,45vh)] space-y-1 overflow-y-auto p-2">
                        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/80 dark:bg-slate-800/60 dark:ring-slate-700">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-white">
                                <AppWindow className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Fenêtre 1</p>
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{mainTitle}</p>
                            </div>
                        </div>

                        {panes.map((pane, index) => {
                            const title = getPageTitle(pane.path.split('?')[0]);
                            return (
                                <div key={pane.id} className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800">
                                        {index + 2}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fenêtre {index + 2}</p>
                                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => closePane(pane.id)}
                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                                        title={`Fermer ${title}`}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-2 border-t border-slate-100 p-3 dark:border-slate-800">
                        {canAddPane && (
                            <button
                                type="button"
                                onClick={() => {
                                    requestAddPane();
                                    setOpen(false);
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 py-2.5 text-xs font-semibold text-white hover:bg-brand-navy/90"
                            >
                                <Plus className="h-4 w-4" strokeWidth={2.5} />
                                Ajouter une fenêtre ({windowCount + 1}/{MAX_WINDOWS})
                            </button>
                        )}
                        {windowCount > 1 && (
                            <button
                                type="button"
                                onClick={() => {
                                    closeSide();
                                    setOpen(false);
                                }}
                                className="w-full rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Tout fermer
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
