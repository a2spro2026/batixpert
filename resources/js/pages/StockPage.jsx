import { useEffect, useState } from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import api from '../lib/api';
import { usePageVisibility, PageVisibilityHeader } from '../components/PageVisibility';

export default function StockPage() {
    const visibility = usePageVisibility({ actions: false, kpi: true, filters: true });
    const [products, setProducts] = useState({ data: [] });
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const params = {};
        if (filter === 'low') params.alert = 'low';
        if (filter === 'out') params.alert = 'out';
        api.get('/products', { params }).then((r) => setProducts(r.data));
    }, [filter]);

    return (
        <div className="space-y-6">
            <PageVisibilityHeader
                title="Gestion du stock"
                subtitle="Produits, mouvements et alertes"
                visibility={visibility}
            />

            {visibility.showFilters && (
                <div className="flex flex-wrap gap-2">
                    {['', 'low', 'out'].map((f) => (
                        <button key={f} type="button" onClick={() => setFilter(f)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition ${filter === f ? 'bg-brand-navy text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                            {f === '' ? 'Tous' : f === 'low' ? 'Stock faible' : 'Rupture'}
                        </button>
                    ))}
                </div>
            )}

            {visibility.showKpi && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-4 flex items-center gap-3">
                        <Package className="w-8 h-8 text-brand-navy" />
                        <div><p className="text-2xl font-bold">{products.data?.length || 0}</p><p className="text-xs text-slate-500">Produits</p></div>
                    </div>
                    <div className="glass-card p-4 flex items-center gap-3 border-amber-200">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                        <div><p className="text-2xl font-bold">{products.data?.filter((p) => p.quantity_in_stock <= p.min_stock_alert).length}</p><p className="text-xs text-slate-500">Alertes stock</p></div>
                    </div>
                </div>
            )}

            <div className="glass-card min-w-0 max-w-full overflow-hidden shadow-card">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold uppercase text-slate-500">
                        <tr>
                            <th className="px-5 py-3 text-left">Référence</th>
                            <th className="px-5 py-3 text-left">Désignation</th>
                            <th className="px-5 py-3 text-left">Marque</th>
                            <th className="px-5 py-3 text-right">Qté dispo</th>
                            <th className="px-5 py-3 text-right">Qté min</th>
                            <th className="px-5 py-3 text-left">Emplacement</th>
                            <th className="px-5 py-3 text-right">Prix achat</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {products.data?.map((p) => (
                            <tr key={p.id} className={p.quantity_in_stock <= p.min_stock_alert ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                                <td className="px-5 py-3 font-mono text-xs">{p.reference}</td>
                                <td className="px-5 py-3 font-medium">{p.name}</td>
                                <td className="px-5 py-3">{p.brand || '—'}</td>
                                <td className="px-5 py-3 text-right">{p.quantity_in_stock} {p.unit}</td>
                                <td className="px-5 py-3 text-right">{p.min_stock_alert}</td>
                                <td className="px-5 py-3">{p.location || '—'}</td>
                                <td className="px-5 py-3 text-right">{p.purchase_price}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
