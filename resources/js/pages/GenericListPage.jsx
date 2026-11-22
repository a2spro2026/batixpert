import { useEffect, useState } from 'react';
import api from '../lib/api';
import PageShell from '../components/layout/PageShell';

export default function GenericListPage({ title, subtitle, endpoint, columns }) {
    const [data, setData] = useState({ data: [] });
    const [loading, setLoading] = useState(!!endpoint);

    useEffect(() => {
        if (!endpoint) {
            setLoading(false);
            return;
        }
        api.get(endpoint)
            .then((r) => setData(r.data))
            .catch(() => setData({ data: [] }))
            .finally(() => setLoading(false));
    }, [endpoint]);

    return (
        <PageShell
            toolbar={(
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
                    {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>}
                </div>
            )}
            bodyClassName="flex flex-col"
        >
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="glass-card overflow-hidden shadow-card flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95 text-xs font-bold uppercase text-slate-500">
                                <tr>{columns?.map((c) => <th key={c.key} className="px-5 py-3 text-left bg-slate-50 dark:bg-slate-800">{c.label}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data.data?.length ? data.data.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        {columns.map((c) => (
                                            <td key={c.key} className="px-5 py-3">{c.render ? c.render(row) : row[c.key]}</td>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr><td colSpan={columns?.length || 1} className="px-5 py-12 text-center text-slate-500">Aucune donnée pour le moment.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
