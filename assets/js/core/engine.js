/**
 * Motore d'asta condiviso fra l'helper principale e il mercato di riparazione.
 *
 * Qui dentro non si tocca il DOM: è tutta logica pura, così i test girano in
 * node senza browser e le due pagine possono avere UI diverse sopra lo stesso
 * comportamento.
 *
 * Modello dati unico: ogni giocatore è { name, max, role?, team? }.
 *  - `max`  è il tuo tetto di spesa, non il prezzo di listino
 *  - `role` (P/D/C/A) è opzionale: il mercato di riparazione ha un pool unico
 *  - `team` è opzionale, serve solo a distinguere gli omonimi a colpo d'occhio
 *
 * Il `max` è un piano, non un vincolo: in asta lo puoi sforare. Il limite duro è
 * `maxSpendable()`, cioè i crediti rimasti meno quelli da tenere da parte per
 * riuscire comunque a riempire la rosa.
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
     * Porta una lista qualsiasi nella forma { name, max, role, team }.
     * Accetta sia `max` che `bid` (il nome usato nelle stagioni precedenti) e
     * sia `team` che `squadra`. Scarta le righe inutilizzabili e i doppioni,
     * riportando cosa ha scartato.
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

            const role = String(raw.role ?? raw.ruolo ?? '').toUpperCase();
            const team = String(raw.team ?? raw.squadra ?? '').trim();
            players.push({
                name,
                max,
                role: VALID_ROLES.includes(role) ? role : undefined,
                team: team || undefined,
            });
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
     *   rosterSize        quanti giocatori devi avere a fine asta; serve a tenere
     *                     da parte 1 credito per ogni slot ancora vuoto. 0 = nessuna
     *                     riserva, il limite è solo il residuo.
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
            rosterSize: 0,
        }, config);

        const initial = normalizePlayers(cfg.players).players;
        const store = cfg.storageKey
            ? storage.createStore(cfg.storageKey, { version: cfg.storageVersion, backend: cfg.storageBackend })
            : null;

        let budget = toInt(cfg.budget) ?? 500;
        let rosterSize = Math.max(0, toInt(cfg.rosterSize) ?? 0);
        let pool = clone(initial);
        let purchases = [];
        let spent = 0;
        let actions = [];   // log per l'undo, in ordine cronologico
        let extra = {};     // spazio libero per stato specifico della singola pagina

        function clone(list) {
            return list.map(p => ({ name: p.name, max: p.max, role: p.role, team: p.team }));
        }

        /** Copia dei dati identificativi di un giocatore, senza il riferimento all'oggetto nel pool. */
        function snapshot(p) {
            return { name: p.name, max: p.max, role: p.role, team: p.team };
        }

        function persist() {
            if (!store) return false;
            return store.save({ budget, rosterSize, pool, purchases, spent, actions, extra });
        }

        // --- lettura stato -------------------------------------------------

        const view = {
            get budget() { return budget; },
            get rosterSize() { return rosterSize; },
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

            /** Slot di rosa ancora da riempire. Zero se non hai fissato una rosa. */
            slotsLeft() { return rosterSize ? Math.max(0, rosterSize - purchases.length) : 0; },

            /**
             * Crediti da tenere da parte per riuscire comunque a riempire la rosa:
             * almeno 1 a testa per ogni slot che resterà vuoto dopo questo acquisto.
             */
            reserve() { return Math.max(0, view.slotsLeft() - 1); },

            /**
             * Il massimo che puoi davvero pagare adesso per un giocatore.
             * È questo il limite vero: il `max` della lista è solo il tuo piano,
             * e in asta lo puoi sforare finché i crediti reggono.
             */
            maxSpendable() { return Math.max(0, view.left() - view.reserve()); },

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
         *
         * Ci sono due soglie diverse e non vanno confuse:
         *  - `max` del giocatore è il tuo piano, sforabile;
         *  - `maxSpendable()` è il limite vero, che dipende dai crediti rimasti
         *    e da quanti giocatori devi ancora comprare.
         *
         * @returns {{status:'bid'|'over'|'stop'|'invalid'|'unknown'|'already-bought',
         *            bid:number|null, max:number|null, cap:number, overBy:number}}
         *   'over' = puoi permettertelo ma stai sforando il piano
         *   'stop' = non puoi permettertelo, punto
         */
        function bidAdvice(nameOrPlayer, currentOffer) {
            const player = typeof nameOrPlayer === 'string' ? view.find(nameOrPlayer) : nameOrPlayer;
            const cap = view.maxSpendable();
            const base = { bid: null, max: null, cap, overBy: 0 };

            if (typeof nameOrPlayer === 'string' && view.bought(nameOrPlayer)) {
                return Object.assign(base, { status: 'already-bought' });
            }
            if (!player) return Object.assign(base, { status: 'unknown' });

            base.max = player.max;

            const cur = currentOffer === '' || currentOffer === null || currentOffer === undefined
                ? 0
                : toInt(currentOffer);
            if (cur === null || cur < 0) return Object.assign(base, { status: 'invalid' });

            let next = cur <= 0 ? 1 : cur + 1;

            // Regola del 36: se il tetto è alto e siamo ancora bassi, si salta
            // direttamente a 36 per scoraggiare i rilanci a un credito per volta.
            if (cfg.easterEgg && player.max > 37 && cur < 35) next = 36;

            if (next > cap) return Object.assign(base, { status: 'stop' });
            if (next > player.max) {
                return Object.assign(base, { status: 'over', bid: next, overBy: next - player.max });
            }
            return Object.assign(base, { status: 'bid', bid: next });
        }

        // --- azioni --------------------------------------------------------

        /** Registra un acquisto e ridistribuisce la differenza col tuo massimale. */
        function win(name, priceRaw) {
            const player = view.find(name);
            if (!player) return fail(`"${name}" non è nella lista dei giocatori rimasti.`);

            const price = toInt(priceRaw);
            if (price === null || price < 0) return fail('Prezzo non valido.');
            if (view.bought(name)) return fail(`"${player.name}" risulta già acquistato.`);

            // Il tetto della lista si può sforare; questo no.
            const cap = view.maxSpendable();
            if (price > cap) {
                const reserve = view.reserve();
                return fail(reserve > 0
                    ? `Puoi spendere al massimo ${cap}: ti restano ${view.left()} crediti e devi tenerne ${reserve} per gli altri ${reserve} giocatori da comprare.`
                    : `Puoi spendere al massimo ${cap}: è tutto quello che ti resta.`);
            }

            const taken = snapshot(player);
            removeFromPool(player.name);

            // Positivo se l'hai preso sotto il tuo tetto, negativo se hai sforato.
            const leftover = taken.max - price;
            const redistribution = credits.redistribute(pool, leftover, cfg.redistribution);

            purchases.push(Object.assign(snapshot(taken), { price }));
            spent += price;
            actions.push({ type: 'win', player: taken, price, changes: redistribution.changes });
            persist();

            return {
                ok: true,
                player: taken,
                price,
                over: price > taken.max,
                redistribution,
                unabsorbed: redistribution.requested - redistribution.distributed,
            };
        }

        /** Il giocatore è andato a un altro: fuori dalla lista, crediti agli altri. */
        function lose(name) {
            const player = view.find(name);
            if (!player) return fail(`"${name}" non è nella lista dei giocatori rimasti.`);

            const gone = snapshot(player);
            removeFromPool(player.name);

            const redistribution = credits.redistribute(pool, gone.max, cfg.redistribution);
            actions.push({ type: 'loss', player: gone, changes: redistribution.changes });
            persist();

            return {
                ok: true,
                player: gone,
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
                pool.push(snapshot(last.player));
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

        /** Quanti giocatori devi avere a fine asta. 0 = nessuna riserva per gli slot. */
        function setRosterSize(value) {
            const n = toInt(value);
            if (n === null || n < 0) return fail('Numero di giocatori non valido.');
            if (n && n < purchases.length) {
                return fail(`Ne hai già comprati ${purchases.length}: la rosa non può essere più piccola.`);
            }
            rosterSize = n;
            persist();
            return { ok: true, rosterSize };
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
                    .map(p => ({ name: String(p.name), price: toInt(p.price), max: toInt(p.max), role: p.role, team: p.team }))
                : [];

            budget = toInt(s.budget) ?? budget;
            rosterSize = Math.max(0, toInt(s.rosterSize) ?? rosterSize);
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
         * Colonne adattive: ruolo e squadra compaiono solo se la lista li ha, e
         * il tuo massimale solo se non è un dato da tenere per te (riparazione).
         */
        function csvRows() {
            const columns = [{ head: 'Nome', of: p => p.name }];
            if (purchases.some(p => p.role)) columns.push({ head: 'Ruolo', of: p => p.role || '' });
            if (purchases.some(p => p.team)) columns.push({ head: 'Squadra', of: p => p.team || '' });
            columns.push({ head: 'Prezzo', of: p => String(p.price), isTotal: true });
            if (!cfg.hideMaxInCsv) {
                columns.push({ head: 'Tuo massimale', of: p => (p.max === null || p.max === undefined ? '' : String(p.max)) });
            }

            const rows = [columns.map(c => c.head)];
            for (const p of purchases) rows.push(columns.map(c => c.of(p)));

            // Le righe di riepilogo mettono l'etichetta nella prima colonna e il
            // numero sotto "Prezzo", così restano allineate qualunque colonna ci sia.
            const summary = (label, value) => columns.map((c, i) => {
                if (i === 0) return label;
                return c.isTotal ? String(value) : '';
            });

            rows.push([]);
            rows.push(summary('Budget', budget));
            rows.push(summary('Totale speso', spent));
            rows.push(summary('Residuo', view.left()));
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
            setRosterSize,
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
