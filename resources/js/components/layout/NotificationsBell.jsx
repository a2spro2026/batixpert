import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

function formatWhen(item) {
    if (item.etat === 'aujourd_hui') return 'Aujourd\'hui';
    if (item.etat === 'en_retard') return `En retard · ${item.date_rappel}`;
    return item.date_rappel || '';
}

export default function NotificationsBell() {
    const navigate = useNavigate();
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);

    const load = () => {
        api.get('/client-relances/notifications')
            .then((res) => setItems(res.data.data ?? []))
            .catch(() => setItems([]));
    };

    useEffect(() => {
        load();
        const timer = setInterval(load, 60000);
        const onFocus = () => load();
        const onChange = () => load();
        window.addEventListener('focus', onFocus);
        window.addEventListener('relances-changed', onChange);
        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('relances-changed', onChange);
        };
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const onPointer = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        return () => document.removeEventListener('mousedown', onPointer);
    }, [open]);

    const count = items.length;

    return (
        <div className="relative" ref={rootRef}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={count ? `${count} rappel${count > 1 ? 's' : ''} client` : 'Notifications'}
            >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {count > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 normal-case">Rappels clients</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {items.length ? items.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => { setOpen(false); navigate('/clients/relance'); }}
                                className="w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <span className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 normal-case truncate">{item.client_name}</span>
                                    <span className={`shrink-0 text-[10px] font-bold uppercase ${item.etat === 'en_retard' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-300'}`}>
                                        {formatWhen(item)}
                                    </span>
                                </span>
                                <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-300 normal-case">
                                    {[item.motif_label, item.date_rappel ? `Rappel le ${item.date_rappel}` : null].filter(Boolean).join(' · ') || 'Date de rappel atteinte'}
                                </span>
                            </button>
                        )) : (
                            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300 normal-case">Aucun rappel à faire aujourd&apos;hui.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
