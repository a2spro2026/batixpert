import axios from 'axios';
import { authStorage } from './authStorage';

const api = axios.create({
    baseURL: '/api',
    headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = authStorage.get('batixpert_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (r) => r,
    (error) => {
        if (error.response?.status === 401) {
            authStorage.clear();
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/app/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
