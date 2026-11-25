import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { NavbarBrand } from '../Logo';
import UserAvatar from '../UserAvatar';
import { getPageTitle } from '../../lib/pageMeta';
import NotificationsBell from './NotificationsBell';
import WorkspaceSwitcher from './WorkspaceSwitcher';

export default function Header({ sidebarOpen, onToggleSidebar, ghitaOpen, onToggleGhita }) {
    const { dark, toggle } = useTheme();
    const { user } = useAuth();
    const { pathname } = useLocation();
    const pageTitle = getPageTitle(pathname);

    return (
        <header className="sticky top-0 z-50 shrink-0 navbar-header border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-orange/40 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between gap-3 sm:gap-4 px-4 lg:px-6 py-2.5 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className={`p-2 rounded-xl transition-colors shrink-0 ${
                            sidebarOpen
                                ? 'bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-white'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        aria-label={sidebarOpen ? 'Masquer le panneau latéral' : 'Afficher le panneau latéral'}
                        aria-expanded={sidebarOpen}
                        title={sidebarOpen ? 'Masquer le panneau latéral' : 'Afficher le panneau latéral'}
                    >
                        {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                    </button>
                    <NavbarBrand pageTitle={pageTitle} />
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="hidden xl:block text-sm text-slate-500 dark:text-slate-400 mr-1">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>

                    <WorkspaceSwitcher />

                    <button
                        type="button"
                        onClick={onToggleGhita}
                        className={`ghita-nav flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors ${
                            ghitaOpen
                                ? 'bg-brand-navy/10 ring-1 ring-brand-navy/20 dark:bg-white/10 dark:ring-white/20'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        aria-label={ghitaOpen ? 'Masquer Ghita' : 'Ouvrir Ghita'}
                        aria-pressed={ghitaOpen}
                        title="Ghita"
                    >
                        <img src="/images/ghita.jpg" alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-brand-orange/70" />
                        <span className="text-sm font-bold text-slate-800 dark:text-white">Ghita</span>
                    </button>
                    <button
                        type="button"
                        onClick={toggle}
                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Changer le thème"
                    >
                        {dark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                    </button>
                    <NotificationsBell />
                    {user && (
                        <div className="flex items-center gap-2.5 ml-1 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-700">
                            <div className="hidden sm:block text-right leading-tight">
                                <p className="text-sm font-bold text-slate-800 dark:text-white whitespace-nowrap">
                                    {user.name || 'MR AHMED'}
                                </p>
                                <p className="text-[11px] font-semibold text-brand-orange whitespace-nowrap">
                                    {user.title || 'Directeur Général'}
                                </p>
                            </div>
                            <div className="p-0.5 rounded-full hover:ring-2 hover:ring-brand-orange/30 transition-all">
                                <UserAvatar user={user} size="lg" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
