import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bot,
    ChevronDown,
    List,
    Mic,
    Send,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import api from '../../lib/api';

function ghitaMic() {
    return import('../../lib/ghitaMic');
}

const VOICE_KEY = 'ghita-voice';
const SIZE_KEY = 'ghita-size';
const MIN_W = 300;
const MIN_H = 280;
const DEFAULT_SIZE = { w: 360, h: 420 };

function readSize() {
    try {
        const raw = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
        if (!raw || typeof raw.w !== 'number' || typeof raw.h !== 'number') return DEFAULT_SIZE;
        return {
            w: Math.max(MIN_W, Math.min(raw.w, window.innerWidth - 24)),
            h: Math.max(MIN_H, Math.min(raw.h, window.innerHeight - 96)),
        };
    } catch {
        return DEFAULT_SIZE;
    }
}

const MODULES = [
    { id: 'conversation', label: 'Conversation' },
    { id: 'memoire', label: 'Mémoire' },
    { id: 'conseil', label: 'Conseil' },
    { id: 'analyse', label: 'Analyse' },
    { id: 'projets', label: 'Projets' },
    { id: 'recherche', label: 'Recherche' },
    { id: 'documents', label: 'Documents' },
    { id: 'automatisation', label: 'Automatisation' },
];

function frenchVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const french = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('fr'));
    return french.find((voice) => /am[eé]lie|hortense|denise|julie|audrey|virginie|marie|female|femme/i.test(voice.name))
        || french[0]
        || null;
}

function speakText(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1;
    const voice = frenchVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
}

export default function GhitaPanel({ open, onClose }) {
    const [messages, setMessages] = useState([]);
    const [moduleId, setModuleId] = useState('conversation');
    const [modulesOpen, setModulesOpen] = useState(false);
    const [pending, setPending] = useState(null);
    const [context, setContext] = useState(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [listening, setListening] = useState(false);
    const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem(VOICE_KEY) === '1');
    const [voiceError, setVoiceError] = useState('');
    const [micHint, setMicHint] = useState('');
    const [size, setSize] = useState(() => (typeof window === 'undefined' ? DEFAULT_SIZE : readSize()));
    const listRef = useRef(null);
    const modulesRef = useRef(null);
    const recognitionRef = useRef(null);
    const voiceOnRef = useRef(voiceOn);
    const micBusyRef = useRef(false);
    const sizeRef = useRef(size);
    const dragRef = useRef(null);
    const go = useNavigate();

    useEffect(() => {
        voiceOnRef.current = voiceOn;
        localStorage.setItem(VOICE_KEY, voiceOn ? '1' : '0');
    }, [voiceOn]);

    useEffect(() => {
        sizeRef.current = size;
        localStorage.setItem(SIZE_KEY, JSON.stringify(size));
    }, [size]);

    useEffect(() => {
        const clamp = () => {
            setSize((current) => ({
                w: Math.max(MIN_W, Math.min(current.w, window.innerWidth - 24)),
                h: Math.max(MIN_H, Math.min(current.h, window.innerHeight - 96)),
            }));
        };
        window.addEventListener('resize', clamp);
        return () => window.removeEventListener('resize', clamp);
    }, []);

    useEffect(() => {
        const onMove = (event) => {
            const drag = dragRef.current;
            if (!drag) return;
            const point = event.touches?.[0] || event;
            const maxW = window.innerWidth - 24;
            const maxH = window.innerHeight - 96;
            let nextW = sizeRef.current.w;
            let nextH = sizeRef.current.h;
            if (drag.edge.includes('left')) {
                nextW = Math.max(MIN_W, Math.min(maxW, drag.startW + (drag.startX - point.clientX)));
            }
            if (drag.edge.includes('top')) {
                nextH = Math.max(MIN_H, Math.min(maxH, drag.startH + (drag.startY - point.clientY)));
            }
            setSize({ w: Math.round(nextW), h: Math.round(nextH) });
        };
        const onUp = () => {
            dragRef.current = null;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, []);

    const startResize = (edge) => (event) => {
        event.preventDefault();
        event.stopPropagation();
        const point = event.touches?.[0] || event;
        dragRef.current = {
            edge,
            startX: point.clientX,
            startY: point.clientY,
            startW: sizeRef.current.w,
            startH: sizeRef.current.h,
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = edge === 'left' ? 'ew-resize' : edge === 'top' ? 'ns-resize' : 'nwse-resize';
    };

    useEffect(() => {
        const synth = window.speechSynthesis;
        if (!synth) return undefined;
        const warm = () => frenchVoice();
        synth.addEventListener?.('voiceschanged', warm);
        warm();
        return () => synth.removeEventListener?.('voiceschanged', warm);
    }, []);

    useEffect(() => {
        if (!open) {
            window.speechSynthesis?.cancel();
            ghitaMic().then((mic) => mic.cancelRecording());
            recognitionRef.current?.stop?.();
            setListening(false);
            setModulesOpen(false);
        }
    }, [open]);

    useEffect(() => {
        if (!modulesOpen) return undefined;
        const close = (event) => {
            if (!modulesRef.current?.contains(event.target)) setModulesOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [modulesOpen]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, busy]);

    const ask = async (text, nextModule = moduleId) => {
        const message = text.trim();
        if (!message || busy) return;
        setDraft('');
        setVoiceError('');
        setModulesOpen(false);
        setModuleId(nextModule);
        setMessages((current) => [...current, { role: 'user', text: message }]);
        setBusy(true);
        try {
            const { data } = await api.post('/ghita', { message, module: nextModule, pending, context });
            setMessages((current) => [...current, { role: 'ghita', text: data.reply }]);
            setPending(data.pending ?? null);
            if (data.context) setContext(data.context);
            if (data.module) setModuleId(data.module);
            if (voiceOnRef.current) speakText(data.speak || data.reply);
            if (data.refresh?.client_id) {
                window.dispatchEvent(new CustomEvent('ghita:client', { detail: data.refresh }));
            }
            if (data.navigate) go(data.navigate);
        } catch {
            setMessages((current) => [...current, { role: 'ghita', text: 'Je n\'ai pas pu répondre. Réessayez.' }]);
        } finally {
            setBusy(false);
        }
    };

    const toggleVoice = () => {
        setVoiceOn((current) => {
            const next = !current;
            if (!next) window.speechSynthesis?.cancel();
            else {
                const last = [...messages].reverse().find((item) => item.role === 'ghita');
                if (last) speakText(last.text);
            }
            return next;
        });
    };

    const sendVoice = async () => {
        if (micBusyRef.current) return;
        micBusyRef.current = true;
        setListening(false);
        setMicHint('Je transcris…');
        setVoiceError('');
        try {
            const { finishRecording } = await ghitaMic();
            const text = await finishRecording();
            setMicHint('');
            if (text) {
                setDraft(text);
                ask(text);
            } else {
                setVoiceError('Je n\'ai rien entendu. Cliquez le micro, parlez, puis arrêtez-vous.');
            }
        } catch {
            setMicHint('');
            setVoiceError('La transcription n\'a pas abouti. Réessayez.');
        } finally {
            micBusyRef.current = false;
        }
    };

    const toggleMic = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setVoiceError('Ce navigateur ne prend pas le micro. Écrivez la question.');
            return;
        }
        if (listening) {
            await sendVoice();
            return;
        }

        window.speechSynthesis?.cancel();
        setVoiceError('');
        setMicHint('Je prépare le micro…');
        try {
            const gate = { open: true };
            const auto = { armed: false };
            const { beginRecording } = await ghitaMic();
            await beginRecording((percent) => {
                if (!gate.open) return;
                setMicHint(percent > 0 ? `Chargement de la voix ${percent} %` : 'Chargement de la voix…');
            }, () => {
                if (!auto.armed) return;
                auto.armed = false;
                sendVoice();
            });
            gate.open = false;
            auto.armed = true;
            setListening(true);
            setMicHint('Je vous écoute. Parlez, puis faites une pause.');
        } catch (error) {
            setListening(false);
            setMicHint('');
            ghitaMic().then((mic) => mic.cancelRecording());
            const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
            const missing = error?.name === 'NotFoundError';
            setVoiceError(denied
                ? 'Le micro est bloqué. Autorisez-le pour 127.0.0.1, puis réessayez.'
                : missing
                    ? 'Aucun micro détecté sur cet ordinateur.'
                    : 'Le micro ne s\'ouvre pas. Réessayez ou écrivez.');
        }
    };

    if (!open) return null;

    return (
        <aside
            className="ghita-panel absolute bottom-3 right-3 z-40 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f7fb] shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)] dark:border-slate-700 dark:bg-[#111827] dark:shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)]"
            style={{ width: size.w, height: size.h }}
            aria-label="Ghita"
        >
            <button
                type="button"
                className="absolute left-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-md bg-white/20 text-white/90 hover:bg-white/30"
                onMouseDown={startResize('top-left')}
                onTouchStart={startResize('top-left')}
                title="Agrandir ou réduire"
                aria-label="Agrandir ou réduire le panneau"
            >
                <span className="block h-2.5 w-2.5 border-l-2 border-t-2 border-white/90" />
            </button>
            <div
                className="absolute left-0 top-6 bottom-6 z-20 w-1.5 cursor-ew-resize hover:bg-brand-orange/40"
                onMouseDown={startResize('left')}
                onTouchStart={startResize('left')}
                title="Largeur"
            />
            <div
                className="absolute left-6 right-6 top-0 z-20 h-1.5 cursor-ns-resize hover:bg-brand-orange/40"
                onMouseDown={startResize('top')}
                onTouchStart={startResize('top')}
                title="Hauteur"
            />
            <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-gradient-to-r from-brand-navy via-[#1a4a7a] to-[#c45c1a] px-3 py-2.5 text-white dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                        <img
                            src="/images/ghita.jpg"
                            alt="Ghita"
                            className="h-9 w-9 rounded-xl object-cover ring-2 ring-white/50"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-navy bg-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold leading-tight">Ghita</p>
                        <p className="truncate text-[10px] text-white/75">Assistante métier</p>
                    </div>
                    <div className="relative flex items-center gap-0.5" ref={modulesRef}>
                        <button
                            type="button"
                            onClick={() => setModulesOpen((current) => !current)}
                            className="inline-flex items-center gap-0.5 rounded-lg p-2 text-white/90 hover:bg-white/15"
                            aria-label="Modules Ghita"
                            aria-expanded={modulesOpen}
                            title="Modules"
                        >
                            <List className="h-4 w-4" />
                            <ChevronDown className={`h-3 w-3 transition ${modulesOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={toggleVoice}
                            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
                            aria-label={voiceOn ? 'Couper la voix de Ghita' : 'Activer la voix de Ghita'}
                            title={voiceOn ? 'Réponse parlée' : 'Réponse écrite'}
                        >
                            {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
                            aria-label="Fermer Ghita"
                            title="Fermer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {modulesOpen && (
                            <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                                    Modules
                                </p>
                                <div className="max-h-64 overflow-y-auto py-1">
                                    {MODULES.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setModuleId(item.id);
                                                setModulesOpen(false);
                                                ask(item.label, item.id);
                                            }}
                                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                                moduleId === item.id
                                                    ? 'bg-brand-navy/10 font-semibold text-brand-navy dark:bg-white/10 dark:text-white'
                                                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <span>{item.label}</span>
                                            {moduleId === item.id && <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div
                ref={listRef}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3"
            >
                {!messages.length && !busy ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-white/80 px-3 py-4 text-center dark:border-slate-600 dark:bg-slate-900/80">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Bot className="h-7 w-7" strokeWidth={1.25} />
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Conversation vide</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((message, index) => (
                            <div key={`${message.role}-${index}`} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role === 'ghita' && (
                                    <img src="/images/ghita.jpg" alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-lg object-cover" />
                                )}
                                <p className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                                    message.role === 'user'
                                        ? 'rounded-br-md bg-brand-navy text-white'
                                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                                }`}>
                                    {message.text}
                                </p>
                            </div>
                        ))}
                        {busy && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" />
                                Ghita examine…
                            </div>
                        )}
                    </div>
                )}
            </div>

            <form
                className="shrink-0 border-t border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-[#0f172a]"
                onSubmit={(event) => {
                    event.preventDefault();
                    ask(draft);
                }}
            >
                {micHint && <p className="mb-1.5 px-1 text-[11px] text-slate-500 dark:text-slate-300">{micHint}</p>}
                {voiceError && <p className="mb-1.5 px-1 text-[11px] text-red-600">{voiceError}</p>}
                <div className="flex items-end gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={toggleMic}
                        className={`rounded-xl p-2.5 ${listening ? 'bg-red-500 text-white' : 'bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-100'}`}
                        aria-label={listening ? 'Arrêter le micro' : 'Parler à Ghita'}
                        title={listening ? 'Ghita écoute' : 'Parler'}
                    >
                        <Mic className="h-4 w-4" />
                    </button>
                    <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                ask(draft);
                            }
                        }}
                        rows={2}
                        lang="fr"
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        placeholder={listening ? 'Ghita écoute…' : 'Écrivez ou parlez…'}
                        className="min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[13px] text-slate-800 outline-none dark:text-slate-100"
                    />
                    <button
                        type="submit"
                        disabled={busy || !draft.trim()}
                        className="rounded-xl bg-brand-orange p-2.5 text-white disabled:opacity-40"
                        aria-label="Envoyer"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>
            </form>
        </aside>
    );
}
