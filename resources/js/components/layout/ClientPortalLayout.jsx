import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, Banknote, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const tabs = [
    { to: '/portal', end: true, label: 'Mes bons de vente', icon: ClipboardList },
    { to: '/portal/reglements', end: false, label: 'Mes règlements', icon: Banknote },
];

export default function ClientPortalLayout() {
    const { user, logout } = useAuth();
    const { dark, toggle } = useTheme();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col">
            <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Portail Client</p>
                        <h1 className="text-sm sm:text-base font-bold text-brand-navy dark:text-white truncate">{user?.name || 'Client'}</h1>
                        {(user?.city || user?.phone) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{[user.city, user.phone].filter(Boolean).join(' · ')}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={toggle}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            title={dark ? 'Mode clair' : 'Mode sombre'}
                            aria-label={dark ? 'Mode clair' : 'Mode sombre'}
                        >
                            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="p-2 rounded-xl text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40"
                            title="Se déconnecter"
                            aria-label="Se déconnecter"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <nav className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
                    {tabs.map(({ to, end, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap border transition-colors ${
                                    isActive
                                        ? 'bg-brand-navy text-white border-brand-navy'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-orange/50'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6">
                <Outlet />
            </main>
        </div>
    );
}
