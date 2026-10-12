const KEYS = ['batixpert_token', 'batixpert_user', 'batixpert_statut'];

KEYS.forEach((key) => localStorage.removeItem(key));

// sessionStorage only: closing the browser must force a new login.
export const authStorage = {
    get: (key) => sessionStorage.getItem(key),
    set: (key, value) => sessionStorage.setItem(key, value),
    clear: () => KEYS.forEach((key) => sessionStorage.removeItem(key)),
};
