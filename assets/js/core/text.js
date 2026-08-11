/**
 * Utility su testo, numeri e ricerca giocatori.
 *
 * Ogni modulo di core/ funziona in tre contesti:
 *  - <script src> da file:// (niente ESM, niente fetch: si apre col doppio click)
 *  - require() da node, per i test
 *  - globale FC.<modulo> nel browser
 */
;(function (global) {
    'use strict';

    /** Ordine convenzionale dei ruoli, usato per ordinare le liste. */
    const ROLE_ORDER = { P: 0, D: 1, C: 2, A: 3 };

    /**
     * Normalizza un nome per i confronti: via gli accenti, tutto minuscolo,
     * spazi multipli compattati. "Vlahović" e "vlahovic" diventano uguali.
     */
    function norm(s) {
        return (s || '')
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Confronto fra nomi tollerante ad accenti e maiuscole. Stringhe vuote non matchano mai. */
    function sameName(a, b) {
        const na = norm(a);
        return na !== '' && na === norm(b);
    }

    /**
     * Converte in intero. Restituisce null (non 0, non NaN) se il valore non è
     * un numero utilizzabile, così chi chiama può distinguere "vuoto" da "zero".
     */
    function toInt(value) {
        if (value === '' || value === null || value === undefined) return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.round(n);
    }

    /**
     * Cerca giocatori per nome: prima i match esatti, altrimenti quelli che
     * contengono la query. Restituire più di un risultato è normale ed è il
     * segnale per chiedere all'utente di essere più specifico.
     */
    function findCandidates(query, list) {
        const s = norm(query);
        if (!s || !Array.isArray(list)) return [];
        const exact = list.filter(p => norm(p.name) === s);
        if (exact.length) return exact;
        return list.filter(p => norm(p.name).includes(s));
    }

    /** Copia ordinata per massimale decrescente, a parità di massimale per nome. */
    function sortByMaxDesc(list) {
        return [...list].sort((a, b) => (b.max - a.max) || a.name.localeCompare(b.name, 'it'));
    }

    /** Copia ordinata per ruolo (P, D, C, A), poi massimale decrescente, poi nome. */
    function sortByRole(list) {
        return [...list].sort((a, b) =>
            ((ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)) ||
            (b.max - a.max) ||
            a.name.localeCompare(b.name, 'it')
        );
    }

    const api = { ROLE_ORDER, norm, sameName, toInt, findCandidates, sortByMaxDesc, sortByRole };

    global.FC = global.FC || {};
    global.FC.text = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
