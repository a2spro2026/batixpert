import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardSection from '../dashboard/DashboardSection';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { pathname } = useLocation();
    const isDashboard = pathname === '/';
    const isDevisForm = /^\/clients\/devis\/(nouveau|\d+)/.test(pathname);

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
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

                {isDashboard && (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
                        <DashboardSection />
                    </div>
                )}

                {isDashboard ? (
                    <main className="hidden" aria-hidden="true">
                        <Outlet />
                    </main>
                ) : (
                    <main className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden ${isDevisForm ? 'p-0' : 'p-3 sm:p-4 lg:p-6'}`}>
                        <Outlet />
                    </main>
                )}
            </div>
        </div>
    );
}
