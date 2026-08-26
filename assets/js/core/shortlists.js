/**
 * Le due liste di supporto: alternative e giocatori da chiamare all'inizio.
 *
 * Non sono liste d'asta: qui non ci sono massimali e non si compra niente.
 * Servono solo a ricordarti dei nomi mentre sei al tavolo, e l'unica cosa che
 * ci fai è togliere chi è già stato chiamato da qualcun altro.
 *
 * Come tutto quello che sta in core/, non tocca il DOM: la pagina ci mette
 * sopra i bottoni, i test la usano direttamente da node.
 */
;(function (global) {
    'use strict';

    const isNode = typeof module !== 'undefined' && !!module.exports;
    const text = isNode ? require('./text.js') : global.FC.text;
    const engine = isNode ? require('./engine.js') : global.FC.engine;

    const { norm } = text;
    const { VALID_ROLES } = engine;

    /**
     * Porta una lista nella forma { name, role?, team? }, scartando le righe
     * inutilizzabili e i doppioni. Il massimale, se c'è, viene ignorato: in
     * queste liste non serve e mostrarlo confonderebbe con la wishlist vera.
     */
    function normalizeEntries(list) {
        const entries = [];
        const problems = [];
        const seen = new Set();

        if (!Array.isArray(list)) return { entries, problems: ['La lista non è un array.'] };

        list.forEach((raw, i) => {
            const label = `riga ${i + 1}`;
            if (!raw || typeof raw !== 'object') { problems.push(`${label}: non è un oggetto.`); return; }

            const name = String(raw.name ?? '').trim();
            if (!name) { problems.push(`${label}: nome mancante.`); return; }

            const key = norm(name);
            if (seen.has(key)) { problems.push(`${label} (${name}): duplicato, tengo il primo.`); return; }
            seen.add(key);

            const role = String(raw.role ?? raw.ruolo ?? '').toUpperCase();
            const team = String(raw.team ?? raw.squadra ?? '').trim();
            entries.push({
                name,
                role: VALID_ROLES.includes(role) ? role : undefined,
                team: team || undefined,
            });
        });

        return { entries, problems };
    }

    /**
     * @param {Array} defs  [{ id, label, players }] — l'ordine dei giocatori è
     *                      quello del file: è una lista curata, non la si riordina.
     */
    function createShortlists(defs) {
        const lists = new Map();
        const problems = [];

        for (const def of Array.isArray(defs) ? defs : []) {
            const id = String(def && def.id || '').trim();
            if (!id || lists.has(id)) continue;
            const { entries, problems: bad } = normalizeEntries(def.players);
            problems.push(...bad.map(p => `${id}: ${p}`));
            lists.set(id, {
                id,
                label: String(def.label || id),
                all: entries,
                removed: new Set(),
            });
        }

        function get(id) { return lists.get(String(id)); }

        function fail(message) { return { ok: false, message }; }

        const api = {
            problems,

            /** Gli id nell'ordine in cui sono stati definiti. */
            ids() { return [...lists.keys()]; },

            label(id) { const l = get(id); return l ? l.label : ''; },

            /** Quanti giocatori aveva la lista di partenza. */
            size(id) { const l = get(id); return l ? l.all.length : 0; },

            /** I giocatori ancora da chiamare, nell'ordine del file. */
            items(id) {
                const l = get(id);
                if (!l) return [];
                return l.all.filter(p => !l.removed.has(norm(p.name)));
            },

            removedCount(id) { const l = get(id); return l ? l.removed.size : 0; },

            /** Toglie un giocatore: è già stato chiamato, non serve più averlo davanti. */
            remove(id, name) {
                const l = get(id);
                if (!l) return fail(`Lista "${id}" inesistente.`);
                const key = norm(name);
                const entry = l.all.find(p => norm(p.name) === key);
                if (!entry) return fail(`"${name}" non è in ${l.label}.`);
                if (l.removed.has(key)) return fail(`"${entry.name}" l'avevi già tolto.`);
                l.removed.add(key);
                return { ok: true, entry };
            },

            /** Rimette tutti quelli tolti da una lista. */
            restore(id) {
                const l = get(id);
                if (!l) return fail(`Lista "${id}" inesistente.`);
                const count = l.removed.size;
                l.removed.clear();
                return { ok: true, count };
            },

            restoreAll() {
                let count = 0;
                for (const l of lists.values()) { count += l.removed.size; l.removed.clear(); }
                return { ok: true, count };
            },

            /**
             * Solo i nomi tolti, pronti da infilare in engine.extra: la lista di
             * partenza sta nel file dati e non ha senso duplicarla nel salvataggio.
             */
            toState() {
                const state = {};
                for (const l of lists.values()) state[l.id] = [...l.removed];
                return state;
            },

            /** Ricarica le rimozioni salvate, ignorando quello che non riconosce. */
            fromState(state) {
                if (!state || typeof state !== 'object') return false;
                for (const l of lists.values()) {
                    l.removed.clear();
                    const saved = state[l.id];
                    if (!Array.isArray(saved)) continue;
                    for (const name of saved) {
                        const key = norm(name);
                        if (l.all.some(p => norm(p.name) === key)) l.removed.add(key);
                    }
                }
                return true;
            },
        };

        return api;
    }

    const api = { createShortlists, normalizeEntries };

    global.FC = global.FC || {};
    global.FC.shortlists = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
