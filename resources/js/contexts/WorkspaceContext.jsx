import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const WorkspaceContext = createContext(null);

export const MAX_WINDOWS = 4;
export const MAX_EXTRA_PANES = MAX_WINDOWS - 1;
export const MAIN_SLOT = 'main';

let paneSeq = 0;
function nextPaneId() {
    paneSeq += 1;
    return `pane-${paneSeq}-${Date.now().toString(36)}`;
}

function normalizePath(path) {
    if (!path) return null;
    return path.startsWith('/') ? path : `/${path}`;
}

function clamp(value, min = 0.18, max = 0.82) {
    return Math.max(min, Math.min(max, value));
}

function syncSlotOrder(prev, panes) {
    const paneIds = panes.map((p) => p.id);
    const kept = prev.filter((k) => k === MAIN_SLOT || paneIds.includes(k));
    if (!kept.includes(MAIN_SLOT)) kept.unshift(MAIN_SLOT);
    const missing = paneIds.filter((id) => !kept.includes(id));
    return [...kept, ...missing];
}

function setPairRatio(setter, value) {
    const clamped = clamp(value);
    setter([clamped, 1 - clamped]);
}

export function WorkspaceProvider({ children }) {
    const [panes, setPanes] = useState([]); // [{ id, path }]
    const [slotOrder, setSlotOrder] = useState([MAIN_SLOT]);
    const [pickerOpen, setPickerOpen] = useState(false);
    /** Largeur colonne gauche / droite (partagée) */
    const [colSizes, setColSizes] = useState([0.5, 0.5]);
    /** Hauteur haut / bas — colonne gauche (indépendante) */
    const [leftRowSizes, setLeftRowSizes] = useState([0.5, 0.5]);
    /** Hauteur haut / bas — colonne droite (indépendante) */
    const [rightRowSizes, setRightRowSizes] = useState([0.5, 0.5]);

    useEffect(() => {
        setSlotOrder((prev) => syncSlotOrder(prev, panes));
    }, [panes]);

    const windowCount = 1 + panes.length;
    const canAddPane = panes.length < MAX_EXTRA_PANES;

    const openSide = useCallback((path) => {
        const next = normalizePath(path);
        if (!next || next === '/') return false;

        let added = false;
        setPanes((current) => {
            const base = next.split('?')[0];
            if (current.some((pane) => pane.path.split('?')[0] === base)) {
                return current;
            }
            if (current.length >= MAX_EXTRA_PANES) {
                return current;
            }
            added = true;
            return [...current, { id: nextPaneId(), path: next }];
        });
        return added;
    }, []);

    const requestAddPane = useCallback(() => {
        if (panes.length >= MAX_EXTRA_PANES) return;
        setPickerOpen(true);
    }, [panes.length]);

    const closePicker = useCallback(() => setPickerOpen(false), []);

    const closePane = useCallback((id) => {
        setPanes((current) => current.filter((pane) => pane.id !== id));
    }, []);

    const closeSide = useCallback(() => {
        setPanes([]);
        setSlotOrder([MAIN_SLOT]);
        setColSizes([0.5, 0.5]);
        setLeftRowSizes([0.5, 0.5]);
        setRightRowSizes([0.5, 0.5]);
    }, []);

    const swapSlots = useCallback((fromKey, toKey) => {
        if (!fromKey || !toKey || fromKey === toKey) return;
        setSlotOrder((order) => {
            const a = order.indexOf(fromKey);
            const b = order.indexOf(toKey);
            if (a < 0 || b < 0) return order;
            const next = [...order];
            [next[a], next[b]] = [next[b], next[a]];
            return next;
        });
    }, []);

    const moveSlotToIndex = useCallback((key, targetIndex) => {
        setSlotOrder((order) => {
            const from = order.indexOf(key);
            if (from < 0) return order;
            const next = order.filter((k) => k !== key);
            const idx = Math.max(0, Math.min(targetIndex, next.length));
            next.splice(idx, 0, key);
            return next;
        });
    }, []);

    const setColRatio = useCallback((value) => {
        setPairRatio(setColSizes, value);
    }, []);

    const setLeftRowRatio = useCallback((value) => {
        setPairRatio(setLeftRowSizes, value);
    }, []);

    const setRightRowRatio = useCallback((value) => {
        setPairRatio(setRightRowSizes, value);
    }, []);

    /** Compat ancien API (ratio global) */
    const setRowRatio = useCallback((index, value) => {
        const v = typeof value === 'number' ? value : index;
        setLeftRowRatio(v);
        setRightRowRatio(v);
    }, [setLeftRowRatio, setRightRowRatio]);

    const value = useMemo(
        () => ({
            panes,
            slotOrder,
            paneCount: panes.length,
            sideOpen: panes.length > 0,
            sidePath: panes[0]?.path ?? null,
            windowCount,
            canAddPane,
            pickerOpen,
            colSizes,
            leftRowSizes,
            rightRowSizes,
            rowSizes: leftRowSizes,
            openSide,
            requestAddPane,
            closePicker,
            closePane,
            closeSide,
            swapSlots,
            moveSlotToIndex,
            setColRatio,
            setLeftRowRatio,
            setRightRowRatio,
            setRowRatio,
            ratio: colSizes[1],
            setSplitRatio: (value) => setColRatio(value),
        }),
        [
            panes, slotOrder, windowCount, canAddPane, pickerOpen,
            colSizes, leftRowSizes, rightRowSizes,
            openSide, requestAddPane, closePicker, closePane, closeSide,
            swapSlots, moveSlotToIndex, setColRatio, setLeftRowRatio, setRightRowRatio, setRowRatio,
        ],
    );

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) {
        throw new Error('useWorkspace must be used within WorkspaceProvider');
    }
    return ctx;
}
