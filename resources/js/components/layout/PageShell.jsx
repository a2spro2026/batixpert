/**
 * Locked page shell: toolbar/KPI stay fixed, only the body scrolls.
 * Use as root of every admin page under Layout.
 */
export default function PageShell({ toolbar, children, className = '', bodyClassName = '' }) {
    return (
        <div className={`flex flex-col flex-1 min-h-0 h-full overflow-hidden gap-3 ${className}`}>
            {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
            <div className={`flex-1 min-h-0 overflow-auto overscroll-contain touch-pan-y ${bodyClassName}`}>
                {children}
            </div>
        </div>
    );
}
