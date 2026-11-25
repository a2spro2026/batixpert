import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import api from '../lib/api';
import { formatMontant } from './devis/devisUtils';
import { usePageVisibility, PageVisibilityHeader } from '../components/PageVisibility';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function RapportsPage() {
    const [data, setData] = useState(null);
    const visibility = usePageVisibility({ actions: true, kpi: false, filters: false });

    useEffect(() => {
        api.get('/reports/financial').then((r) => setData(r.data));
    }, []);

    const chartData = {
        labels: data?.chantiers?.map((c) => c.name) || [],
        datasets: [
            { label: 'Recettes', data: data?.chantiers?.map((c) => c.recettes) || [], backgroundColor: '#1E3A8A' },
            { label: 'Dépenses', data: data?.chantiers?.map((c) => c.depenses) || [], backgroundColor: '#F97316' },
            { label: 'Bénéfice', data: data?.chantiers?.map((c) => c.benefice) || [], backgroundColor: '#10B981' },
        ],
    };

    return (
        <div className="space-y-6">
            <PageVisibilityHeader
                title="Rapports & Statistiques"
                subtitle="Rentabilité et analyses financières"
                visibility={visibility}
            />

            {visibility.showActions && (
                <div className="flex flex-wrap items-center gap-2">
                    <a href="/api/reports/export/chantiers?format=csv" className="btn-secondary text-sm">Export CSV</a>
                </div>
            )}

            <div className="glass-card p-5 h-80 shadow-card">
                <h3 className="font-semibold mb-4">Rentabilité par chantier</h3>
                <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>

            <div className="glass-card min-w-0 max-w-full overflow-hidden shadow-card">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold uppercase text-slate-500">
                        <tr>
                            <th className="px-5 py-3 text-left">Chantier</th>
                            <th className="px-5 py-3 text-right">Budget</th>
                            <th className="px-5 py-3 text-right">Recettes</th>
                            <th className="px-5 py-3 text-right">Dépenses</th>
                            <th className="px-5 py-3 text-right">Bénéfice</th>
                            <th className="px-5 py-3 text-right">Rentabilité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data?.chantiers?.map((c) => (
                            <tr key={c.id}>
                                <td className="px-5 py-3 font-medium">{c.name}</td>
                                <td className="px-5 py-3 text-right">{formatMontant(c.budget)}</td>
                                <td className="px-5 py-3 text-right text-emerald-600">{formatMontant(c.recettes)}</td>
                                <td className="px-5 py-3 text-right text-red-500">{formatMontant(c.depenses)}</td>
                                <td className="px-5 py-3 text-right font-semibold">{formatMontant(c.benefice)}</td>
                                <td className="px-5 py-3 text-right"><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">{c.rentabilite}%</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
