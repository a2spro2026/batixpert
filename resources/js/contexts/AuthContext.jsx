import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('batixpert_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(!!localStorage.getItem('batixpert_token'));

    useEffect(() => {
        if (localStorage.getItem('batixpert_token')) {
            api.get('/user')
                .then((r) => {
                    const savedStatut = localStorage.getItem('batixpert_statut');
                    const statutLabels = {
                        Gerant: 'Gérant',
                        Assistant: 'Assistant(e)',
                        Commercial: 'Commercial',
                        Facturation: 'Facturation',
                    };
                    const user = {
                        ...r.data,
                        ...(savedStatut ? {
                            statut: savedStatut,
                            statut_label: statutLabels[savedStatut] || savedStatut,
                            title: statutLabels[savedStatut] || r.data.title,
                        } : {}),
                    };
                    setUser(user);
                    localStorage.setItem('batixpert_user', JSON.stringify(user));
                })
                .catch(() => {
                    localStorage.removeItem('batixpert_token');
                    localStorage.removeItem('batixpert_user');
                    localStorage.removeItem('batixpert_statut');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (loginValue, password, statut) => {
        const { data } = await api.post('/login', { login: loginValue, password, statut });
        localStorage.setItem('batixpert_token', data.token);
        localStorage.setItem('batixpert_user', JSON.stringify(data.user));
        if (statut) localStorage.setItem('batixpert_statut', statut);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post('/logout'); } catch {}
        localStorage.removeItem('batixpert_token');
        localStorage.removeItem('batixpert_user');
        localStorage.removeItem('batixpert_statut');
        setUser(null);
    };

    const can = (permission) => user?.is_admin || user?.permissions?.includes(permission);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, can }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
