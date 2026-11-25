import { useEffect, useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Columns2, X } from 'lucide-react';
import { AuthContext, useAuth } from '../../contexts/AuthContext';
import { ThemeContext, useTheme } from '../../contexts/ThemeContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getPageTitle } from '../../lib/pageMeta';
import { SidePageRoutes } from '../../routes/sidePageRoutes';

function SidePanelApp({ path, auth, theme }) {
    return (
        <ThemeContext.Provider value={theme}>
            <AuthContext.Provider value={auth}>
                <MemoryRouter initialEntries={[path]}>
                    <SidePageRoutes />
                </MemoryRouter>
            </AuthContext.Provider>
        </ThemeContext.Provider>
    );
}

export default function SideWorkspace() {
    const { sidePath, sideOpen, ratio, closeSide, setSplitRatio } = useWorkspace();
    const auth = useAuth();
    const theme = useTheme();
    const mountRef = useRef(null);
    const rootRef = useRef(null);
    const dragging = useRef(false);

    useEffect(() => {
        const onMove = (event) => {
            if (!dragging.current) return;
            const root = document.getElementById('workspace-split');
            if (!root) return;
            const rect = root.getBoundingClientRect();
            if (rect.width <= 0) return;
            const next = (event.clientX - rect.left) / rect.width;
            setSplitRatio(1 - next);
        };
        const onUp = () => {
            dragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [setSplitRatio]);

    useLayoutEffect(() => {
        if (!mountRef.current) return undefined;

        if (!sideOpen || !sidePath) {
            if (rootRef.current) {
                rootRef.current.unmount();
                rootRef.current = null;
            }
            return undefined;
        }

        if (!rootRef.current) {
            rootRef.current = createRoot(mountRef.current);
        }

        rootRef.current.render(
            <SidePanelApp key={sidePath} path={sidePath} auth={auth} theme={theme} />,
        );

        return undefined;
    }, [sideOpen, sidePath, auth, theme]);

    useEffect(() => () => {
        queueMicrotask(() => {
            rootRef.current?.unmount();
            rootRef.current = null;
        });
    }, []);

    const pathname = sidePath ? sidePath.split('?')[0] : '';
    const title = pathname ? getPageTitle(pathname) : '';

    return (
        <>
            <div
                role="separator"
                aria-orientation="vertical"
                title="Redimensionner"
                className={`relative z-10 w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-brand-orange/50 dark:bg-slate-700 dark:hover:bg-brand-orange/40 ${
                    sideOpen ? 'hidden lg:block' : 'hidden'
                }`}
                onMouseDown={() => {
                    dragging.current = true;
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                }}
            />
            <aside
                className={`min-h-0 min-w-0 flex-col overflow-hidden border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 ${
                    sideOpen
                        ? 'flex w-full flex-1 border-t lg:w-auto lg:flex-none lg:border-t-0 lg:border-l'
                        : 'hidden'
                }`}
                style={sideOpen ? { ['--side-w']: `${Math.round(ratio * 100)}%` } : undefined}
                aria-hidden={!sideOpen}
            >
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <Columns2 className="h-4 w-4 text-brand-navy dark:text-brand-orange" />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
                    <button
                        type="button"
                        onClick={closeSide}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                        aria-label="Fermer le panneau"
                        title="Fermer le panneau"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div ref={mountRef} className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto p-2 sm:p-3" />
            </aside>
        </>
    );
}
