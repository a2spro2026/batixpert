import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, Eye, EyeOff, ArrowRight, Shield, Sparkles, BadgeCheck, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const STATUT_OPTIONS = [
    { value: 'Gerant', label: 'Gérant' },
    { value: 'Assistant', label: 'Assistant(e)' },
    { value: 'Commercial', label: 'Commercial' },
    { value: 'Facturation', label: 'Facturation' },
];

const TEXT_SECURITY_SUPPORTED = typeof CSS !== 'undefined' && CSS.supports?.('-webkit-text-security', 'disc');

const NO_AUTOFILL = { 'data-lpignore': 'true', 'data-1p-ignore': '', 'data-form-type': 'other' };

function RevealButton({ visible, onToggle, label }) {
    return (
        <motion.button
            type="button"
            onClick={onToggle}
            whileTap={{ scale: 0.9 }}
            aria-label={visible ? `Masquer ${label}` : `Afficher ${label}`}
            title={visible ? `Masquer ${label}` : `Afficher ${label}`}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-[2] p-1 rounded-lg text-slate-400 hover:text-brand-orange hover:bg-orange-50 transition-colors"
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={visible ? 'hide' : 'show'}
                    initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                    transition={{ duration: 0.2 }}
                    className="block"
                >
                    {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </motion.span>
            </AnimatePresence>
        </motion.button>
    );
}

function PasswordField({ value, onChange, showPassword, onToggle, locked, onUnlock }) {
    const [focused, setFocused] = useState(false);
    const hasValue = value.length > 0;

    return (
        <div className="relative">
            <label htmlFor="bx-pass" className="field-label-form">
                Mot de passe
            </label>
            <motion.div
                animate={{ scale: focused ? 1.01 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative"
            >
                <AnimatePresence>
                    {focused && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute -inset-1 rounded-xl bg-gradient-to-r from-brand-orange/30 via-amber-400/20 to-brand-navy/30 blur-md pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                <div
                    className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                        focused
                            ? 'border-brand-orange password-field-active bg-gradient-to-r from-orange-50/80 to-white'
                            : hasValue
                                ? 'border-brand-navy/40 bg-white'
                                : 'border-slate-300 bg-white'
                    }`}
                >
                    {focused && (
                        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-orange to-transparent password-scan-line pointer-events-none z-10" />
                    )}

                    <Lock
                        className={`absolute left-3.5 top-1/2 w-4 h-4 pointer-events-none transition-colors duration-300 ${
                            focused ? 'password-lock-active' : 'text-slate-400 -translate-y-1/2'
                        }`}
                    />

                    <input
                        id="bx-pass"
                        type={showPassword ? 'text' : 'password'}
                        value={value}
                        onChange={onChange}
                        readOnly={locked}
                        onPointerDown={onUnlock}
                        onFocus={() => { onUnlock(); setFocused(true); }}
                        onBlur={() => setFocused(false)}
                        placeholder="Votre mot de passe"
                        required
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        {...NO_AUTOFILL}
                        className="relative z-[1] block w-full pl-11 pr-11 py-3 text-sm text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
                    />

                    <RevealButton visible={showPassword} onToggle={onToggle} label="le mot de passe" />
                </div>

                <AnimatePresence>
                    {hasValue && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-1.5 mt-2 px-1"
                        >
                            {[1, 2, 3, 4].map((i) => (
                                <motion.div
                                    key={i}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: value.length >= i * 2 ? 1 : 0.3 }}
                                    className={`h-1 flex-1 rounded-full origin-left transition-colors duration-300 ${
                                        value.length >= i * 3
                                            ? 'bg-gradient-to-r from-brand-orange to-amber-500'
                                            : value.length >= i * 2
                                                ? 'bg-brand-navy/50'
                                                : 'bg-slate-200'
                                    }`}
                                />
                            ))}
                            <span className="text-[10px] text-slate-400 ml-1 shrink-0">
                                {focused ? 'Saisie sécurisée' : ''}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

export default function Login() {
    const [loginValue, setLoginValue] = useState('');
    const [password, setPassword] = useState('');
    const [statut, setStatut] = useState('');
    const [showLogin, setShowLogin] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [locked, setLocked] = useState({ login: true, password: true });
    const [panelVisible, setPanelVisible] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginFocused, setLoginFocused] = useState(false);
    const [statutFocused, setStatutFocused] = useState(false);
    const hiddenLoginRef = useRef(null);
    const hiddenPasswordRef = useRef(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const resetFields = useCallback(() => {
        setLoginValue('');
        setPassword('');
        setStatut('');
        setShowLogin(false);
        setShowPassword(false);
        setLocked({ login: true, password: true });
        if (hiddenLoginRef.current) hiddenLoginRef.current.value = '';
        if (hiddenPasswordRef.current) hiddenPasswordRef.current.value = '';
    }, []);

    useEffect(() => {
        resetFields();
        const onPageShow = () => {
            resetFields();
            setPanelVisible(false);
            setError('');
        };
        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }, [resetFields]);

    const togglePanel = () => {
        setShowLogin(false);
        setShowPassword(false);
        setPanelVisible((v) => !v);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!statut) {
            setError('Veuillez sélectionner un statut');
            return;
        }
        if (!loginValue || !password) {
            setError('Veuillez saisir le login et le mot de passe');
            return;
        }

        hiddenLoginRef.current.value = loginValue;
        hiddenPasswordRef.current.value = password;
        const credentials = { login: hiddenLoginRef.current.value, password: hiddenPasswordRef.current.value };
        setLoginValue('');
        setPassword('');
        setShowLogin(false);
        setShowPassword(false);

        setLoading(true);
        try {
            await login(credentials.login, credentials.password, statut);
            navigate('/');
        } catch (err) {
            setError(
                err.response?.data?.message
                || err.response?.data?.errors?.login?.[0]
                || err.response?.data?.errors?.statut?.[0]
                || err.response?.data?.errors?.password?.[0]
                || 'Identifiants incorrects'
            );
        } finally {
            hiddenLoginRef.current.value = '';
            hiddenPasswordRef.current.value = '';
            setLoading(false);
        }
    };

    const loginMasked = !showLogin;
    const loginInputType = TEXT_SECURITY_SUPPORTED || showLogin ? 'text' : 'password';

    return (
        <div className="relative min-h-[100dvh] flex flex-col overflow-x-hidden bg-slate-950">
            {/* Arrière-plan BATI-Xpert */}
            <div
                className="absolute inset-0 bg-cover bg-top bg-no-repeat lg:hidden"
                style={{ backgroundImage: "url('/images/login-bg-mobile.jpg')" }}
            />
            <div
                className="absolute inset-0 bg-cover bg-left bg-no-repeat hidden lg:block"
                style={{ backgroundImage: "url('/images/login-bg-desktop.jpg')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/10 to-slate-950/50 lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-slate-950/45" />

            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 rounded-full bg-brand-orange/40"
                        style={{ left: `${15 + i * 14}%`, top: `${20 + (i % 3) * 25}%` }}
                        animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2], scale: [1, 1.5, 1] }}
                        transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
                    />
                ))}
            </div>

            <button
                type="button"
                onClick={togglePanel}
                aria-pressed={panelVisible}
                aria-label={panelVisible ? 'Masquer le panneau de connexion' : 'Afficher le panneau de connexion'}
                title={panelVisible ? 'Masquer le panneau de connexion' : 'Afficher le panneau de connexion'}
                className="fixed top-4 right-4 z-30 w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/55 hover:bg-slate-900/75 backdrop-blur-md border border-white/25 text-white shadow-lg shadow-black/30 transition-colors"
            >
                {panelVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>

            <div className="relative z-10 flex-1 flex items-center justify-center lg:justify-end p-4 pt-[26vh] sm:p-8 sm:pt-[26vh] lg:p-12 lg:pr-16 xl:pr-24">
                <div
                    aria-hidden={!panelVisible}
                    className={`login-card-wrapper w-full max-w-[420px] transition-[opacity,visibility,transform] duration-300 ${
                        panelVisible ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible pointer-events-none translate-y-3'
                    }`}
                >
                    <div className="relative p-[2px] rounded-2xl login-card-border">
                        <div className="relative login-card-shine login-card-glow bg-white/95 backdrop-blur-xl rounded-[14px] p-6 sm:p-8 border border-white/50 overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-orange/10 to-transparent rounded-bl-full pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-brand-navy/10 to-transparent rounded-tr-full pointer-events-none" />

                            <div className="relative z-[2]">
                                <div className="text-center mb-6">
                                    <motion.div
                                        animate={{ rotate: [0, 5, -5, 0] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange via-orange-500 to-amber-500 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-orange-500/40"
                                    >
                                        <Lock className="w-6 h-6 text-white drop-shadow" />
                                    </motion.div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                                        Bienvenue !
                                        <Sparkles className="w-4 h-4 text-brand-orange" />
                                    </h2>
                                    <p className="text-slate-500 text-sm mt-0.5">Connectez-vous à votre espace</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" {...NO_AUTOFILL}>
                                    <input type="hidden" name="login" ref={hiddenLoginRef} defaultValue="" />
                                    <input type="hidden" name="password" ref={hiddenPasswordRef} defaultValue="" />

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="p-2.5 rounded-lg bg-red-50 text-red-600 text-sm text-center border border-red-100"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div>
                                        <label htmlFor="bx-statut" className="field-label-form">
                                            Statut
                                        </label>
                                        <motion.div
                                            animate={{ scale: statutFocused ? 1.01 : 1 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                            className={`relative rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                                                statutFocused
                                                    ? 'border-brand-orange shadow-[0_0_20px_rgba(249,115,22,0.2)]'
                                                    : statut
                                                        ? 'border-brand-navy/40'
                                                        : 'border-slate-300'
                                            }`}
                                        >
                                            <BadgeCheck className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${statutFocused || statut ? 'text-brand-orange' : 'text-slate-400'}`} />
                                            <select
                                                id="bx-statut"
                                                value={statut}
                                                onChange={(e) => setStatut(e.target.value)}
                                                onFocus={() => setStatutFocused(true)}
                                                onBlur={() => setStatutFocused(false)}
                                                required
                                                autoComplete="off"
                                                className={`block w-full appearance-none pl-11 pr-10 py-3 text-sm bg-white outline-none cursor-pointer ${
                                                    statut ? 'text-slate-900 font-medium' : 'text-slate-400'
                                                }`}
                                            >
                                                <option value="" disabled>Sélectionner un statut</option>
                                                {STATUT_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </motion.div>
                                    </div>

                                    <div>
                                        <label htmlFor="bx-user" className="field-label-form">
                                            Login
                                        </label>
                                        <motion.div
                                            animate={{ scale: loginFocused ? 1.01 : 1 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                            className={`relative rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                                                loginFocused
                                                    ? 'border-brand-navy shadow-[0_0_20px_rgba(30,58,95,0.2)]'
                                                    : 'border-slate-300'
                                            }`}
                                        >
                                            <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${loginFocused ? 'text-brand-navy' : 'text-slate-400'}`} />
                                            <input
                                                id="bx-user"
                                                type={loginInputType}
                                                value={loginValue}
                                                onChange={(e) => setLoginValue(e.target.value)}
                                                readOnly={locked.login}
                                                onPointerDown={() => setLocked((l) => ({ ...l, login: false }))}
                                                onFocus={() => { setLocked((l) => ({ ...l, login: false })); setLoginFocused(true); }}
                                                onBlur={() => setLoginFocused(false)}
                                                placeholder="Votre login"
                                                required
                                                autoComplete={TEXT_SECURITY_SUPPORTED ? 'off' : 'new-password'}
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                {...NO_AUTOFILL}
                                                style={TEXT_SECURITY_SUPPORTED && loginMasked ? { WebkitTextSecurity: 'disc' } : undefined}
                                                className="block w-full pl-11 pr-11 py-3 text-sm text-slate-900 bg-white outline-none placeholder:text-slate-400"
                                            />
                                            <RevealButton visible={showLogin} onToggle={() => setShowLogin((v) => !v)} label="le login" />
                                        </motion.div>
                                    </div>

                                    <PasswordField
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        showPassword={showPassword}
                                        onToggle={() => setShowPassword((v) => !v)}
                                        locked={locked.password}
                                        onUnlock={() => setLocked((l) => ({ ...l, password: false }))}
                                    />

                                    <div className="flex justify-end text-sm pt-1">
                                        <button type="button" className="text-brand-orange text-sm font-medium hover:underline underline-offset-2">
                                            Mot de passe oublié ?
                                        </button>
                                    </div>

                                    <motion.button
                                        type="submit"
                                        disabled={loading}
                                        whileHover={{ scale: loading ? 1 : 1.02, boxShadow: '0 20px 40px rgba(249,115,22,0.35)' }}
                                        whileTap={{ scale: loading ? 1 : 0.98 }}
                                        className="relative w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-navy via-blue-800 to-brand-orange text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg overflow-hidden group"
                                    >
                                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                        <span className="relative flex items-center gap-2">
                                            {loading ? (
                                                <>
                                                    <motion.span
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                                    />
                                                    Connexion...
                                                </>
                                            ) : (
                                                <>Se connecter <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                                            )}
                                        </span>
                                    </motion.button>
                                </form>

                                <div className="mt-5 flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-slate-50 text-xs text-slate-600 border border-blue-100/80">
                                    <Shield className="w-4 h-4 text-brand-navy shrink-0" />
                                    Connexion sécurisée — vos données sont protégées.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="relative z-10 py-4 px-6 text-center">
                <p className="text-xs text-white/50 tracking-wide">
                    Créé par{' '}
                    <span className="text-brand-orange font-bold tracking-wider">A2SPRO</span>
                    <span className="mx-2 text-white/30">—</span>
                    <span className="text-white/70 font-semibold">A2S</span>
                    <span className="mx-2 text-white/30">|</span>
                    Tous droits réservés
                </p>
            </footer>
        </div>
    );
}
