import { useState } from 'react';
import { Eye, EyeOff, LayoutGrid, MousePointerClick, Search } from 'lucide-react';

const toggleBtnClass = (active) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide ${
        active
            ? 'bg-brand-navy text-white border-brand-navy'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    }`;

/**
 * Visibility state for page chrome (actions / KPI / filters).
 * Defaults to hidden until the user reveals them.
 */
export function usePageVisibility({
    actions = true,
    kpi = true,
    filters = true,
} = {}) {
    const [showActions, setShowActions] = useState(false);
    const [showKpi, setShowKpi] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    return {
        hasActions: actions,
        hasKpi: kpi,
        hasFilters: filters,
        showActions: actions ? showActions : true,
        showKpi: kpi ? showKpi : true,
        showFilters: filters ? showFilters : true,
        setShowActions,
        setShowKpi,
        setShowFilters,
        toggleActions: () => setShowActions((v) => !v),
        toggleKpi: () => setShowKpi((v) => !v),
        toggleFilters: () => setShowFilters((v) => !v),
    };
}

/**
 * Eye toggles for actions / KPI / filters. Place next to the page title.
 */
export function PageVisibilityToggles({
    hasActions = true,
    hasKpi = true,
    hasFilters = true,
    showActions,
    showKpi,
    showFilters,
    onToggleActions,
    onToggleKpi,
    onToggleFilters,
    className = '',
}) {
    if (!hasActions && !hasKpi && !hasFilters) return null;

    return (
        <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
            {hasActions && (
                <button
                    type="button"
                    onClick={onToggleActions}
                    className={toggleBtnClass(showActions)}
                    title={showActions ? 'Masquer les boutons' : 'Afficher les boutons'}
                    aria-label={showActions ? 'Masquer les boutons' : 'Afficher les boutons'}
                >
                    {showActions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <MousePointerClick className="w-3.5 h-3.5" />
                </button>
            )}
            {hasKpi && (
                <button
                    type="button"
                    onClick={onToggleKpi}
                    className={toggleBtnClass(showKpi)}
                    title={showKpi ? 'Masquer les KPI' : 'Afficher les KPI'}
                    aria-label={showKpi ? 'Masquer les KPI' : 'Afficher les KPI'}
                >
                    {showKpi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <LayoutGrid className="w-3.5 h-3.5" />
                </button>
            )}
            {hasFilters && (
                <button
                    type="button"
                    onClick={onToggleFilters}
                    className={toggleBtnClass(showFilters)}
                    title={showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                    aria-label={showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                >
                    {showFilters ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <Search className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

/**
 * Title row + visibility toggles. Pass the object returned by usePageVisibility.
 */
export function PageVisibilityHeader({
    title,
    subtitle,
    visibility,
    children,
    className = '',
}) {
    const v = visibility || {};
    return (
        <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
            <div className="min-w-0 flex-1">
                {typeof title === 'string' ? (
                    <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
                ) : (
                    title
                )}
                {subtitle ? (
                    typeof subtitle === 'string' ? (
                        <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                    ) : (
                        subtitle
                    )
                ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {children}
                <PageVisibilityToggles
                    hasActions={!!v.hasActions}
                    hasKpi={!!v.hasKpi}
                    hasFilters={!!v.hasFilters}
                    showActions={v.showActions}
                    showKpi={v.showKpi}
                    showFilters={v.showFilters}
                    onToggleActions={v.toggleActions}
                    onToggleKpi={v.toggleKpi}
                    onToggleFilters={v.toggleFilters}
                />
            </div>
        </div>
    );
}
