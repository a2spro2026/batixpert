import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../lib/api';
import { MobileCardList } from '../../components/MobileRecordCard';

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mbLower(value) {
    return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function statutKey(statut) {
    const s = mbLower(statut);
    if (s === 'paye' || s === 'solde') return 'paye';
    if (s === 'imp' || s === 'impaye') return 'imp';
    if (s === 'devalide' || s === 'deva') return 'deva';
    if (s === 'repo' || s === 'reporte') return 'repo';
    return 'inst';
}

function statutBadgeClass(statut) {
    const key = statutKey(statut);
    if (key === 'paye') return 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700';
    if (key === 'imp') return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700';
    if (key === 'deva') return 'bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700';
    if (key === 'repo') return 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700';
    return 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700';
}

function cardFrameClass(statut) {
    const key = statutKey(statut);
    if (key === 'paye') {
        return 'rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 border-l-[4px] !border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/30';
    }
    if (key === 'imp') {
        return 'rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 border-l-[4px] !border-l-red-500 bg-gradient-to-br from-white to-red-50/50 dark:from-slate-900 dark:to-red-950/30';
    }
    if (key === 'deva') {
        return 'rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 border-l-[4px] !border-l-violet-500 bg-gradient-to-br from-white to-violet-50/50 dark:from-slate-900 dark:to-violet-950/30';
    }
    if (key === 'repo') {
        return 'rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 border-l-[4px] !border-l-amber-500 bg-gradient-to-br from-white to-amber-50/40 dark:from-slate-900 dark:to-amber-950/20';
    }
    return 'rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 border-l-[4px] !border-l-amber-400 bg-gradient-to-br from-white to-amber-50/40 dark:from-slate-900 dark:to-amber-950/20';
}

function Field({ label, value, valueClass = '' }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
            <p className={`text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate tabular-nums ${valueClass}`}>{value || '—'}</p>
        </div>
    );
}

function PaymentMobileCard({ row }) {
    return (
        <div className={`overflow-hidden ${cardFrameClass(row.statut)}`}>
            <div className="px-3.5 py-3 space-y-2.5">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">RC</p>
                        <p className="font-mono text-[13px] font-bold text-brand-navy dark:text-orange-400 truncate">{row.reference}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statutBadgeClass(row.statut)}`}>
                            {row.statut || 'Inst'}
                        </span>
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{row.payment_date || '—'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <Field label="Type" value={row.reglement} />
                    <Field label="N°" value={row.numero} />
                    <Field label="Banq" value={row.banque} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Field label="Nom tiré" value={row.nom_tire} />
                    <Field label="Date échéance" value={row.date_decaissement} />
                </div>

                <div className="grid grid-cols-2 gap-2 items-end pt-0.5 border-t border-slate-100/80 dark:border-slate-800">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Montant</p>
                        <p className="text-base font-bold underline decoration-2 underline-offset-2 text-slate-900 dark:text-white tabular-nums">
                            {formatMontant(row.montant)}
                        </p>
                    </div>
                    <Field label="Trésorerie" value={row.tresorerie} valueClass="font-semibold" />
                </div>
            </div>
        </div>
    );
}

export default function PortalPaymentsPage() {
    const { setRefreshHandler, setRefreshing } = useOutletContext() || {};
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ count: 0, soldes: 0, non_soldes: 0, total_montant: 0 });
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        setRefreshing?.(true);
        const params = {};
        if (filter) params.solde = filter;
        api.get('/portal/payments', { params })
            .then((r) => {
                setRows(r.data.data ?? []);
                setMeta(r.data.meta ?? { count: 0, soldes: 0, non_soldes: 0, total_montant: 0 });
            })
            .catch(() => setRows([]))
            .finally(() => {
                setLoading(false);
                setRefreshing?.(false);
            });
    }, [filter, setRefreshing]);

    useEffect(() => {
        setRefreshHandler?.(load);
        return () => setRefreshHandler?.(null);
    }, [load, setRefreshHandler]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="shrink-0 space-y-2.5 pb-2.5">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mes règlements</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Soldés et non soldés — consultation uniquement</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button type="button" onClick={() => setFilter('')} className={`rounded-xl p-2 sm:p-3 text-left min-w-0 ${!filter ? 'bg-brand-navy text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}>
                        <p className={`text-[9px] sm:text-[10px] uppercase truncate ${!filter ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>Tous</p>
                        <p className="text-base sm:text-xl font-bold tabular-nums text-slate-900 dark:text-white truncate">{meta.soldes + meta.non_soldes}</p>
                    </button>
                    <button type="button" onClick={() => setFilter('soldes')} className={`rounded-xl p-2 sm:p-3 text-left min-w-0 ${filter === 'soldes' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}>
                        <p className={`text-[9px] sm:text-[10px] uppercase truncate ${filter === 'soldes' ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>Soldés</p>
                        <p className={`text-base sm:text-xl font-bold tabular-nums truncate ${filter === 'soldes' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{meta.soldes}</p>
                    </button>
                    <button type="button" onClick={() => setFilter('non_soldes')} className={`rounded-xl p-2 sm:p-3 text-left min-w-0 ${filter === 'non_soldes' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}>
                        <p className={`text-[9px] sm:text-[10px] uppercase truncate ${filter === 'non_soldes' ? 'text-amber-100' : 'text-slate-400 dark:text-slate-500'}`}>Non soldés</p>
                        <p className={`text-base sm:text-xl font-bold tabular-nums truncate ${filter === 'non_soldes' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{meta.non_soldes}</p>
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 glass-card overflow-hidden border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/60 flex flex-col">
                <div className="md:hidden flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
                    <MobileCardList loading={loading} empty="Aucun règlement">
                        {rows.map((row) => (
                            <PaymentMobileCard key={row.id} row={row} />
                        ))}
                    </MobileCardList>
                </div>

                <div className="hidden md:block flex-1 min-h-0 overflow-auto overscroll-contain">
                    <table className="w-full text-sm min-w-[820px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {['Réf', 'Date saisie', 'Type', 'N°', 'Banq', 'Nom tiré', 'Date échéance', 'Montant', 'Trésorerie', 'Statut'].map((h) => (
                                    <th key={h} className="px-3 py-3 text-[11px] font-bold uppercase text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i}><td colSpan={10} className="px-3 py-3"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td></tr>
                                ))
                            ) : rows.length ? rows.map((row) => (
                                <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                                    <td className="px-3 py-2.5 text-center font-mono font-bold text-brand-navy dark:text-orange-400">{row.reference}</td>
                                    <td className="px-3 py-2.5 text-center">{row.payment_date || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">{row.reglement || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">{row.numero || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">{row.banque || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">{row.nom_tire || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">{row.date_decaissement || '—'}</td>
                                    <td className="px-3 py-2.5 text-center tabular-nums font-bold underline decoration-2 underline-offset-2">{formatMontant(row.montant)}</td>
                                    <td className="px-3 py-2.5 text-center">{row.tresorerie || '—'}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statutBadgeClass(row.statut)}`}>
                                            {row.statut || '—'}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={10} className="px-3 py-12 text-center text-slate-400 dark:text-slate-500">Aucun règlement</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
