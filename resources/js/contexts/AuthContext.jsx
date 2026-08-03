import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('autopilote_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(!!localStorage.getItem('autopilote_token'));

    useEffect(() => {
        if (localStorage.getItem('autopilote_token')) {
            api.get('/user')
                .then((r) => {
                    setUser(r.data);
                    localStorage.setItem('autopilote_user', JSON.stringify(r.data));
                })
                .catch(() => {
                    localStorage.removeItem('autopilote_token');
                    localStorage.removeItem('autopilote_user');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password, status) => {
        const { data } = await api.post('/login', { email, password, status });
        localStorage.setItem('autopilote_token', data.token);
        localStorage.setItem('autopilote_user', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post('/logout'); } catch {}
        localStorage.removeItem('autopilote_token');
        localStorage.removeItem('autopilote_user');
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
