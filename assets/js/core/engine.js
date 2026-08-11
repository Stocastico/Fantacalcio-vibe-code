/**
 * Motore d'asta condiviso fra l'helper principale e il mercato di riparazione.
 *
 * Qui dentro non si tocca il DOM: è tutta logica pura, così i test girano in
 * node senza browser e le due pagine possono avere UI diverse sopra lo stesso
 * comportamento.
 *
 * Modello dati unico: ogni giocatore è { name, max, role? }.
 *  - `max`  è il tuo tetto di spesa, non il prezzo di listino
 *  - `role` (P/D/C/A) è opzionale: il mercato di riparazione ha un pool unico
 */
;(function (global) {
    'use strict';

    const isNode = typeof module !== 'undefined' && !!module.exports;
    const text = isNode ? require('./text.js') : global.FC.text;
    const credits = isNode ? require('./credits.js') : global.FC.credits;
    const csv = isNode ? require('./csv.js') : global.FC.csv;
    const storage = isNode ? require('./storage.js') : global.FC.storage;

    const { norm, toInt, findCandidates, sortByMaxDesc } = text;

    const VALID_ROLES = ['P', 'D', 'C', 'A'];

    /**
     * Porta una lista qualsiasi nella forma { name, max, role }.
     * Accetta sia `max` che `bid` (il nome usato nelle stagioni precedenti).
     * Scarta le righe inutilizzabili e i doppioni, riportando cosa ha scartato.
     */
    function normalizePlayers(list) {
        const players = [];
        const problems = [];
        const seen = new Set();

        if (!Array.isArray(list)) return { players, problems: ['La lista non è un array.'] };

        list.forEach((raw, i) => {
            const label = `riga ${i + 1}`;
            if (!raw || typeof raw !== 'object') { problems.push(`${label}: non è un oggetto.`); return; }

            const name = String(raw.name ?? '').trim();
            if (!name) { problems.push(`${label}: nome mancante.`); return; }

            const max = toInt(raw.max ?? raw.bid);
            if (max === null || max < 0) { problems.push(`${label} (${name}): massimale non valido.`); return; }

            const key = norm(name);
            if (seen.has(key)) { problems.push(`${label} (${name}): duplicato, tengo il primo.`); return; }
            seen.add(key);

            const role = String(raw.role ?? '').toUpperCase();
            players.push({ name, max, role: VALID_ROLES.includes(role) ? role : undefined });
        });

        return { players, problems };
    }

    /**
     * @param {object} config
     *   budget            crediti totali a disposizione
     *   players           lista iniziale
     *   redistribution    opzioni passate a credits.redistribute
     *   storageKey        chiave localStorage (omessa = niente persistenza)
     *   storageVersion    versione dello stato salvato
     *   storageBackend    override per i test
     *   easterEgg         attiva la regola del 36 nel calcolo del rilancio
     *   hideMaxInCsv      omette la colonna dei massimali nell'export
     */
    function createEngine(config) {
        const cfg = Object.assign({
            budget: 500,
            players: [],
            redistribution: { strategy: 'spread', topN: 3, min: 1 },
            storageKey: null,
            storageVersion: 1,
            storageBackend: undefined,
            easterEgg: false,
            hideMaxInCsv: false,
        }, config);

        const initial = normalizePlayers(cfg.players).players;
        const store = cfg.storageKey
            ? storage.createStore(cfg.storageKey, { version: cfg.storageVersion, backend: cfg.storageBackend })
            : null;

        let budget = toInt(cfg.budget) ?? 500;
        let pool = clone(initial);
        let purchases = [];
        let spent = 0;
        let actions = [];   // log per l'undo, in ordine cronologico
        let extra = {};     // spazio libero per stato specifico della singola pagina

        function clone(list) {
            return list.map(p => ({ name: p.name, max: p.max, role: p.role }));
        }

        function persist() {
            if (!store) return false;
            return store.save({ budget, pool, purchases, spent, actions, extra });
        }

        // --- lettura stato -------------------------------------------------

        const view = {
            get budget() { return budget; },
            get pool() { return pool; },
            get purchases() { return purchases; },
            get spent() { return spent; },
            get actions() { return actions; },
            get extra() { return extra; },
            set extra(v) { extra = v || {}; },

            /** Crediti ancora spendibili. */
            left() { return budget - spent; },

            /** Somma dei massimali ancora in lista. */
            sumMax() { return pool.reduce((a, p) => a + (p.max || 0), 0); },

            /**
             * Con la ridistribuzione attiva questo deve restare uguale al budget
             * per tutta l'asta: è il controllo che i crediti non si perdano.
             */
            allocated() { return view.sumMax() + spent; },

            countsByRole() {
                const c = { P: 0, D: 0, C: 0, A: 0 };
                for (const p of pool) if (p.role in c) c[p.role]++;
                return c;
            },

            find(name) {
                const key = norm(name);
                return pool.find(p => norm(p.name) === key) || null;
            },

            bought(name) {
                const key = norm(name);
                return purchases.find(p => norm(p.name) === key) || null;
            },

            candidates(query) { return findCandidates(query, pool); },

            /** Il giocatore col massimale più alto ancora in lista. */
            nextByMax() { return pool.length ? sortByMaxDesc(pool)[0] : null; },

            randomPlayer() {
                if (!pool.length) return null;
                return pool[Math.floor(Math.random() * pool.length)];
            },
        };

        // --- consiglio sul rilancio ----------------------------------------

        /**
         * Dato quanto sta offrendo un altro, dice se rilanciare e a quanto.
         * @returns {{status:'bid'|'stop'|'invalid'|'unknown'|'already-bought', bid:number|null, max:number|null}}
         */
        function bidAdvice(nameOrPlayer, currentOffer) {
            const player = typeof nameOrPlayer === 'string' ? view.find(nameOrPlayer) : nameOrPlayer;

            if (typeof nameOrPlayer === 'string' && view.bought(nameOrPlayer)) {
                return { status: 'already-bought', bid: null, max: null };
            }
            if (!player) return { status: 'unknown', bid: null, max: null };

            const cur = currentOffer === '' || currentOffer === null || currentOffer === undefined
                ? 0
                : toInt(currentOffer);
            if (cur === null || cur < 0) return { status: 'invalid', bid: null, max: player.max };

            let next = cur <= 0 ? 1 : cur + 1;
            if (next > player.max) return { status: 'stop', bid: null, max: player.max };

            // Regola del 36: se il tetto è alto e siamo ancora bassi, si salta
            // direttamente a 36 per scoraggiare i rilanci a un credito per volta.
            if (cfg.easterEgg && player.max > 37 && cur < 35) next = 36;

            return { status: 'bid', bid: next, max: player.max };
        }

        // --- azioni --------------------------------------------------------

        /** Registra un acquisto e ridistribuisce la differenza col tuo massimale. */
        function win(name, priceRaw) {
            const player = view.find(name);
            if (!player) return fail(`"${name}" non è nella lista dei giocatori rimasti.`);

            const price = toInt(priceRaw);
            if (price === null || price < 0) return fail('Prezzo non valido.');
            if (view.bought(name)) return fail(`"${player.name}" risulta già acquistato.`);
            if (spent + price > budget) {
                return fail(`Budget insufficiente: residuo ${view.left()}, prezzo ${price}.`);
            }

            const snapshot = { name: player.name, max: player.max, role: player.role };
            removeFromPool(player.name);

            // Positivo se l'hai preso sotto il tuo tetto, negativo se hai sforato.
            const leftover = snapshot.max - price;
            const redistribution = credits.redistribute(pool, leftover, cfg.redistribution);

            purchases.push({ name: snapshot.name, price, max: snapshot.max, role: snapshot.role });
            spent += price;
            actions.push({ type: 'win', player: snapshot, price, changes: redistribution.changes });
            persist();

            return {
                ok: true,
                player: snapshot,
                price,
                over: price > snapshot.max,
                redistribution,
                unabsorbed: redistribution.requested - redistribution.distributed,
            };
        }

        /** Il giocatore è andato a un altro: fuori dalla lista, crediti agli altri. */
        function lose(name) {
            const player = view.find(name);
            if (!player) return fail(`"${name}" non è nella lista dei giocatori rimasti.`);

            const snapshot = { name: player.name, max: player.max, role: player.role };
            removeFromPool(player.name);

            const redistribution = credits.redistribute(pool, snapshot.max, cfg.redistribution);
            actions.push({ type: 'loss', player: snapshot, changes: redistribution.changes });
            persist();

            return {
                ok: true,
                player: snapshot,
                redistribution,
                unabsorbed: redistribution.requested - redistribution.distributed,
            };
        }

        /**
         * Annulla l'ultima azione: rollback della ridistribuzione, poi il
         * giocatore torna in lista. L'ordine conta: prima i massimali degli
         * altri, poi il rientro, altrimenti si rischia di riscrivere il suo max.
         */
        function undo() {
            if (!actions.length) return fail('Nessuna azione da annullare.');
            const last = actions.pop();

            credits.revert(pool, last.changes);

            if (last.type === 'win') {
                const idx = purchases.findIndex(p => norm(p.name) === norm(last.player.name));
                if (idx !== -1) {
                    spent -= purchases[idx].price;
                    purchases.splice(idx, 1);
                }
            }

            if (!view.find(last.player.name)) {
                pool.push({ name: last.player.name, max: last.player.max, role: last.player.role });
            }

            persist();
            return { ok: true, action: last };
        }

        function removeFromPool(name) {
            const key = norm(name);
            const before = pool.length;
            pool = pool.filter(p => norm(p.name) !== key);
            return pool.length !== before;
        }

        /** Torna alla lista di partenza, azzerando acquisti e cronologia. */
        function reset() {
            pool = clone(initial);
            purchases = [];
            spent = 0;
            actions = [];
            extra = {};
            persist();
            return { ok: true };
        }

        /** Sostituisce la lista giocatori (import da file o modifica manuale). */
        function loadPlayers(list) {
            const { players, problems } = normalizePlayers(list);
            if (!players.length) return fail(`Lista vuota o non valida. ${problems.join(' ')}`.trim());
            pool = players;
            purchases = [];
            spent = 0;
            actions = [];
            persist();
            return { ok: true, count: players.length, problems };
        }

        function setBudget(value) {
            const n = toInt(value);
            if (n === null || n < 0) return fail('Budget non valido.');
            if (n < spent) return fail(`Budget più basso di quanto già speso (${spent}).`);
            budget = n;
            persist();
            return { ok: true, budget };
        }

        // --- persistenza ---------------------------------------------------

        /** Ricarica lo stato salvato. Se manca o è incoerente, non tocca niente. */
        function restore() {
            if (!store) return false;
            const s = store.load();
            if (!s || !Array.isArray(s.pool) || !Array.isArray(s.purchases)) return false;

            const restoredPool = normalizePlayers(s.pool).players;
            const restoredPurchases = Array.isArray(s.purchases)
                ? s.purchases.filter(p => p && p.name && toInt(p.price) !== null)
                    .map(p => ({ name: String(p.name), price: toInt(p.price), max: toInt(p.max), role: p.role }))
                : [];

            budget = toInt(s.budget) ?? budget;
            pool = restoredPool;
            purchases = restoredPurchases;
            spent = restoredPurchases.reduce((a, p) => a + p.price, 0);
            actions = Array.isArray(s.actions) ? s.actions : [];
            extra = (s.extra && typeof s.extra === 'object') ? s.extra : {};
            return true;
        }

        function clearSaved() { return store ? store.clear() : false; }

        // --- export --------------------------------------------------------

        /**
         * Colonne adattive: il ruolo compare solo se la lista ce l'ha, e il tuo
         * massimale solo se non è un dato da tenere per te (mercato di riparazione).
         */
        function csvRows() {
            const withRole = purchases.some(p => !!p.role);
            const withMax = !cfg.hideMaxInCsv;

            const header = ['Nome'];
            if (withRole) header.push('Ruolo');
            header.push('Prezzo');
            if (withMax) header.push('Tuo massimale');

            const rows = [header];
            for (const p of purchases) {
                const row = [p.name];
                if (withRole) row.push(p.role || '');
                row.push(String(p.price));
                if (withMax) row.push(p.max === null || p.max === undefined ? '' : String(p.max));
                rows.push(row);
            }

            const pad = (label, value) => {
                const row = [label];
                if (withRole) row.push('');
                row.push(String(value));
                if (withMax) row.push('');
                return row;
            };

            rows.push([]);
            rows.push(pad('Budget', budget));
            rows.push(pad('Totale speso', spent));
            rows.push(pad('Residuo', view.left()));
            return rows;
        }

        function exportCSV(prefix) {
            if (!purchases.length) return fail('Nessun acquisto da esportare.');
            csv.download(csv.stampedName(prefix || 'acquisti'), csv.toCSV(csvRows()));
            return { ok: true };
        }

        function fail(message) { return { ok: false, message }; }

        return Object.assign(view, {
            config: cfg,
            bidAdvice,
            win,
            lose,
            undo,
            reset,
            loadPlayers,
            setBudget,
            restore,
            persist,
            clearSaved,
            csvRows,
            exportCSV,
            storageAvailable: !!(store && store.available),
        });
    }

    const api = { createEngine, normalizePlayers, VALID_ROLES };

    global.FC = global.FC || {};
    global.FC.engine = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
