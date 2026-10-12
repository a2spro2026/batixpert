const actionColors = {
    blue: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30',
    amber: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
    red: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/30',
    slate: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800',
    orange: 'text-orange-600 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/30',
    emerald: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30',
};

export function MobileCardList({ loading, empty, children, skeletonCount = 4 }) {
    if (loading) {
        return (
            <div className="space-y-2.5 p-3">
                {[...Array(skeletonCount)].map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
            </div>
        );
    }

    if (!children || (Array.isArray(children) && children.length === 0)) {
        return <p className="px-4 py-10 text-center text-sm text-slate-400">{empty}</p>;
    }

    return <div className="space-y-2.5 p-3">{children}</div>;
}

/**
 * Card used instead of a table row on small screens.
 * `fields` items: { label, value, className?, full? } — `full` spans both columns.
 */
export default function MobileRecordCard({
    title,
    subtitle,
    badge,
    fields = [],
    actions = [],
    footer,
    onOpen,
    className = '',
}) {
    return (
        <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden ${className}`}>
            <button
                type="button"
                onClick={onOpen}
                disabled={!onOpen}
                className="w-full text-left px-3.5 pt-3 pb-2.5 active:bg-slate-50 dark:active:bg-slate-800/60 disabled:active:bg-transparent"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="font-mono text-[13px] font-bold text-brand-navy dark:text-orange-400 truncate">{title}</p>
                        {subtitle && (
                            <p className="mt-0.5 text-[13px] font-semibold text-slate-800 dark:text-white truncate">{subtitle}</p>
                        )}
                    </div>
                    {badge && <div className="shrink-0">{badge}</div>}
                </div>

                {fields.length > 0 && (
                    <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                        {fields.map((f) => (
                            <div key={f.label} className={`min-w-0 ${f.full ? 'col-span-2' : ''}`}>
                                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</dt>
                                <dd className={`text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate tabular-nums ${f.className || ''}`}>
                                    {f.value ?? '—'}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </button>

            {footer && <div className="px-3.5 pb-2.5">{footer}</div>}

            {actions.length > 0 && (
                <div className="flex border-t border-slate-100 dark:border-slate-800 divide-x divide-slate-100 dark:divide-slate-800">
                    {actions.map(({ label, icon: Icon, color = 'slate', onClick }) => (
                        <button
                            key={label}
                            type="button"
                            onClick={onClick}
                            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 active:bg-slate-50 dark:active:bg-slate-800"
                        >
                            <span className={`p-1.5 rounded-lg ${actionColors[color]}`}>
                                <Icon className="w-4 h-4" strokeWidth={2} />
                            </span>
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
