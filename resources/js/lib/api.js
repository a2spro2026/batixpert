import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('batixpert_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Sans ça axios sérialise le FormData en JSON et perd les fichiers.
    if (config.data instanceof FormData) config.headers['Content-Type'] = 'multipart/form-data';
    return config;
});

api.interceptors.response.use(
    (r) => r,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('batixpert_token');
            localStorage.removeItem('batixpert_user');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/app/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
