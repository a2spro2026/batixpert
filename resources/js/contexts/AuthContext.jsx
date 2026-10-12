import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { authStorage } from '../lib/authStorage';

const AuthContext = createContext();

const STATUT_LABELS = {
    Gerant: 'Gérant',
    Assistant: 'Assistant(e)',
    Commercial: 'Commercial',
    Facturation: 'Facturation',
};

function mergeUserWithStatut(userData) {
    const statut = authStorage.get('batixpert_statut');
    if (!statut) {
        return userData;
    }

    return {
        ...userData,
        statut,
        statut_label: STATUT_LABELS[statut] || statut,
        title: STATUT_LABELS[statut] || userData.title,
    };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = authStorage.get('batixpert_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(!!authStorage.get('batixpert_token'));

    useEffect(() => {
        if (authStorage.get('batixpert_token')) {
            api.get('/user')
                .then((r) => {
                    const merged = mergeUserWithStatut(r.data);
                    setUser(merged);
                    authStorage.set('batixpert_user', JSON.stringify(merged));
                })
                .catch(() => {
                    authStorage.clear();
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (loginValue, password, statut) => {
        const { data } = await api.post('/login', { login: loginValue, password, statut });
        authStorage.set('batixpert_token', data.token);
        authStorage.set('batixpert_user', JSON.stringify(data.user));
        if (statut) authStorage.set('batixpert_statut', statut);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post('/logout'); } catch {}
        authStorage.clear();
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
