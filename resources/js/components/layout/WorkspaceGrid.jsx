import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppWindow, GripVertical, Move, Plus, X } from 'lucide-react';
import { AuthContext, useAuth } from '../../contexts/AuthContext';
import { ThemeContext, useTheme } from '../../contexts/ThemeContext';
import { MAIN_SLOT, useWorkspace } from '../../contexts/WorkspaceContext';
import { getPageTitle } from '../../lib/pageMeta';
import { SidePageRoutes } from '../../routes/sidePageRoutes';

function SidePanelApp({ path, auth, theme }) {
    return (
        <ThemeContext.Provider value={theme}>
            <AuthContext.Provider value={auth}>
                <MemoryRouter initialEntries={[path]}>
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                        <SidePageRoutes />
                    </div>
                </MemoryRouter>
            </AuthContext.Provider>
        </ThemeContext.Provider>
    );
}

const POSITION_LABELS_2 = ['Gauche', 'Droite'];
const POSITION_LABELS_4 = ['Haut gauche', 'Haut droite', 'Bas gauche', 'Bas droite'];

function PositionMenu({ slotKey, slotIndex, total, onMoveTo, isMain }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const labels = total <= 2 ? POSITION_LABELS_2 : POSITION_LABELS_4;
    const count = total <= 2 ? 2 : Math.min(4, Math.max(total, 4));

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (!rootRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`rounded-md p-1 transition ${
                    isMain
                        ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white'
                        : 'text-white/75 hover:bg-white/15 hover:text-white'
                }`}
                title="Déplacer la fenêtre"
                aria-label="Déplacer la fenêtre"
            >
                <Move className="h-3.5 w-3.5" />
            </button>
            {open && (
                <div className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-900">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Position</p>
                    <div className="grid grid-cols-2 gap-1 p-2">
                        {Array.from({ length: Math.min(count, total) }, (_, i) => (
                            <button
                                key={labels[i] || i}
                                type="button"
                                disabled={i === slotIndex}
                                onClick={() => {
                                    onMoveTo(slotKey, i);
                                    setOpen(false);
                                }}
                                className={`rounded-lg px-2 py-2 text-[10px] font-semibold leading-tight transition ${
                                    i === slotIndex
                                        ? 'bg-brand-navy text-white'
                                        : 'bg-slate-50 text-slate-600 hover:bg-brand-navy/10 hover:text-brand-navy dark:bg-slate-800 dark:text-slate-300'
                                }`}
                            >
                                {labels[i]}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function WindowChrome({
    title,
    slotKey,
    slotIndex,
    total,
    onMoveTo,
    onClose,
    isMain = false,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragOver,
}) {
    return (
        <div
            draggable
            onDragStart={(e) => {
                if (e.target.closest('button')) {
                    e.preventDefault();
                    return;
                }
                onDragStart?.(e, slotKey);
            }}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onDragOver?.(e, slotKey)}
            onDrop={(e) => onDrop?.(e, slotKey)}
            title="Glisser pour déplacer"
            className={`flex shrink-0 cursor-grab items-center gap-1.5 px-2.5 py-1.5 active:cursor-grabbing ${
                isMain
                    ? 'border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    : 'border-b border-white/10 bg-gradient-to-r from-slate-900 via-brand-navy to-slate-800'
            } ${isDragOver ? 'ring-2 ring-inset ring-brand-orange' : ''}`}
        >
            <GripVertical className={`h-3.5 w-3.5 shrink-0 ${isMain ? 'text-slate-400' : 'text-white/50'}`} />
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                isMain ? 'bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-brand-orange' : 'bg-white/10 text-white'
            }`}
            >
                <AppWindow className="h-3.5 w-3.5" />
            </span>
            <p className={`min-w-0 flex-1 truncate text-xs font-semibold tracking-wide ${
                isMain ? 'text-slate-800 dark:text-slate-100' : 'text-white'
            }`}
            >
                {title}
            </p>
            {total > 1 && (
                <PositionMenu
                    slotKey={slotKey}
                    slotIndex={slotIndex}
                    total={total}
                    onMoveTo={onMoveTo}
                    isMain={isMain}
                />
            )}
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className={`rounded-md p-1 transition ${
                        isMain
                            ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800'
                            : 'text-white/70 hover:bg-white/15 hover:text-white'
                    }`}
                    aria-label="Fermer la fenêtre"
                    title="Fermer"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

function ExtraPane({
    pane, onClose, slotKey, slotIndex, total, onMoveTo,
    onDragStart, onDragOver, onDrop, onDragEnd, isDragOver,
}) {
    const auth = useAuth();
    const theme = useTheme();
    const mountRef = useRef(null);
    const authRef = useRef(auth);
    const themeRef = useRef(theme);
    authRef.current = auth;
    themeRef.current = theme;

    const pathname = pane.path.split('?')[0];
    const title = getPageTitle(pathname);

    useLayoutEffect(() => {
        const node = mountRef.current;
        if (!node) return undefined;

        const root = createRoot(node);
        root.render(
            <SidePanelApp
                path={pane.path}
                auth={authRef.current}
                theme={themeRef.current}
            />,
        );

        return () => {
            root.unmount();
        };
    }, [pane.id, pane.path]);

    return (
        <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-950">
            <WindowChrome
                title={title}
                slotKey={slotKey}
                slotIndex={slotIndex}
                total={total}
                onMoveTo={onMoveTo}
                onClose={() => onClose(pane.id)}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                isDragOver={isDragOver}
            />
            <div ref={mountRef} className="min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950" />
        </aside>
    );
}

function MainCell({
    children, slotKey, slotIndex, total, onMoveTo,
    onDragStart, onDragOver, onDrop, onDragEnd, isDragOver,
}) {
    const { pathname } = useLocation();
    const title = getPageTitle(pathname);

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
            <WindowChrome
                title={title}
                slotKey={slotKey}
                slotIndex={slotIndex}
                total={total}
                onMoveTo={onMoveTo}
                isMain
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                isDragOver={isDragOver}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}

function EmptySlot({ onAdd, disabled }) {
    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 dark:border-slate-600 dark:bg-slate-900/40">
            <button
                type="button"
                disabled={disabled}
                onClick={onAdd}
                className="group flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy text-white shadow-lg shadow-brand-navy/25 transition hover:scale-105 hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-brand-navy"
                title="Ajouter la 4ᵉ fenêtre"
                aria-label="Ajouter la 4ᵉ fenêtre"
            >
                <Plus className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">4ᵉ fenêtre</p>
            <p className="text-[10px] text-slate-400">Cliquer sur +</p>
        </div>
    );
}

/** Poignée de redimensionnement locale (colonne ou ligne) */
function ResizeHandle({ orientation, onRatio }) {
    const dragging = useRef(false);
    const hostRef = useRef(null);

    useEffect(() => {
        const onMove = (event) => {
            if (!dragging.current || !hostRef.current) return;
            const parent = hostRef.current.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            if (orientation === 'vertical') {
                if (rect.width <= 0) return;
                onRatio((event.clientX - rect.left) / rect.width);
            } else {
                if (rect.height <= 0) return;
                onRatio((event.clientY - rect.top) / rect.height);
            }
        };
        const onUp = () => {
            dragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [orientation, onRatio]);

    return (
        <div
            ref={hostRef}
            role="separator"
            aria-orientation={orientation}
            title="Élargir / réduire cette zone"
            className={
                orientation === 'vertical'
                    ? 'z-20 w-1.5 shrink-0 cursor-col-resize self-stretch rounded-full bg-slate-300/90 hover:bg-brand-orange dark:bg-slate-600 dark:hover:bg-brand-orange'
                    : 'z-20 h-1.5 w-full shrink-0 cursor-row-resize rounded-full bg-slate-300/90 hover:bg-brand-orange dark:bg-slate-600 dark:hover:bg-brand-orange'
            }
            onMouseDown={(e) => {
                e.preventDefault();
                dragging.current = true;
                document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
                document.body.style.userSelect = 'none';
            }}
        />
    );
}

export default function WorkspaceGrid({ children }) {
    const {
        panes, slotOrder, closePane, colSizes, leftRowSizes, rightRowSizes,
        setColRatio, setLeftRowRatio, setRightRowRatio,
        windowCount, swapSlots, moveSlotToIndex, canAddPane, requestAddPane,
    } = useWorkspace();
    const total = windowCount;
    const [dragKey, setDragKey] = useState(null);
    const [overKey, setOverKey] = useState(null);

    const onDragStart = (e, key) => {
        setDragKey(key);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', key);
    };
    const onDragOver = (e, key) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (key !== overKey) setOverKey(key);
    };
    const onDrop = (e, key) => {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain') || dragKey;
        if (from && key && from !== key) swapSlots(from, key);
        setDragKey(null);
        setOverKey(null);
    };
    const onDragEnd = () => {
        setDragKey(null);
        setOverKey(null);
    };

    const renderSlot = (key, index) => {
        if (String(key).startsWith('empty-')) {
            return (
                <EmptySlot
                    key={key}
                    disabled={!canAddPane}
                    onAdd={() => requestAddPane()}
                />
            );
        }

        const dragProps = {
            slotKey: key,
            slotIndex: index,
            total,
            onMoveTo: moveSlotToIndex,
            onDragStart,
            onDragOver,
            onDrop,
            onDragEnd,
            isDragOver: overKey === key && dragKey !== key,
        };

        if (key === MAIN_SLOT) {
            return (
                <MainCell key={`slot-${key}`} {...dragProps}>
                    {children}
                </MainCell>
            );
        }
        const pane = panes.find((p) => p.id === key);
        if (!pane) {
            return (
                <EmptySlot
                    key={`missing-${key}`}
                    disabled={!canAddPane}
                    onAdd={() => requestAddPane()}
                />
            );
        }
        return (
            <ExtraPane
                key={`${pane.id}:${pane.path}`}
                pane={pane}
                onClose={closePane}
                {...dragProps}
            />
        );
    };

    if (total <= 1) {
        return (
            <div id="workspace-split" className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {children}
            </div>
        );
    }

    const order = slotOrder.length ? slotOrder : [MAIN_SLOT, ...panes.map((p) => p.id)];

    if (total === 2) {
        return (
            <div
                id="workspace-split"
                className="flex h-full min-h-0 min-w-0 flex-1 gap-0 overflow-hidden p-1"
            >
                <div className="min-h-0 min-w-0" style={{ flex: `${colSizes[0]} 1 0%` }}>
                    {renderSlot(order[0], 0)}
                </div>
                <ResizeHandle orientation="vertical" onRatio={setColRatio} />
                <div className="min-h-0 min-w-0" style={{ flex: `${colSizes[1]} 1 0%` }}>
                    {renderSlot(order[1], 1)}
                </div>
            </div>
        );
    }

    const slots = [...order];
    while (slots.length < 4) slots.push(`empty-${slots.length}`);

    // Indices grille : 0 TL, 1 TR, 2 BL, 3 BR
    // Colonnes indépendantes : hauteur gauche ≠ hauteur droite
    return (
        <div
            id="workspace-split"
            className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden p-1"
        >
            {/* Colonne gauche */}
            <div
                className="flex min-h-0 min-w-0 flex-col"
                style={{ flex: `${colSizes[0]} 1 0%` }}
            >
                <div className="min-h-0 min-w-0" style={{ flex: `${leftRowSizes[0]} 1 0%` }}>
                    {renderSlot(slots[0], 0)}
                </div>
                <ResizeHandle orientation="horizontal" onRatio={setLeftRowRatio} />
                <div className="min-h-0 min-w-0" style={{ flex: `${leftRowSizes[1]} 1 0%` }}>
                    {renderSlot(slots[2], 2)}
                </div>
            </div>

            <ResizeHandle orientation="vertical" onRatio={setColRatio} />

            {/* Colonne droite */}
            <div
                className="flex min-h-0 min-w-0 flex-col"
                style={{ flex: `${colSizes[1]} 1 0%` }}
            >
                <div className="min-h-0 min-w-0" style={{ flex: `${rightRowSizes[0]} 1 0%` }}>
                    {renderSlot(slots[1], 1)}
                </div>
                <ResizeHandle orientation="horizontal" onRatio={setRightRowRatio} />
                <div className="min-h-0 min-w-0" style={{ flex: `${rightRowSizes[1]} 1 0%` }}>
                    {renderSlot(slots[3], 3)}
                </div>
            </div>
        </div>
    );
}
