/**
 * Helper d'asta principale: collega il motore condiviso alla pagina index.html.
 * Qui dentro c'è solo interfaccia — tutte le regole stanno in core/engine.js.
 */
;(function (global) {
    'use strict';

    const { engine: engineApi, credits, text } = global.FC;
    const { PLAYERS, AUCTION_BUDGET } = global.FC.playersData;

    const $ = (id) => document.getElementById(id);

    const engine = engineApi.createEngine({
        budget: AUCTION_BUDGET,
        players: PLAYERS,
        redistribution: { strategy: 'spread', min: 1 },
        storageKey: 'fantacalcio:asta:2026-2027',
        storageVersion: 1,
        easterEgg: true,
        // Di default la rosa da riempire è lunga quanto la lista: modificabile
        // dalle impostazioni se la tua lista è più larga della rosa.
        rosterSize: PLAYERS.length,
    });

    /** Giocatore attualmente in asta e ultimo rilancio consigliato per lui. */
    let current = null;
    let suggested = null;

    // --- helper di output ---------------------------------------------------

    /**
     * Scrive un messaggio in un riquadro .out. Usa textContent per i nomi:
     * la lista è un file che modifichi a mano, ma non è un buon motivo per
     * iniettare HTML arbitrario nella pagina.
     */
    function say(el, message, tone) {
        el.textContent = message;
        el.classList.remove('is-ok', 'is-warn', 'is-error');
        if (tone) el.classList.add(`is-${tone}`);
    }

    /** "Hojlund (A, Napoli)" — ruolo e squadra compaiono solo se la lista li ha. */
    function describePlayer(p) {
        const details = [p.role, p.team].filter(Boolean).join(', ');
        return details ? `${p.name} (${details})` : p.name;
    }

    // --- rendering ----------------------------------------------------------

    function render() {
        const c = engine.countsByRole();
        $('countP').textContent = `P: ${c.P}`;
        $('countD').textContent = `D: ${c.D}`;
        $('countC').textContent = `C: ${c.C}`;
        $('countA').textContent = `A: ${c.A}`;
        $('sumNow').textContent = `Somma tetti: ${engine.sumMax()}`;
        $('budgetLeft').textContent = `Crediti residui: ${engine.left()}`;
        $('playersLeft').textContent = `In lista: ${engine.pool.length}`;
        $('slotsLeft').textContent = engine.rosterSize
            ? `Da comprare: ${engine.slotsLeft()}`
            : 'Da comprare: —';
        $('spentPill').textContent = `Speso: ${engine.spent}`;
        $('leftPill').textContent = `Residuo: ${engine.left()}`;
        $('budgetInput').value = String(engine.budget);
        $('rosterInput').value = String(engine.rosterSize);
        renderCap();

        renderPurchases();
        renderRemaining();
        renderBanner();
    }

    /**
     * La pillola col limite vero di spesa. Diventa rossa quando non basterebbe
     * più nemmeno a completare la rosa a 1 credito a testa.
     */
    function renderCap() {
        const pill = $('maxSpend');
        const cap = engine.maxSpendable();
        const slots = engine.slotsLeft();
        pill.textContent = `Max spendibile: ${cap}`;
        pill.classList.toggle('pill-danger', slots > 0 && cap < 1);
        pill.title = slots > 0
            ? `Ti restano ${engine.left()} crediti e ${slots} giocatori da comprare: ${engine.reserve()} li tieni da parte per gli slot successivi.`
            : `Nessuna riserva impostata: puoi arrivare fino al residuo di ${engine.left()}.`;
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
            if (p.max !== null && p.max !== undefined && p.price > p.max) {
                price.classList.add('over');
                price.title = `Sopra il tuo tetto di ${p.max}`;
            }
            li.append(label, price);
            list.appendChild(li);
        }
    }

    function renderRemaining() {
        const list = $('leftList');
        list.textContent = '';
        for (const p of text.sortByRole(engine.pool)) {
            const li = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = describePlayer(p);
            const max = document.createElement('strong');
            max.textContent = String(p.max);
            li.append(label, max);
            list.appendChild(li);
        }
    }

    /**
     * Avvisa quando "somma tetti + speso" non fa più il budget. Con la
     * ridistribuzione attiva le due cose devono coincidere: se non coincidono
     * o la lista di partenza non quadrava, o dei crediti non sono stati
     * assorbiti perché la lista si è svuotata.
     */
    function renderBanner() {
        const banner = $('banner');
        const diff = engine.allocated() - engine.budget;
        if (diff === 0) {
            banner.hidden = true;
            return;
        }
        banner.hidden = false;
        banner.className = 'banner ' + (diff > 0 ? 'banner-warn' : 'banner-info');
        banner.textContent = diff > 0
            ? `⚠️ Stai pianificando ${diff} crediti più del budget: somma tetti ${engine.sumMax()} + speso ${engine.spent} = ${engine.allocated()}, budget ${engine.budget}.`
            : `ℹ️ Ti restano ${-diff} crediti non assegnati a nessun giocatore in lista.`;
    }

    // --- gestione asta ------------------------------------------------------

    function openAuction(player, startOffer) {
        current = player;
        suggested = null;
        $('playerInfo').textContent = describePlayer(player);
        $('currentOffer').value = startOffer === undefined ? '' : String(startOffer);
        $('finalPrice').value = '';
        say($('outAuction'), '');
        $('auctionSection').hidden = false;
        $('auctionSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        $('currentOffer').focus();
    }

    function closeAuction() {
        current = null;
        suggested = null;
        $('auctionSection').hidden = true;
    }

    function calculateBid() {
        if (!current) return;
        const out = $('outAuction');
        const advice = engine.bidAdvice(current, $('currentOffer').value);

        if (advice.status === 'invalid') {
            say(out, '❌ Offerta non valida.', 'error');
            return;
        }

        // Limite duro: non ci sono i crediti, indipendentemente dal piano.
        if (advice.status === 'stop') {
            suggested = null;
            $('finalPrice').value = '';
            const slots = engine.slotsLeft();
            say(out, slots > 1
                ? `⛔ STOP: non puoi superare ${advice.cap}. Ti restano ${engine.left()} crediti e devi ancora comprare ${slots} giocatori.`
                : `⛔ STOP: non puoi superare ${advice.cap}, è tutto quello che ti resta.`, 'error');
            return;
        }

        suggested = advice.bid;
        $('finalPrice').value = String(advice.bid);

        // Sopra il piano ma sostenibile: si può fare, basta saperlo.
        if (advice.status === 'over') {
            say(out, `⚠️ Rilancia a ${advice.bid} se lo vuoi davvero: sono ${advice.overBy} crediti sopra il tuo tetto di ${advice.max}. Puoi arrivare fino a ${advice.cap}, ma li togli agli altri giocatori della lista.`, 'warn');
            return;
        }

        say(out, `💰 Rilancia a ${advice.bid} (il tuo tetto è ${advice.max}, il limite di spesa ${advice.cap}).`, 'ok');
    }

    function confirmWin() {
        if (!current) return;
        const out = $('outAuction');
        const raw = $('finalPrice').value;
        const price = raw === '' ? suggested : text.toInt(raw);

        if (price === null || price === undefined) {
            say(out, '❌ Inserisci il prezzo finale pagato (o premi prima "Calcola la mia offerta").', 'error');
            return;
        }

        const name = current.name;
        const res = engine.win(name, price);
        if (!res.ok) {
            say(out, `❌ ${res.message}`, 'error');
            return;
        }

        const parts = [`🎉 Preso ${res.player.name} per ${res.price}.`];
        if (res.over) parts.push(`Sforato di ${res.price - res.player.max} sul tuo tetto di ${res.player.max}: i crediti li recuperi dagli altri.`);
        if (res.redistribution.changes.length) parts.push(credits.describe(res.redistribution) + '.');
        if (res.unabsorbed) {
            parts.push(res.unabsorbed > 0
                ? `${res.unabsorbed} crediti non assegnati: lista troppo corta.`
                : `⚠️ ${-res.unabsorbed} crediti di sforamento non recuperabili: gli altri sono già tutti a 1.`);
        }

        say($('outBuy'), parts.join(' '), res.over ? 'warn' : 'ok');
        closeAuction();
        render();
        flashLastPurchase();
    }

    function confirmLoss() {
        if (!current) return;
        const res = engine.lose(current.name);
        if (!res.ok) {
            say($('outAuction'), `❌ ${res.message}`, 'error');
            return;
        }
        const parts = [`😞 ${res.player.name} è andato ad altri, tolto dalla lista.`];
        if (res.redistribution.changes.length) parts.push(credits.describe(res.redistribution) + '.');
        say($('outBuy'), parts.join(' '), 'warn');
        closeAuction();
        render();
    }

    function flashLastPurchase() {
        const li = $('purchasesList').lastElementChild;
        if (!li || li.classList.contains('empty')) return;
        li.classList.add('flash-add');
        li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => li.classList.remove('flash-add'), 1600);
    }

    // --- eventi -------------------------------------------------------------

    function search() {
        const out = $('outCheck');
        const q = $('q').value;
        const matches = engine.candidates(q);

        if (!matches.length) {
            closeAuction();
            const already = engine.bought(q);
            say(out, already
                ? `ℹ️ "${already.name}" l'hai già preso per ${already.price}.`
                : `❌ "${q}" non è (più) nella tua lista.`, already ? 'warn' : 'error');
            return;
        }
        if (matches.length > 1) {
            closeAuction();
            say(out, `⚠️ Più match, sii più preciso:\n- ${matches.map(m => m.name).join('\n- ')}`, 'warn');
            return;
        }
        say(out, `✅ Trovato: ${describePlayer(matches[0])}`, 'ok');
        openAuction(matches[0]);
    }

    $('btnCheck').addEventListener('click', search);
    $('q').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); search(); }
    });

    $('btnClear').addEventListener('click', () => {
        $('q').value = '';
        say($('outCheck'), '');
        closeAuction();
        $('q').focus();
    });

    $('btnRandom').addEventListener('click', () => {
        const p = engine.randomPlayer();
        if (!p) { say($('outRandom'), '❌ Lista vuota: non è rimasto nessuno.', 'error'); return; }
        say($('outRandom'), `🎯 Estratto: ${describePlayer(p)}`, 'ok');
        openAuction(p, 1);
    });

    $('btnNext').addEventListener('click', () => {
        const p = engine.nextByMax();
        if (!p) { say($('outRandom'), '❌ Lista vuota: non è rimasto nessuno.', 'error'); return; }
        say($('outRandom'), `➡️ Il più caro rimasto: ${describePlayer(p)}`, 'ok');
        openAuction(p, 1);
    });

    $('btnCalculateBid').addEventListener('click', calculateBid);
    $('currentOffer').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); calculateBid(); }
    });

    $('btnPlayerWon').addEventListener('click', confirmWin);
    $('btnPlayerLost').addEventListener('click', confirmLoss);
    $('btnCancelAuction').addEventListener('click', closeAuction);

    $('btnShowLeft').addEventListener('click', () => {
        const wrap = $('leftWrap');
        wrap.hidden = !wrap.hidden;
        if (!wrap.hidden) { wrap.open = true; renderRemaining(); }
    });

    $('btnReset').addEventListener('click', () => {
        if (!confirm('Reset totale: ripristina la lista di partenza e cancella tutti gli acquisti. Procedo?')) return;
        engine.reset();
        closeAuction();
        say($('outBuy'), '');
        say($('outCheck'), '');
        say($('outRandom'), '');
        say($('outSettings'), '✅ Reset completato.', 'ok');
        render();
    });

    $('btnUndo').addEventListener('click', () => {
        const res = engine.undo();
        if (!res.ok) { say($('outBuy'), `⚠️ ${res.message}`, 'warn'); return; }
        const label = res.action.type === 'win'
            ? `acquisto di ${res.action.player.name} per ${res.action.price}`
            : `"andato ad altri" di ${res.action.player.name}`;
        say($('outBuy'), `↩️ Annullato: ${label}. Rimesso in lista con tetto ${res.action.player.max}.`, 'ok');
        closeAuction();
        render();
    });

    $('btnExportCSV').addEventListener('click', () => {
        const res = engine.exportCSV('acquisti_fantacalcio');
        say($('outBuy'), res.ok ? '📦 CSV esportato.' : `⚠️ ${res.message}`, res.ok ? 'ok' : 'warn');
    });

    $('btnSetBudget').addEventListener('click', () => {
        const esiti = [engine.setBudget($('budgetInput').value), engine.setRosterSize($('rosterInput').value)];
        const errori = esiti.filter(r => !r.ok);
        render();
        if (errori.length) {
            say($('outSettings'), errori.map(r => `❌ ${r.message}`).join('\n'), 'error');
            return;
        }
        const rosa = engine.rosterSize
            ? `rosa da ${engine.rosterSize} (te ne mancano ${engine.slotsLeft()}), puoi spendere fino a ${engine.maxSpendable()} sul prossimo`
            : 'nessuna riserva per la rosa';
        say($('outSettings'), `✅ Budget ${engine.budget}, ${rosa}.`, 'ok');
    });

    // --- avvio --------------------------------------------------------------

    const restored = engine.restore();
    render();

    if (restored && (engine.purchases.length || engine.actions.length)) {
        say($('outBuy'), `↺ Ripreso il lavoro salvato: ${engine.purchases.length} acquisti, ${engine.spent} crediti spesi. Usa "Reset totale" per ricominciare.`, 'ok');
    } else if (!engine.storageAvailable) {
        say($('outSettings'), '⚠️ Il browser non permette di salvare: se ricarichi la pagina perdi tutto.', 'warn');
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
