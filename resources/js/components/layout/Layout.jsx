import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import GhitaPanel from './GhitaPanel';
import WorkspaceGrid from './WorkspaceGrid';
import WindowPagePicker from './WindowPagePicker';
import DashboardSection from '../dashboard/DashboardSection';
import { useWorkspace } from '../../contexts/WorkspaceContext';

const GHITA_OPEN_KEY = 'ghita-open';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [ghitaOpen, setGhitaOpen] = useState(() => localStorage.getItem(GHITA_OPEN_KEY) === '1');
    const { pathname } = useLocation();
    const { pickerOpen, closePicker } = useWorkspace();
    const isDashboard = pathname === '/';
    const isDevisForm = /^\/clients\/devis\/(nouveau|\d+)/.test(pathname);

    useEffect(() => {
        localStorage.setItem(GHITA_OPEN_KEY, ghitaOpen ? '1' : '0');
    }, [ghitaOpen]);

    useEffect(() => {
        if (!sidebarOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [sidebarOpen]);

    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const root = document.getElementById('root');
        const prev = {
            htmlOverflow: html.style.overflow,
            bodyOverflow: body.style.overflow,
            htmlHeight: html.style.height,
            bodyHeight: body.style.height,
            htmlOverscroll: html.style.overscrollBehavior,
            bodyOverscroll: body.style.overscrollBehavior,
            rootHeight: root?.style.height || '',
            rootOverflow: root?.style.overflow || '',
        };

        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        html.style.height = '100%';
        body.style.height = '100%';
        html.style.overscrollBehavior = 'none';
        body.style.overscrollBehavior = 'none';
        if (root) {
            root.style.height = '100%';
            root.style.overflow = 'hidden';
        }

        return () => {
            html.style.overflow = prev.htmlOverflow;
            body.style.overflow = prev.bodyOverflow;
            html.style.height = prev.htmlHeight;
            body.style.height = prev.bodyHeight;
            html.style.overscrollBehavior = prev.htmlOverscroll;
            body.style.overscrollBehavior = prev.bodyOverscroll;
            if (root) {
                root.style.height = prev.rootHeight;
                root.style.overflow = prev.rootOverflow;
            }
        };
    }, []);

    return (
        <div className="h-[100dvh] overflow-hidden overscroll-none bg-slate-50 dark:bg-slate-950 flex">
            {sidebarOpen && (
                <>
                    <Sidebar />
                    <div className="fixed inset-0 bg-black/50 z-[55] lg:hidden" onClick={() => setSidebarOpen(false)} />
                    <Sidebar mobile onClose={() => setSidebarOpen(false)} />
                </>
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <Header
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen((v) => !v)}
                    ghitaOpen={ghitaOpen}
                    onToggleGhita={() => setGhitaOpen((v) => !v)}
                />

                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <WorkspaceGrid>
                        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            {isDashboard && (
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
                                    <DashboardSection />
                                </div>
                            )}

                            {isDashboard ? (
                                <main className="hidden" aria-hidden="true">
                                    <Outlet />
                                </main>
                            ) : (
                                <main className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${isDevisForm ? 'p-0' : 'p-2 sm:p-3 lg:p-4'}`}>
                                    <Outlet />
                                </main>
                            )}
                        </div>
                    </WorkspaceGrid>

                    <GhitaPanel open={ghitaOpen} onClose={() => setGhitaOpen(false)} />
                    <WindowPagePicker open={pickerOpen} onClose={closePicker} />
                </div>
            </div>
        </div>
    );
}
