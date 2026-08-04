import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Logo({ size = 'md', showText = true }) {
    const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-11 h-11 text-base', lg: 'w-16 h-16 text-xl' };

    return (
        <div className="flex items-center gap-3">
            <div className={`${sizes[size]} relative rounded-xl bg-gradient-to-br from-brand-navy to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30 overflow-hidden`}>
                <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full opacity-20">
                    <rect x="8" y="20" width="12" height="20" fill="white" />
                    <rect x="22" y="12" width="10" height="28" fill="white" />
                    <rect x="34" y="16" width="8" height="24" fill="white" />
                    <line x1="36" y1="4" x2="36" y2="16" stroke="white" strokeWidth="2" />
                    <line x1="30" y1="8" x2="42" y2="8" stroke="white" strokeWidth="2" />
                </svg>
                <span className="font-bold text-white relative z-10">SP</span>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center">
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="currentColor">
                        <path d="M6 1L7.5 4.5H11L8.25 6.75L9.5 10.5L6 8.25L2.5 10.5L3.75 6.75L1 4.5H4.5L6 1Z" />
                    </svg>
                </div>
            </div>
            {showText && (
                <div>
                    <div className="font-bold text-lg leading-tight text-brand-navy dark:text-white tracking-wide">STE SOCIMPRO</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight max-w-[180px]">
                        Gestion commerciale
                    </div>
                </div>
            )}
        </div>
    );
}

export function SidebarBrand({ pageTitle }) {
    return (
        <NavLink to="/" className="flex items-center gap-3 group">
            <motion.div
                whileHover={{ scale: 1.06, rotate: 2 }}
                whileTap={{ scale: 0.97 }}
                className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-brand-navy via-blue-800 to-brand-orange flex items-center justify-center sidebar-logo-glow shadow-lg shadow-orange-500/20 overflow-hidden shrink-0"
            >
                <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
                    <rect x="8" y="20" width="12" height="20" fill="white" />
                    <rect x="22" y="12" width="10" height="28" fill="white" />
                    <rect x="34" y="16" width="8" height="24" fill="white" />
                </svg>
                <span className="relative z-10 font-black text-white text-sm tracking-tight">SP</span>
                <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-brand-orange border-2 border-slate-900 shadow-sm" />
            </motion.div>
            <div className="min-w-0">
                <div className="font-bold text-lg leading-tight tracking-wide truncate">
                    STE <span className="text-brand-orange">SOCIMPRO</span>
                </div>
                {pageTitle && (
                    <div className="text-[11px] text-blue-200 font-medium truncate mt-0.5">
                        {pageTitle}
                    </div>
                )}
            </div>
        </NavLink>
    );
}

export function NavbarBrand({ pageTitle }) {
    return (
        <div className="navbar-brand group flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
            <NavLink to="/">
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-brand-navy via-blue-800 to-brand-orange flex items-center justify-center shadow-lg shadow-brand-navy/25 overflow-hidden shrink-0"
                >
                    <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
                        <rect x="8" y="20" width="12" height="20" fill="white" />
                        <rect x="22" y="12" width="10" height="28" fill="white" />
                        <rect x="34" y="16" width="8" height="24" fill="white" />
                    </svg>
                    <span className="relative z-10 font-black text-white text-sm sm:text-base tracking-tight">SP</span>
                    <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-brand-orange border-2 border-white dark:border-slate-900 shadow-sm" />
                </motion.div>
            </NavLink>

            <div className="min-w-0 hidden sm:block border-l border-slate-200 dark:border-slate-700 pl-3">
                <div className="font-bold text-base sm:text-lg leading-tight tracking-wide truncate">
                    <span className="text-brand-navy dark:text-white">STE </span>
                    <span className="text-brand-orange">SOCIMPRO</span>
                </div>
                {pageTitle && (
                    <div className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">
                        {pageTitle}
                    </div>
                )}
            </div>

            {pageTitle && (
                <div className="sm:hidden text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                    {pageTitle}
                </div>
            )}
        </div>
    );
}
