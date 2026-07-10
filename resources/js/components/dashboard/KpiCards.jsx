import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    HardHat, Package, Warehouse, Receipt, Vault, TrendingUp, TrendingDown,
} from 'lucide-react';
import api from '../../lib/api';

const cards = [
    {
        key: 'nombre_chantiers',
        label: 'Nombre de Chantiers',
        icon: HardHat,
        format: 'number',
        gradient: 'from-blue-700 via-brand-navy to-slate-900',
        glow: 'rgba(30, 58, 95, 0.4)',
    },
    {
        key: 'valeur_stock_chantiers',
        label: 'Valeur Stock sur Chantiers',
        icon: Package,
        format: 'currency',
        gradient: 'from-amber-500 via-orange-500 to-orange-700',
        glow: 'rgba(249, 115, 22, 0.4)',
    },
    {
        key: 'valeur_stock_depot',
        label: 'Valeur Stock Dépôt',
        icon: Warehouse,
        format: 'currency',
        gradient: 'from-emerald-500 via-teal-600 to-green-800',
        glow: 'rgba(16, 185, 129, 0.4)',
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
        key: 'tresorerie',
        label: 'Trésorerie',
        icon: Vault,
        format: 'currency',
        gradient: 'from-violet-500 via-purple-600 to-indigo-900',
        glow: 'rgba(139, 92, 246, 0.4)',
        dynamic: true,
    },
];

function formatValue(value, format) {
    const num = Number(value) || 0;
    if (format === 'number') return num.toLocaleString('fr-FR');
    return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

function KpiCard({ card, value, index }) {
    const Icon = card.icon;
    const isTresorerie = card.key === 'tresorerie';
    const num = Number(value) || 0;
    const positive = num >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4 }}
            whileHover={{ y: -3, scale: 1.02 }}
            className={`kpi-card-compact group relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} shadow-md hover:shadow-lg transition-all duration-300`}
            style={{ '--kpi-glow': card.glow }}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />

            <div className="relative p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                        <Icon className="w-4 h-4 text-white" strokeWidth={2} />
                    </div>
                    {isTresorerie && (
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            positive ? 'bg-white/25 text-white' : 'bg-black/25 text-red-200'
                        }`}>
                            {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        </span>
                    )}
                </div>

                <p className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight mb-1 line-clamp-2 min-h-[2rem]">
                    {card.label}
                </p>

                <p className="text-lg font-bold text-white tracking-tight leading-none">
                    <AnimatedValue value={value} format={card.format} />
                </p>
            </div>
        </motion.div>
    );
}

function SectionTitle() {
    return (
        <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xs font-bold tracking-[0.25em] text-slate-600 dark:text-slate-300 uppercase whitespace-nowrap">
                Cartes Analytiques
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-brand-orange/60 via-brand-navy/30 to-transparent" />
        </div>
    );
}

export default function KpiCards({ kpis, loading }) {
    if (loading) {
        return (
            <div>
                <SectionTitle />
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    {cards.map((card) => (
                        <div key={card.key} className="kpi-card-skeleton rounded-xl h-[88px]" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <SectionTitle />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {cards.map((card, i) => (
                    <KpiCard key={card.key} card={card} value={kpis?.[card.key]} index={i} />
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
