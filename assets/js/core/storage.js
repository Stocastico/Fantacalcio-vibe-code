/**
 * Salvataggio dello stato su localStorage.
 *
 * Ogni scrittura porta con sé un numero di versione: se cambia la forma dello
 * stato fra una stagione e l'altra, i dati vecchi vengono ignorati invece di
 * far partire l'app con oggetti a metà. localStorage può anche non esserci
 * (modalità privata, quota piena): in quel caso l'app funziona lo stesso,
 * semplicemente non ricorda niente fra un refresh e l'altro.
 */
;(function (global) {
    'use strict';

    function defaultBackend() {
        try {
            if (typeof localStorage === 'undefined') return null;
            // Safari in navigazione privata espone localStorage ma lancia in scrittura.
            const probe = '__fc_probe__';
            localStorage.setItem(probe, '1');
            localStorage.removeItem(probe);
            return localStorage;
        } catch {
            return null;
        }
    }

    /**
     * @param {string} key      chiave localStorage
     * @param {object} options  { version:number, backend?:Storage }
     */
    function createStore(key, options) {
        const opts = Object.assign({ version: 1, backend: undefined }, options);
        const backend = opts.backend !== undefined ? opts.backend : defaultBackend();

        return {
            available: !!backend,

            save(state) {
                if (!backend) return false;
                try {
                    backend.setItem(key, JSON.stringify({ version: opts.version, savedAt: Date.now(), state }));
                    return true;
                } catch {
                    return false; // quota piena o storage negato: si va avanti senza persistenza
                }
            },

            /** @returns lo stato salvato, oppure null se assente/corrotto/di una versione precedente. */
            load() {
                if (!backend) return null;
                try {
                    const raw = backend.getItem(key);
                    if (!raw) return null;
                    const parsed = JSON.parse(raw);
                    if (!parsed || parsed.version !== opts.version) return null;
                    return parsed.state ?? null;
                } catch {
                    return null;
                }
            },

            clear() {
                if (!backend) return false;
                try {
                    backend.removeItem(key);
                    return true;
                } catch {
                    return false;
                }
            },
        };
    }

    /** Storage finto in memoria: usato dai test e come fallback. */
    function memoryBackend() {
        const map = new Map();
        return {
            getItem: k => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => { map.set(k, String(v)); },
            removeItem: k => { map.delete(k); },
        };
    }

    const api = { createStore, memoryBackend };

    global.FC = global.FC || {};
    global.FC.storage = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
