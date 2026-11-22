import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ShoppingCart, ShoppingBag, Scale, Receipt, Truck, TrendingUp, TrendingDown,
    Eye, EyeOff, LayoutGrid,
} from 'lucide-react';
import api from '../../lib/api';

const cards = [
    {
        key: 'total_achats',
        label: 'Total Achats',
        icon: ShoppingCart,
        format: 'currency',
        gradient: 'from-blue-700 via-brand-navy to-slate-900',
        glow: 'rgba(30, 58, 95, 0.4)',
    },
    {
        key: 'total_ventes',
        label: 'Total Ventes',
        icon: ShoppingBag,
        format: 'currency',
        gradient: 'from-amber-500 via-orange-500 to-orange-700',
        glow: 'rgba(249, 115, 22, 0.4)',
    },
    {
        key: 'reliquat',
        label: 'Reliquat',
        icon: Scale,
        format: 'currency',
        gradient: 'from-emerald-500 via-teal-600 to-green-800',
        glow: 'rgba(16, 185, 129, 0.4)',
        dynamic: true,
    },
    {
        key: 'total_charges',
        label: 'Total Charges',
        icon: Receipt,
        format: 'currency',
        gradient: 'from-rose-500 via-red-500 to-rose-800',
        glow: 'rgba(244, 63, 94, 0.35)',
    },
    {
        key: 'solde_fournisseur',
        label: 'Solde Fournisseur',
        icon: Truck,
        format: 'currency',
        gradient: 'from-violet-500 via-purple-600 to-indigo-900',
        glow: 'rgba(139, 92, 246, 0.4)',
        dynamic: true,
        supplierFilter: true,
    },
];

function formatValue(value, format) {
    const num = Number(value) || 0;
    if (format === 'number') return num.toLocaleString('fr-FR');
    return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AnimatedValue({ value, format }) {
    const [display, setDisplay] = useState(0);
    const target = Number(value) || 0;

    useEffect(() => {
        if (target === 0) {
            setDisplay(0);
            return;
        }
        const duration = 800;
        const start = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(target * eased);
            if (progress < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }, [target]);

    return <>{formatValue(display, format)}</>;
}

function KpiCard({ card, value, index, supplierFilter }) {
    const Icon = card.icon;
    const isDynamic = card.dynamic;
    const num = Number(value) || 0;
    const positive = num >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4 }}
            whileHover={{ y: -2, scale: 1.01 }}
            className={`group relative overflow-hidden rounded-2xl sm:rounded-lg bg-gradient-to-br ${card.gradient} shadow-md hover:shadow-lg transition-all duration-300`}
            style={{ boxShadow: `0 10px 24px -12px ${card.glow}` }}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10 pointer-events-none" />
            <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-white/10 blur-xl pointer-events-none" />

            <div className={`relative flex flex-col p-2.5 sm:p-2.5 ${supplierFilter ? 'min-h-[84px] sm:min-h-[88px]' : 'min-h-[76px] sm:min-h-[82px]'}`}>
                <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="p-1.5 sm:p-1 rounded-lg sm:rounded-md bg-white/20 backdrop-blur-sm">
                        <Icon className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white" strokeWidth={2} />
                    </div>
                    {isDynamic && (
                        <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            positive ? 'bg-white/25 text-white' : 'bg-black/25 text-red-200'
                        }`}>
                            {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        </span>
                    )}
                </div>

                {supplierFilter && (
                    <select
                        value={supplierFilter.value}
                        onChange={(e) => supplierFilter.onChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full mb-1.5 rounded-md border border-white/20 bg-white/10 text-white text-[8px] font-medium px-1.5 py-0.5 h-5 outline-none focus:ring-1 focus:ring-white/30 cursor-pointer truncate leading-none"
                        title="Filtrer par fournisseur"
                    >
                        <option value="" className="text-slate-900">Tous</option>
                        {supplierFilter.options.map((s) => (
                            <option key={s.id} value={String(s.id)} className="text-slate-900">
                                {s.name}
                            </option>
                        ))}
                    </select>
                )}

                <p className="text-[9px] sm:text-[9px] font-semibold text-white/85 uppercase tracking-wide leading-tight line-clamp-2">
                    {card.label}
                </p>

                <p className={`mt-auto font-bold text-white tracking-tight leading-none tabular-nums ${
                    supplierFilter ? 'text-sm pt-1' : 'text-[15px] sm:text-base pt-2'
                }`}>
                    <AnimatedValue value={value} format={card.format} />
                </p>
            </div>
        </motion.div>
    );
}

function SectionTitle({ showToggle, visible, onToggle }) {
    return (
        <div className="flex items-center gap-2 sm:gap-3 mb-2.5 sm:mb-3">
            <h2 className="text-xs font-bold tracking-[0.25em] text-slate-600 dark:text-slate-300 uppercase whitespace-nowrap">
                Cartes Analytiques
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-brand-orange/60 via-brand-navy/30 to-transparent" />
            {showToggle && (
                <button
                    type="button"
                    onClick={onToggle}
                    className={`lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                        visible
                            ? 'bg-brand-navy text-white border-brand-navy'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                    title={visible ? 'Masquer les KPI' : 'Afficher les KPI'}
                    aria-label={visible ? 'Masquer les KPI' : 'Afficher les KPI'}
                >
                    {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <LayoutGrid className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

export default function KpiCards({ kpis, loading }) {
    const [supplierId, setSupplierId] = useState('');
    const [showKpi, setShowKpi] = useState(false);

    const supplierOptions = useMemo(
        () => (Array.isArray(kpis?.soldes_fournisseurs) ? kpis.soldes_fournisseurs : []),
        [kpis?.soldes_fournisseurs],
    );

    const soldeFournisseurValue = useMemo(() => {
        if (!supplierId) {
            return Number(kpis?.solde_fournisseur) || 0;
        }
        const match = supplierOptions.find((s) => String(s.id) === String(supplierId));
        return Number(match?.solde) || 0;
    }, [supplierId, kpis?.solde_fournisseur, supplierOptions]);

    const supplierFilter = {
        value: supplierId,
        onChange: setSupplierId,
        options: supplierOptions,
    };

    if (loading) {
        return (
            <div>
                <SectionTitle showToggle visible={showKpi} onToggle={() => setShowKpi((v) => !v)} />
                <div className={`${showKpi ? 'grid' : 'hidden'} lg:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2`}>
                    {cards.map((card) => (
                        <div
                            key={card.key}
                            className={`rounded-2xl sm:rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse ${
                                card.supplierFilter ? 'h-[84px] sm:h-[92px]' : 'h-[76px] sm:h-[82px]'
                            }`}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <SectionTitle showToggle visible={showKpi} onToggle={() => setShowKpi((v) => !v)} />
            <div className={`${showKpi ? 'grid' : 'hidden'} lg:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2`}>
                {cards.map((card, i) => (
                    <KpiCard
                        key={card.key}
                        card={card}
                        value={card.key === 'solde_fournisseur' ? soldeFournisseurValue : kpis?.[card.key]}
                        index={i}
                        supplierFilter={card.supplierFilter ? supplierFilter : null}
                    />
                ))}
            </div>
        </div>
    );
}

export function useDashboardKpis() {
    const [kpis, setKpis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/dashboard')
            .then((r) => setKpis(r.data.kpis))
            .catch(() => setKpis({}))
            .finally(() => setLoading(false));
    }, []);

    return { kpis, loading };
}
