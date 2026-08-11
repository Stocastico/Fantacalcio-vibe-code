/**
 * Ridistribuzione dei crediti fra i giocatori ancora in lista.
 *
 * L'idea: il budget è un totale chiuso. Se un giocatore lo perdi, o lo prendi
 * sotto il tuo massimale, i crediti che avevi messo da parte per lui devono
 * finire da qualche altra parte, altrimenti a fine asta ti ritrovi con soldi
 * in mano e nessuno da comprare.
 *
 * L'invariante che teniamo è: somma dei massimali rimasti + speso == budget.
 *
 * Due strategie:
 *  - 'spread': +1 a rotazione partendo dai più costosi (asta principale)
 *  - 'even':   diviso in parti uguali fra i primi N (mercato di riparazione)
 *
 * Se l'importo è negativo (hai pagato più del tuo massimale) i crediti vengono
 * tolti, non aggiunti, così lo sforamento se lo pagano i giocatori successivi
 * invece di sparire nel nulla.
 */
;(function (global) {
    'use strict';

    const text = (typeof module !== 'undefined' && module.exports)
        ? require('./text.js')
        : global.FC.text;

    const { norm, toInt, sortByMaxDesc } = text;

    const DEFAULTS = { strategy: 'spread', topN: 3, min: 1 };

    /**
     * Applica `amount` crediti al pool, mutando i massimali.
     *
     * @returns {{requested:number, distributed:number, changes:Array<{name:string,oldMax:number,newMax:number}>}}
     *   `changes` serve all'undo per rimettere tutto com'era.
     *   Se `distributed` è diverso da `requested` vuol dire che il pool non ha
     *   potuto assorbire tutto (pool vuoto, o tutti già al minimo).
     */
    function redistribute(pool, amountRaw, options) {
        const opts = Object.assign({}, DEFAULTS, options);
        const amount = toInt(amountRaw);

        if (!Array.isArray(pool) || pool.length === 0 || !amount) {
            return { requested: amount || 0, distributed: 0, changes: [] };
        }

        const before = new Map();
        const touch = (p) => { if (!before.has(p)) before.set(p, p.max); };
        let applied = 0;

        if (amount > 0 && opts.strategy === 'even') {
            const targets = sortByMaxDesc(pool).slice(0, Math.max(1, opts.topN));
            const each = Math.floor(amount / targets.length);
            const rest = amount % targets.length;
            targets.forEach((p, i) => {
                const add = each + (i < rest ? 1 : 0);
                if (add <= 0) return;
                touch(p);
                p.max += add;
                applied += add;
            });
        } else if (amount > 0) {
            // 'spread': un credito alla volta, a rotazione, dal più caro al meno caro.
            // Il vecchio codice si fermava dopo un giro solo e i crediti in eccesso
            // sparivano; qui gira finché non ha assegnato tutto.
            const targets = sortByMaxDesc(pool);
            for (let i = 0; i < amount; i++) {
                const p = targets[i % targets.length];
                touch(p);
                p.max += 1;
                applied += 1;
            }
        } else {
            // Sforamento: togliamo un credito alla volta a chi in quel momento ha
            // il massimale più alto, senza mai scendere sotto `min`.
            let toRemove = -amount;
            while (toRemove > 0) {
                const victim = highestAbove(pool, opts.min);
                if (!victim) break; // nessuno può più cedere crediti
                touch(victim);
                victim.max -= 1;
                applied -= 1;
                toRemove -= 1;
            }
        }

        const changes = [];
        for (const [player, oldMax] of before) {
            if (player.max !== oldMax) changes.push({ name: player.name, oldMax, newMax: player.max });
        }

        return { requested: amount, distributed: applied, changes };
    }

    /** Giocatore col massimale più alto strettamente sopra `min`, null se non esiste. */
    function highestAbove(pool, min) {
        let best = null;
        for (const p of pool) {
            if (p.max <= min) continue;
            if (!best || p.max > best.max || (p.max === best.max && p.name.localeCompare(best.name, 'it') < 0)) {
                best = p;
            }
        }
        return best;
    }

    /** Rimette i massimali com'erano prima di una ridistribuzione. Usato dall'undo. */
    function revert(pool, changes) {
        if (!Array.isArray(pool) || !Array.isArray(changes)) return 0;
        let restored = 0;
        for (const c of changes) {
            const p = pool.find(x => norm(x.name) === norm(c.name));
            if (p && typeof c.oldMax === 'number') {
                p.max = c.oldMax;
                restored++;
            }
        }
        return restored;
    }

    /** Riassunto leggibile di una ridistribuzione, per i messaggi a schermo. */
    function describe(result) {
        if (!result || !result.changes.length) return '';
        const verb = result.distributed >= 0 ? 'ridistribuiti' : 'recuperati';
        const detail = result.changes.map(c => `${c.name} ${c.oldMax}→${c.newMax}`).join(', ');
        return `${Math.abs(result.distributed)} crediti ${verb} (${detail})`;
    }

    const api = { redistribute, revert, describe, DEFAULTS };

    global.FC = global.FC || {};
    global.FC.credits = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
