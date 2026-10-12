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
    const isBonListPage = /^\/(fournisseurs\/bons-achats|clients\/bons-de-vente)/.test(pathname);

    useEffect(() => {
        if (!sidebarOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [sidebarOpen]);

    return (
        <div className="min-h-[100dvh] lg:h-screen bg-slate-50 dark:bg-slate-950 flex lg:overflow-hidden">
            {sidebarOpen && (
                <>
                    <Sidebar />
                    <div className="fixed inset-0 bg-black/50 z-[55] lg:hidden" onClick={() => setSidebarOpen(false)} />
                    <Sidebar mobile onClose={() => setSidebarOpen(false)} />
                </>
            )}
            <div className="flex-1 flex flex-col min-w-0 lg:min-h-0">
                <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

                {isDashboard && (
                    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
                        <DashboardSection />
                    </div>
                )}

                {isDashboard ? (
                    <main className="hidden" aria-hidden="true">
                        <Outlet />
                    </main>
                ) : (
                    <main className={`flex-1 flex flex-col min-w-0 p-3 sm:p-4 lg:p-6 lg:min-h-0 ${isBonListPage ? 'lg:overflow-hidden' : 'lg:overflow-y-auto lg:overflow-x-hidden'}`}>
                        <Outlet />
                    </main>
                )}

                {!isDevisForm && (
                    <footer className="hidden lg:block mt-auto shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                        © {new Date().getFullYear()} BatiXpert — Construisons l'avenir avec une gestion intelligente | v1.0.0
                    </footer>
                )}
            </div>
        </div>
    );
}
