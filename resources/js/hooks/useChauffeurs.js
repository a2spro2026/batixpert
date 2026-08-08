import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

export function useChauffeurs() {
    const [chauffeurs, setChauffeurs] = useState([]);

    const reload = useCallback(() => {
        api.get('/chauffeurs')
            .then((r) => setChauffeurs(r.data.data ?? []))
            .catch(() => setChauffeurs([]));
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const byName = useMemo(() => {
        const map = new Map();
        chauffeurs.forEach((c) => {
            const key = normalizeKey(c.nom);
            if (key) map.set(key, c);
        });
        return map;
    }, [chauffeurs]);

    const resolveMatricule = useCallback((nom) => {
        const match = byName.get(normalizeKey(nom));
        return match?.matricule || '';
    }, [byName]);

    return { chauffeurs, resolveMatricule, reloadChauffeurs: reload };
}
