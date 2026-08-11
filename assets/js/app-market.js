/**
 * Mercato di riparazione: stesso motore dell'asta principale, UI diversa.
 *
 * Differenze rispetto a index.html:
 *  - pool unico senza ruoli
 *  - i massimali non vengono MAI scritti a schermo (li vede solo il codice)
 *  - i crediti risparmiati si dividono in parti uguali fra i tre più cari
 */
;(function (global) {
    'use strict';

    const { engine: engineApi, credits, text } = global.FC;
    const { MARKET_POOL, MARKET_BUDGET } = global.FC.marketData;
    const { toInt } = text;

    const $ = (id) => document.getElementById(id);

    const engine = engineApi.createEngine({
        budget: MARKET_BUDGET,
        players: MARKET_POOL,
        redistribution: { strategy: 'even', topN: 3, min: 1 },
        storageKey: 'fantacalcio:riparazione:2026-2027',
        storageVersion: 1,
        easterEgg: false,
        hideMaxInCsv: true, // il CSV non deve rivelare i massimali
    });

    let current = null;

    /** Come nell'asta principale, ma senza mai il massimale. */
    function describePlayer(p) {
        return p.team ? `${p.name} (${p.team})` : p.name;
    }

    function say(el, message, tone) {
        el.textContent = message;
        el.classList.remove('is-ok', 'is-warn', 'is-error');
        if (tone) el.classList.add(`is-${tone}`);
    }

    /** Storico delle offerte altrui, tenuto nello stato persistito del motore. */
    function offers() {
        if (!Array.isArray(engine.extra.offers)) engine.extra.offers = [];
        return engine.extra.offers;
    }

    // --- rendering ----------------------------------------------------------

    function render() {
        $('spentPill').textContent = `Speso: ${engine.spent}`;
        $('leftPill').textContent = `Residuo: ${engine.left()}`;
        $('poolPill').textContent = `In lista: ${engine.pool.length}`;
        $('budgetInput').value = String(engine.budget);
        renderPurchases();
        renderOffers();
    }

    function renderPurchases() {
        const list = $('purchasesList');
        list.textContent = '';
        if (!engine.purchases.length) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'Ancora nessun acquisto.';
            list.appendChild(li);
            return;
        }
        for (const p of engine.purchases) {
            const li = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = describePlayer(p);
            const price = document.createElement('strong');
            price.textContent = String(p.price);
            li.append(label, price);
            list.appendChild(li);
        }
    }

    /** Nota: qui non si stampa mai nulla che riveli un massimale. */
    function renderOffers() {
        const list = $('offersList');
        list.textContent = '';
        const labels = {
            bid: (o) => `rilancia a ${o.suggestion}`,
            over: (o) => `rilancia a ${o.suggestion}, ma sfori`,
            stop: () => 'STOP, crediti finiti',
            unknown: () => 'non ci interessa',
            'already-bought': () => 'già preso',
            invalid: () => 'offerta non valida',
        };
        for (const o of offers().slice().reverse()) {
            const li = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = `${o.name} @ ${o.currentOffer}`;
            const verdict = document.createElement('strong');
            verdict.textContent = (labels[o.status] || (() => o.status))(o);
            if (o.status !== 'bid') verdict.classList.add('over');
            li.title = o.status === 'over' ? 'Sostenibile, ma fuori dal piano' : '';
            li.append(label, verdict);
            list.appendChild(li);
        }
    }

    // --- asta ---------------------------------------------------------------

    function openAuction(player) {
        current = player;
        $('playerInfo').textContent = describePlayer(player);
        $('currentOffer').value = '1';
        say($('outAuction'), '');
        $('auctionSection').hidden = false;
        $('auctionSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        $('currentOffer').focus();
    }

    function closeAuction() {
        current = null;
        $('auctionSection').hidden = true;
    }

    /**
     * Qui il campo è "la mia offerta", non l'offerta degli altri.
     *
     * Il massimale si può sforare, ma i crediti no. I messaggi non contengono
     * mai il massimale: dicono solo se sei dentro o fuori dal piano.
     */
    function checkOwnBid() {
        if (!current) return { ok: false, message: 'Nessun giocatore in asta.' };
        const raw = ($('currentOffer').value || '').trim();
        const bid = raw === '' ? 1 : toInt(raw);
        if (bid === null || bid < 1) return { ok: false, message: 'Offerta non valida.' };

        if (bid > engine.maxSpendable()) {
            return { ok: false, message: `Non arrivi a ${bid}: ti restano ${engine.left()} crediti.` };
        }
        if (bid > current.max) {
            return { ok: true, bid, over: true, message: `${bid} è oltre il tuo massimo, ma te lo puoi permettere.` };
        }
        return { ok: true, bid, over: false, message: `Ok, puoi offrire ${bid}.` };
    }

    $('btnNextCall').addEventListener('click', () => {
        const p = engine.nextByMax();
        if (!p) { say($('outCheck'), '❌ Pool vuoto.', 'error'); closeAuction(); return; }
        say($('outCheck'), `➡️ Prossimo: ${describePlayer(p)}`, 'ok');
        openAuction(p);
    });

    $('btnSuggest').addEventListener('click', () => {
        const res = checkOwnBid();
        if (!res.ok) { say($('outAuction'), `⛔ ${res.message}`, 'warn'); return; }
        say($('outAuction'), res.over ? `⚠️ ${res.message}` : `💰 ${res.message}`, res.over ? 'warn' : 'ok');
    });

    $('currentOffer').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); $('btnSuggest').click(); }
    });

    $('btnWon').addEventListener('click', () => {
        if (!current) return;
        const check = checkOwnBid();
        if (!check.ok) { say($('outAuction'), `⛔ ${check.message}`, 'warn'); return; }

        const res = engine.win(current.name, check.bid);
        if (!res.ok) { say($('outAuction'), `❌ ${res.message}`, 'error'); return; }

        const parts = [`🎉 Vinto ${res.player.name} a ${res.price}.`];
        if (res.over) parts.push('Sopra il tuo massimo: i crediti vengono recuperati dagli altri.');
        else if (res.redistribution.changes.length) parts.push('Crediti risparmiati redistribuiti sui prossimi.');
        say($('outBuy'), parts.join(' '), res.over ? 'warn' : 'ok');
        closeAuction();
        render();
    });

    $('btnLost').addEventListener('click', () => {
        if (!current) return;
        const res = engine.lose(current.name);
        if (!res.ok) { say($('outAuction'), `❌ ${res.message}`, 'error'); return; }
        const parts = [`😞 Perso ${res.player.name}, tolto dal pool.`];
        if (res.redistribution.changes.length) parts.push('Crediti redistribuiti sui tre più cari rimasti.');
        say($('outBuy'), parts.join(' '), 'warn');
        closeAuction();
        render();
    });

    // --- offerte degli altri ------------------------------------------------

    $('btnAddOffer').addEventListener('click', () => {
        const name = ($('offerName').value || '').trim();
        const raw = ($('offerCurrent').value || '').trim();
        const cur = raw === '' ? 0 : toInt(raw);

        if (!name) { say($('outOffers'), '❌ Inserisci un nome.', 'error'); return; }
        if (cur === null || cur < 0) { say($('outOffers'), '❌ Offerta attuale non valida.', 'error'); return; }

        const advice = engine.bidAdvice(name, cur);
        offers().push({ name, currentOffer: cur, suggestion: advice.bid, status: advice.status, at: Date.now() });
        if (offers().length > 50) engine.extra.offers = offers().slice(-50);
        engine.persist();
        renderOffers();

        // Nessun messaggio cita il massimale: `advice.overBy` lo rivelerebbe.
        const messages = {
            bid: [`✅ Rilancia a ${advice.bid}.`, 'ok'],
            over: [`⚠️ Rilancia a ${advice.bid} solo se lo vuoi davvero: sei oltre il tuo massimo.`, 'warn'],
            stop: [`⛔ STOP: non ti bastano i crediti (${engine.left()} rimasti).`, 'warn'],
            unknown: ['🚫 Non ci interessa: non è nella tua lista.', 'warn'],
            'already-bought': ['ℹ️ Già acquistato.', 'warn'],
            invalid: ['❌ Offerta non valida.', 'error'],
        };
        const [msg, tone] = messages[advice.status] || ['❓ Non so cosa dirti.', 'warn'];
        say($('outOffers'), msg, tone);
    });

    $('btnClearOffers').addEventListener('click', () => {
        engine.extra.offers = [];
        engine.persist();
        renderOffers();
        say($('outOffers'), '🧹 Storico offerte svuotato.', 'ok');
    });

    // --- resto --------------------------------------------------------------

    $('btnResetAll').addEventListener('click', () => {
        if (!confirm('Reset: ripristina il pool di partenza e azzera gli acquisti. Procedo?')) return;
        engine.reset();
        closeAuction();
        say($('outCheck'), '✅ Reset completato.', 'ok');
        say($('outBuy'), '');
        say($('outOffers'), '');
        render();
    });

    $('btnUndo').addEventListener('click', () => {
        const res = engine.undo();
        if (!res.ok) { say($('outBuy'), `⚠️ ${res.message}`, 'warn'); return; }
        const label = res.action.type === 'win'
            ? `acquisto di ${res.action.player.name} per ${res.action.price}`
            : `"perso" di ${res.action.player.name}`;
        say($('outBuy'), `↩️ Annullato: ${label}. Rimesso nel pool.`, 'ok');
        closeAuction();
        render();
    });

    $('btnExportCSV').addEventListener('click', () => {
        const res = engine.exportCSV('mercato_riparazione');
        say($('outBuy'), res.ok ? '📦 CSV esportato.' : `⚠️ ${res.message}`, res.ok ? 'ok' : 'warn');
    });

    $('btnSetBudget').addEventListener('click', () => {
        const res = engine.setBudget($('budgetInput').value);
        if (!res.ok) { say($('outSettings'), `❌ ${res.message}`, 'error'); render(); return; }
        say($('outSettings'), `✅ Budget impostato a ${res.budget}.`, 'ok');
        render();
    });

    // --- avvio --------------------------------------------------------------

    const restored = engine.restore();
    render();

    if (restored && (engine.purchases.length || engine.actions.length)) {
        say($('outBuy'), `↺ Ripreso il lavoro salvato: ${engine.purchases.length} acquisti, ${engine.spent} crediti spesi.`, 'ok');
    } else if (!engine.storageAvailable) {
        say($('outSettings'), '⚠️ Il browser non permette di salvare: se ricarichi la pagina perdi tutto.', 'warn');
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
