import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import KpiCards from './KpiCards';
import DashboardTables from './DashboardTables';
import ActivityChart from './ActivityChart';
import { useDashboard } from '../../hooks/useDashboard';

export default function DashboardSection() {
    const { data, loading } = useDashboard();
    const [tablesHidden, setTablesHidden] = useState(false);

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="shrink-0 px-4 lg:px-6 pt-3 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
                <KpiCards kpis={data?.kpis} loading={loading} />
            </div>
            <div className="flex-1 overflow-auto px-4 lg:px-6 py-4 sm:py-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        {tablesHidden ? 'Diagramme d\'activité' : 'Dernières opérations'}
                    </h2>
                    <button
                        type="button"
                        onClick={() => setTablesHidden((v) => !v)}
                        aria-pressed={tablesHidden}
                        title={tablesHidden ? 'Afficher les tableaux' : 'Masquer les tableaux et afficher le diagramme'}
                        className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide border shadow-sm transition-colors ${
                            tablesHidden
                                ? 'bg-white dark:bg-slate-900 text-brand-navy dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                : 'bg-gradient-to-r from-brand-navy to-blue-800 text-white border-transparent hover:from-blue-900 hover:to-blue-700'
                        }`}
                    >
                        {tablesHidden ? <Table2 className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
                        {tablesHidden ? 'Afficher les tableaux' : 'Masquer les tableaux'}
                    </button>
                </div>

                {tablesHidden ? (
                    <ActivityChart />
                ) : (
                    <DashboardTables tables={data?.tables} loading={loading} />
                )}
            </div>
        </div>
    );
}
