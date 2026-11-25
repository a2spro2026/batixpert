import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import KpiCards from './KpiCards';
import DashboardTables from './DashboardTables';
import ActivityChart from './ActivityChart';
import { useDashboard } from '../../hooks/useDashboard';

export default function DashboardSection() {
    const { data, loading } = useDashboard();
    const [panelsVisible, setPanelsVisible] = useState(false);

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <div className="shrink-0 px-3 sm:px-4 lg:px-6 pt-2.5 sm:pt-3 pb-3 sm:pb-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/95 dark:bg-slate-950/95">
                <KpiCards kpis={data?.kpis} loading={loading} />
            </div>
            <div className="shrink-0 px-4 lg:px-6 pt-4 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {panelsVisible ? 'Activité & opérations' : 'Tableaux et diagramme masqués'}
                </h2>
                <button
                    type="button"
                    onClick={() => setPanelsVisible((v) => !v)}
                    aria-pressed={panelsVisible}
                    title={panelsVisible ? 'Masquer tableaux et diagramme' : 'Afficher le diagramme et les tableaux'}
                    className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide border shadow-sm transition-colors ${
                        panelsVisible
                            ? 'bg-gradient-to-r from-brand-navy to-blue-800 text-white border-transparent hover:from-blue-900 hover:to-blue-700'
                            : 'bg-white dark:bg-slate-900 text-brand-navy dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    {panelsVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {panelsVisible ? 'Masquer' : 'Afficher'}
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain touch-pan-y px-4 lg:px-6 py-4 sm:py-5">
                {panelsVisible ? (
                    <div className="space-y-6 pb-2">
                        <ActivityChart />
                        <DashboardTables tables={data?.tables} loading={loading} />
                    </div>
                ) : (
                    <div className="flex h-full min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/60 px-4 text-center dark:border-slate-700 dark:bg-slate-900/40">
                        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                            Diagramme et tableaux masqués. Cliquez sur Afficher pour les ouvrir.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
