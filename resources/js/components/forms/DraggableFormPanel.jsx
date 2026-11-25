import { useEffect, useRef, useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';

export default function DraggableFormPanel({ title, onClose, children }) {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const drag = useRef(null);

    useEffect(() => {
        setOffset({ x: 0, y: 0 });
    }, [title]);

    useEffect(() => {
        const onMove = (event) => {
            if (!drag.current) return;
            if (event.cancelable && event.touches) event.preventDefault();
            const point = event.touches?.[0] || event;
            setOffset({
                x: point.clientX - drag.current.startX,
                y: point.clientY - drag.current.startY,
            });
        };
        const onUp = () => {
            drag.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, []);

    const startDrag = (event) => {
        if (event.target.closest('button')) return;
        const point = event.touches?.[0] || event;
        drag.current = {
            startX: point.clientX - offset.x,
            startY: point.clientY - offset.y,
        };
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
            <div
                className="absolute left-1/2 top-[8%] w-[min(98vw,1680px)] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 max-h-[88dvh] overflow-hidden flex flex-col"
                style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
                onClick={(event) => event.stopPropagation()}
            >
                <div
                    className="flex shrink-0 cursor-grab active:cursor-grabbing items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-brand-navy via-blue-800 to-blue-900"
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                    title="Glisser pour déplacer"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <GripHorizontal className="h-4 w-4 shrink-0 text-white/70" />
                        <h3 className="truncate text-sm font-bold uppercase tracking-wide text-white">{title}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                        aria-label="Fermer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
            </div>
        </div>
    );
}

export function FicheField({ label, children, className = '' }) {
    return (
        <div className={className}>
            <label className="field-label !overflow-visible !text-clip">{label}</label>
            {children}
        </div>
    );
}

export const ficheBarClass =
    'w-full !h-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 !text-sm text-center outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy transition-all';

export const ficheBarReadOnlyClass =
    'w-full !h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 !text-sm text-center cursor-not-allowed';
