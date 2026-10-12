import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import {
    Chart as ChartJS, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import { BarChart3, ChevronLeft, ChevronRight, ShoppingBag, ShoppingCart, Scale } from 'lucide-react';
import api from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const PERIODS = [
    { id: 'jour', label: 'Jour' },
    { id: 'mois', label: 'Mois' },
    { id: 'annee', label: 'Année' },
];

const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatMontant(value) {
    return (Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(value) {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
    if (abs >= 1_000) return `${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

function niceCeil(value) {
    if (!(value > 0)) return 1;
    const pow = 10 ** Math.floor(Math.log10(value));
    const n = value / pow;
    const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s);
    return step * pow;
}

function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function verticalGradient(context, from, to) {
    const { chart } = context;
    const { ctx, chartArea } = chart;
    if (!chartArea) return from;
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, to);
    gradient.addColorStop(1, from);
    return gradient;
}

function useNarrow(query = '(max-width: 639px)') {
    const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const onChange = () => setNarrow(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [query]);
    return narrow;
}

function TotalChip({ icon: Icon, label, value, tone, className = '' }) {
    const tones = {
        navy: 'from-blue-700 via-brand-navy to-slate-900 shadow-blue-900/30',
        orange: 'from-amber-500 via-orange-500 to-orange-700 shadow-orange-500/30',
        emerald: 'from-emerald-500 via-teal-600 to-green-800 shadow-emerald-500/30',
        red: 'from-rose-500 via-red-600 to-rose-800 shadow-rose-500/30',
    };
    return (
        <div className={`relative overflow-hidden min-w-0 rounded-xl bg-gradient-to-br ${tones[tone]} ${className} shadow-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white`}>
            <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="relative flex items-center gap-2.5">
                <span className="hidden sm:flex p-2 rounded-lg bg-white/20 shrink-0">
                    <Icon className="w-4 h-4" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/80 truncate">{label}</p>
                    <p className="text-sm sm:text-lg font-bold tabular-nums leading-tight truncate">{formatMontant(value)}</p>
                </div>
            </div>
        </div>
    );
}

export default function ActivityChart() {
    const { dark } = useTheme();
    const narrow = useNarrow();
    const [period, setPeriod] = useState('mois');
    const [month, setMonth] = useState(currentMonth);
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        const params = { period };
        if (period === 'jour') params.month = month;
        if (period === 'mois') params.year = year;
        api.get('/dashboard/chart', { params })
            .then((r) => { if (!cancelled) setData(r.data); })
            .catch(() => { if (!cancelled) setError('Impossible de charger le diagramme.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [period, month, year]);

    const periodLabel = useMemo(() => {
        if (period === 'jour') {
            const [y, m] = month.split('-').map(Number);
            return `${MONTHS_LONG[m - 1]} ${y}`;
        }
        if (period === 'mois') return `Année ${year}`;
        return 'Toutes les années';
    }, [period, month, year]);

    const navigate = (delta) => {
        if (period === 'jour') setMonth((m) => shiftMonth(m, delta));
        if (period === 'mois') setYear((y) => y + delta);
    };

    const points = data?.points ?? [];
    const totals = data?.totals ?? { achats: 0, ventes: 0, reliquat: 0 };

    const textColor = dark ? '#cbd5e1' : '#475569';
    const gridColor = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.07)';

    const ranges = useMemo(() => {
        const maxBar = Math.max(0, ...points.flatMap((p) => [Number(p.achats) || 0, Number(p.ventes) || 0]));
        const pos = Math.max(0, ...points.map((p) => Number(p.reliquat) || 0));
        const neg = Math.max(0, ...points.map((p) => -(Number(p.reliquat) || 0)));
        const below = neg > 0 ? 0.3 : 0;
        const yMax = niceCeil(maxBar * 1.05);
        const span = niceCeil(Math.max(pos / (1 - below), below ? neg / below : 0) * 1.05);
        return {
            y: { min: -(below / (1 - below)) * yMax, max: yMax },
            y1: { min: -below * span, max: (1 - below) * span },
        };
    }, [points]);

    const categoryPercentage = points.length <= 6 ? 0.35 : 0.8;

    const chartData = useMemo(() => ({
        labels: points.map((p) => p.label),
        datasets: [
            {
                type: 'bar',
                label: 'Achats',
                data: points.map((p) => p.achats),
                backgroundColor: (ctx) => verticalGradient(ctx, '#2563eb', '#1e3a5f'),
                hoverBackgroundColor: '#1d4ed8',
                borderRadius: narrow ? 3 : 6,
                borderSkipped: false,
                maxBarThickness: narrow ? 16 : 34,
                categoryPercentage,
                barPercentage: 0.9,
                order: 2,
                yAxisID: 'y',
            },
            {
                type: 'bar',
                label: 'Ventes',
                data: points.map((p) => p.ventes),
                backgroundColor: (ctx) => verticalGradient(ctx, '#fbbf24', '#ea580c'),
                hoverBackgroundColor: '#f97316',
                borderRadius: narrow ? 3 : 6,
                borderSkipped: false,
                maxBarThickness: narrow ? 16 : 34,
                categoryPercentage,
                barPercentage: 0.9,
                order: 2,
                yAxisID: 'y',
            },
            {
                type: 'bar',
                label: 'Reliquat',
                data: points.map((p) => p.reliquat),
                backgroundColor: (ctx) => (Number(ctx.raw) < 0
                    ? verticalGradient(ctx, '#fb7185', '#be123c')
                    : verticalGradient(ctx, '#34d399', '#047857')),
                hoverBackgroundColor: (ctx) => (Number(ctx.raw) < 0 ? '#e11d48' : '#059669'),
                borderRadius: narrow ? 3 : 6,
                borderSkipped: false,
                maxBarThickness: narrow ? 16 : 34,
                categoryPercentage,
                barPercentage: 0.9,
                order: 2,
                yAxisID: 'y1',
            },
        ],
    }), [points, categoryPercentage, narrow]);

    const options = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: textColor,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    generateLabels: (chart) => ChartJS.defaults.plugins.legend.labels.generateLabels(chart)
                        .map((l) => (l.datasetIndex === 2 ? { ...l, fillStyle: '#10b981', strokeStyle: '#10b981' } : l)),
                    padding: narrow ? 12 : 18,
                    font: { size: narrow ? 11 : 12, weight: '600' },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(15,23,42,0.95)',
                borderColor: 'rgba(249,115,22,0.5)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                titleFont: { size: 13, weight: '700' },
                bodyFont: { size: 12 },
                bodySpacing: 6,
                usePointStyle: true,
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label} : ${formatMontant(ctx.parsed.y)}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: { color: textColor, font: { size: narrow ? 9 : 11, weight: '600' }, maxRotation: 0, autoSkipPadding: 8 },
            },
            y: {
                min: ranges.y.min,
                max: ranges.y.max,
                grid: {
                    drawTicks: false,
                    color: (ctx) => {
                        const v = ctx.tick?.value ?? 0;
                        if (v === 0) return dark ? 'rgba(148,163,184,0.45)' : 'rgba(15,23,42,0.3)';
                        return v < 0 ? 'transparent' : gridColor;
                    },
                },
                border: { display: false, dash: [4, 4] },
                ticks: { color: textColor, padding: narrow ? 4 : 8, font: { size: narrow ? 9 : 11 }, callback: (v) => (v < 0 ? '' : formatCompact(v)) },
                title: { display: !narrow, text: 'Achats / Ventes', color: textColor, font: { size: 11, weight: '600' } },
            },
            y1: {
                position: 'right',
                min: ranges.y1.min,
                max: ranges.y1.max,
                grid: { display: false },
                border: { display: false },
                ticks: { color: '#10b981', padding: narrow ? 4 : 8, font: { size: narrow ? 9 : 11, weight: '600' }, callback: (v) => formatCompact(v) },
                title: { display: !narrow, text: 'Reliquat', color: '#10b981', font: { size: 11, weight: '600' } },
            },
        },
    }), [textColor, gridColor, ranges, narrow, dark]);

    const hasData = points.some((p) => p.achats || p.ventes || p.reliquat);

    return (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-gradient-to-r from-brand-navy via-blue-800 to-slate-900">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="p-2 rounded-lg bg-white/15 shrink-0">
                        <BarChart3 className="w-4 h-4 text-white" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate">Achats · Ventes · Reliquat</h3>
                        <p className="text-[11px] font-medium text-blue-100/80 truncate">{periodLabel}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {period !== 'annee' && (
                        <div className="flex items-center rounded-lg bg-white/10 border border-white/15">
                            <button type="button" onClick={() => navigate(-1)} className="p-1.5 text-white/80 hover:text-white" aria-label="Période précédente" title="Période précédente">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => navigate(1)} className="p-1.5 text-white/80 hover:text-white" aria-label="Période suivante" title="Période suivante">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <div className="flex rounded-lg bg-white/10 border border-white/15 p-0.5">
                        {PERIODS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPeriod(p.id)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${
                                    period === p.id ? 'bg-white text-brand-navy shadow' : 'text-white/80 hover:text-white'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-3 sm:p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <TotalChip icon={ShoppingCart} label="Achats" value={totals.achats} tone="navy" />
                    <TotalChip icon={ShoppingBag} label="Ventes" value={totals.ventes} tone="orange" />
                    <TotalChip icon={Scale} label="Reliquat" value={totals.reliquat} tone={totals.reliquat < 0 ? 'red' : 'emerald'} className="col-span-2 sm:col-span-1" />
                </div>

                <div className="relative h-[320px] sm:h-[420px]">
                    {error ? (
                        <p className="absolute inset-0 flex items-center justify-center text-sm text-red-500">{error}</p>
                    ) : loading && !data ? (
                        <div className="absolute inset-0 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ) : (
                        <>
                            <Chart type="bar" data={chartData} options={options} />
                            {!hasData && (
                                <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none">
                                    Aucune opération sur cette période
                                </p>
                            )}
                        </>
                    )}
                    {loading && data && (
                        <div className="absolute top-2 right-2 w-4 h-4 border-2 border-slate-300 border-t-brand-orange rounded-full animate-spin" />
                    )}
                </div>
            </div>
        </div>
    );
}
