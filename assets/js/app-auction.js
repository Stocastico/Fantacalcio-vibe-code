/**
 * Helper d'asta principale: collega il motore condiviso alla pagina index.html.
 * Qui dentro c'è solo interfaccia — tutte le regole stanno in core/engine.js.
 */
;(function (global) {
    'use strict';

    const { engine: engineApi, credits, text, shortlists: shortlistsApi } = global.FC;
    const { PLAYERS, AUCTION_BUDGET, ROSTER_SIZE } = global.FC.playersData;
    const { ALTERNATIVES, BAITS } = global.FC.shortlistsData;

    const $ = (id) => document.getElementById(id);

    const engine = engineApi.createEngine({
        budget: AUCTION_BUDGET,
        players: PLAYERS,
        redistribution: { strategy: 'spread', min: 1 },
        storageKey: 'fantacalcio:asta:2026-2027',
        storageVersion: 1,
        easterEgg: true,
        // Quanti giocatori devi avere a fine asta: sta in players.js perché è un
        // dato della tua lega, non della lista. Non è la lunghezza della lista —
        // gli slot che avanzano li riempi con acquisti fuori lista.
        rosterSize: ROSTER_SIZE || PLAYERS.length,
    });

    /**
     * Le due liste di supporto. Non passano dal motore: non hanno massimali, non
     * spostano crediti e non finiscono in rosa — sono solo promemoria da tenere
     * davanti in asta. L'unico stato è chi hai già tolto, e viaggia dentro
     * engine.extra così si salva e si azzera insieme a tutto il resto.
     */
    const shortlists = shortlistsApi.createShortlists([
        { id: 'alternatives', label: 'Alternative', players: ALTERNATIVES },
        { id: 'baits', label: "Da chiamare all'inizio", players: BAITS },
    ]);

    /** id della lista → gli elementi della pagina che la mostrano. */
    const SHORTLIST_UI = {
        alternatives: { wrap: 'wrapAlternatives', list: 'listAlternatives', button: 'btnToggleAlternatives' },
        baits: { wrap: 'wrapBaits', list: 'listBaits', button: 'btnToggleBaits' },
    };

    /** Giocatore attualmente in asta e ultimo rilancio consigliato per lui. */
    let current = null;
    let suggested = null;

    /**
     * Modalità riservata: a schermo non compaiono né i tetti di spesa né gli
     * spostamenti di crediti fra un giocatore e l'altro. Sono il tuo piano
     * d'asta, e per chiamare non servono: basta sapere se si può rilanciare e
     * fino a quanto.
     *
     * Parte accesa a ogni apertura della pagina, apposta: se al tavolo ci va
     * qualcun altro al posto tuo, la pagina la trova già chiusa. Non è una
     * cassaforte — chi apre il sorgente del file i numeri li trova — è per non
     * averli sotto gli occhi di tutti.
     */
    let riservato = true;

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

    /**
     * Il dettaglio della ridistribuzione ("Tizio 40→43, Caio 20→22") è l'elenco
     * dei tetti di mezza lista: in modalità riservata resta il fatto, non i numeri.
     */
    function descriviRidistribuzione(res) {
        return riservato
            ? 'I crediti sono stati ridistribuiti fra gli altri giocatori della lista.'
            : credits.describe(res) + '.';
    }

    // --- rendering ----------------------------------------------------------

    function render() {
        const c = engine.countsByRole();
        $('countP').textContent = `P: ${c.P}`;
        $('countD').textContent = `D: ${c.D}`;
        $('countC').textContent = `C: ${c.C}`;
        $('countA').textContent = `A: ${c.A}`;
        $('sumNow').textContent = `Somma tetti: ${engine.sumMax()}`;
        $('sumNow').hidden = riservato;
        renderRiservato();
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
        renderShortlists();
        renderBanner();
    }

    /** Il bottone dice sempre cosa succede se lo premi, e la nota cosa stai nascondendo. */
    function renderRiservato() {
        const btn = $('btnRivela');
        btn.textContent = riservato ? '⛔ Mostra i numeri riservati' : '🙈 Nascondi di nuovo i numeri';
        btn.classList.toggle('emergency', riservato);
        btn.classList.toggle('secondary', !riservato);
        $('notaRiservata').textContent = riservato
            ? 'Tetti di spesa e spostamenti di crediti sono nascosti.'
            : '⚠️ I numeri sono a schermo: occhio a chi ti sta intorno.';
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

            if (p.offList) {
                // Non era fra i desiderati: si vede, ma senza allarmi rossi.
                const tag = document.createElement('span');
                tag.className = 'tag-off';
                tag.textContent = 'fuori lista';
                tag.title = 'Non era nella lista dei giocatori desiderati';
                label.appendChild(tag);
            } else if (p.max !== null && p.max !== undefined && p.price > p.max) {
                price.classList.add('over');
                price.title = riservato ? 'Sopra il tetto previsto per lui' : `Sopra il tuo tetto di ${p.max}`;
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
            li.appendChild(label);
            // Il nome serve a sapere chi chiamare; il tetto no.
            if (!riservato) {
                const max = document.createElement('strong');
                max.textContent = String(p.max);
                li.appendChild(max);
            }
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
        if (riservato) {
            banner.textContent = diff > 0
                ? '⚠️ La lista vale più crediti di quelli disponibili: si gioca lo stesso, ma i tetti sono un po\' ottimisti.'
                : 'ℹ️ Restano crediti non assegnati a nessun giocatore in lista.';
            return;
        }
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
        // Né `advice.max` né `advice.overBy` possono comparire: sono il tetto.
        if (advice.status === 'over') {
            say(out, riservato
                ? `⚠️ Rilancia a ${advice.bid} se lo vuoi davvero: è già sopra il piano previsto per lui. Puoi arrivare fino a ${advice.cap}, ma quei crediti li togli agli altri giocatori della lista.`
                : `⚠️ Rilancia a ${advice.bid} se lo vuoi davvero: sono ${advice.overBy} crediti sopra il tuo tetto di ${advice.max}. Puoi arrivare fino a ${advice.cap}, ma li togli agli altri giocatori della lista.`, 'warn');
            return;
        }

        say(out, riservato
            ? `💰 Rilancia a ${advice.bid}: sei ancora dentro il piano (il limite di spesa è ${advice.cap}).`
            : `💰 Rilancia a ${advice.bid} (il tuo tetto è ${advice.max}, il limite di spesa ${advice.cap}).`, 'ok');
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
        if (res.over) {
            parts.push(riservato
                ? 'È sopra il piano previsto per lui: i crediti li recuperi dagli altri.'
                : `Sforato di ${res.price - res.player.max} sul tuo tetto di ${res.player.max}: i crediti li recuperi dagli altri.`);
        }
        if (res.redistribution.changes.length) parts.push(descriviRidistribuzione(res.redistribution));
        if (res.unabsorbed) {
            parts.push(res.unabsorbed > 0
                ? (riservato ? 'Restano crediti non assegnati: lista troppo corta.' : `${res.unabsorbed} crediti non assegnati: lista troppo corta.`)
                : (riservato ? '⚠️ Una parte dello sforamento non è recuperabile dagli altri.' : `⚠️ ${-res.unabsorbed} crediti di sforamento non recuperabili: gli altri sono già tutti a 1.`));
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
        if (res.redistribution.changes.length) parts.push(descriviRidistribuzione(res.redistribution));
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

    // --- ricerca ------------------------------------------------------------

    function search() {
        const out = $('outCheck');
        const q = ($('q').value || '').trim();
        const matches = engine.candidates(q);

        if (!matches.length) {
            closeAuction();

            // Già in rosa? Cercalo anche fra gli acquisti, non solo per nome esatto.
            const presi = text.findCandidates(q, engine.purchases);
            if (presi.length === 1) {
                say(out, `ℹ️ "${presi[0].name}" l'hai già preso per ${presi[0].price}.`, 'warn');
                return;
            }
            if (presi.length > 1) {
                say(out, `ℹ️ Hai già preso: ${presi.map(p => `${p.name} (${p.price})`).join(', ')}.`, 'warn');
                return;
            }

            // Non è fra i desiderati: se lo vuoi comunque, il modulo è già pronto.
            $('offListName').value = q;
            say(out, `❌ "${q}" non è fra i tuoi giocatori desiderati. Se lo prendi lo stesso, registralo in "Ho preso uno fuori lista" qui sotto.`, 'error');
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

    // --- acquisto fuori lista -----------------------------------------------

    function clearOffListForm() {
        $('offListName').value = '';
        $('offListRole').value = '';
        $('offListTeam').value = '';
        $('offListPrice').value = '';
    }

    /**
     * Registra un giocatore che nella lista dei desiderati non c'è.
     *
     * Prima di aggiungerlo controlla che non sia un desiderato scritto a metà:
     * un nome parziale che assomiglia a qualcuno in lista è quasi sempre un
     * errore di battitura, e comprarlo dall'asta normale è meglio perché lì il
     * suo tetto viene usato davvero.
     */
    function buyOffList() {
        const out = $('outOffList');
        const name = ($('offListName').value || '').trim();
        if (!name) { say(out, '❌ Scrivi il nome del giocatore.', 'error'); return; }

        const esatto = engine.find(name);
        if (esatto) {
            say(out, riservato
                ? `ℹ️ "${esatto.name}" è fra i tuoi desiderati: cercalo qui sopra e compralo dall'asta normale, così il suo tetto viene usato.`
                : `ℹ️ "${esatto.name}" è fra i tuoi desiderati, tetto ${esatto.max}: cercalo qui sopra e compralo dall'asta normale, così il tetto viene usato.`, 'warn');
            return;
        }

        const simili = engine.candidates(name);
        if (simili.length && !confirm(
            `"${name}" assomiglia a giocatori che hai in lista:\n\n- ${simili.map(p => p.name).join('\n- ')}\n\n` +
            'Se è uno di loro annulla e compralo dall\'asta normale.\n' +
            `Lo aggiungo comunque come fuori lista?`)) {
            say(out, 'Annullato: cercalo nella lista qui sopra.', 'warn');
            return;
        }

        const res = engine.winOffList(name, $('offListPrice').value, {
            role: $('offListRole').value,
            team: $('offListTeam').value,
        });
        if (!res.ok) { say(out, `❌ ${res.message}`, 'error'); return; }

        const parts = [`⚠️ "${res.player.name}" non è fra i tuoi giocatori desiderati: l'ho aggiunto lo stesso alla rosa per ${res.price}.`];
        if (res.redistribution.changes.length) {
            parts.push(riservato
                ? 'Quei crediti li ho tolti a chi resta in lista.'
                : `Quei crediti li ho tolti a chi resta in lista — ${credits.describe(res.redistribution)}.`);
        }
        if (res.unabsorbed < 0) {
            if (!engine.pool.length) {
                parts.push(`⚠️ In lista non è rimasto nessuno: questi ${res.price} crediti sono tutti fuori piano.`);
            } else {
                parts.push(riservato
                    ? '⚠️ Una parte di quei crediti non è recuperabile: gli altri in lista sono già tutti a 1.'
                    : `⚠️ ${-res.unabsorbed} crediti non recuperabili: gli altri in lista sono già tutti a 1.`);
            }
        }

        say(out, parts.join(' '), 'warn');
        say($('outBuy'), `➕ ${describePlayer(res.player)} aggiunto per ${res.price} (fuori lista).`, 'warn');
        clearOffListForm();
        render();
        flashLastPurchase();
    }

    $('btnOffListBuy').addEventListener('click', buyOffList);
    $('offListPrice').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); buyOffList(); }
    });

    // --- liste di supporto ---------------------------------------------------

    /** "Zaccagni (C, Lazio)" — qui il massimale non c'è proprio. */
    function describeEntry(p) {
        const details = [p.role, p.team].filter(Boolean).join(', ');
        return details ? `${p.name} (${details})` : p.name;
    }

    function renderShortlists() {
        for (const id of shortlists.ids()) renderShortlist(id);
    }

    /**
     * Disegna una lista e aggiorna il suo bottone. Il conteggio sta nel bottone
     * apposta: mentre la lista è chiusa è l'unica cosa che ti dice se là dentro
     * è rimasto ancora qualcuno.
     */
    function renderShortlist(id) {
        const ui = SHORTLIST_UI[id];
        if (!ui) return;
        const wrap = $(ui.wrap);
        const list = $(ui.list);
        const button = $(ui.button);
        const items = shortlists.items(id);

        button.textContent = `${wrap.hidden ? '▾' : '▴'} ${shortlists.label(id)} (${items.length})`;
        button.setAttribute('aria-expanded', String(!wrap.hidden));

        list.textContent = '';
        if (!items.length) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = shortlists.size(id)
                ? 'Li hai tolti tutti: usa "Ripristina liste" per rimetterli.'
                : 'Lista vuota: scrivila in assets/js/data/shortlists.js.';
            list.appendChild(li);
            return;
        }

        for (const p of items) {
            const li = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = describeEntry(p);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'remove';
            remove.textContent = '✕';
            remove.title = `Togli ${p.name}: è già stato chiamato`;
            remove.setAttribute('aria-label', `Togli ${p.name} da ${shortlists.label(id)}`);
            remove.addEventListener('click', () => removeFromShortlist(id, p.name));

            li.append(label, remove);
            list.appendChild(li);
        }
    }

    /** Le rimozioni stanno in engine.extra: si salvano da sole, si azzerano col reset. */
    function saveShortlists() {
        engine.extra.shortlists = shortlists.toState();
        engine.persist();
    }

    function removeFromShortlist(id, name) {
        const res = shortlists.remove(id, name);
        if (!res.ok) { say($('outShortlists'), `⚠️ ${res.message}`, 'warn'); return; }
        saveShortlists();
        renderShortlist(id);
        say($('outShortlists'), `✕ ${res.entry.name} tolto da "${shortlists.label(id)}".`, 'ok');
    }

    function toggleShortlist(id) {
        const wrap = $(SHORTLIST_UI[id].wrap);
        wrap.hidden = !wrap.hidden;
        renderShortlist(id);
        if (!wrap.hidden) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    $('btnToggleAlternatives').addEventListener('click', () => toggleShortlist('alternatives'));
    $('btnToggleBaits').addEventListener('click', () => toggleShortlist('baits'));

    $('btnRestoreShortlists').addEventListener('click', () => {
        const res = shortlists.restoreAll();
        if (!res.count) { say($('outShortlists'), 'Non avevi tolto nessuno.', 'warn'); return; }
        saveShortlists();
        renderShortlists();
        say($('outShortlists'), res.count === 1
            ? '↩️ Rimesso 1 giocatore nelle due liste.'
            : `↩️ Rimessi ${res.count} giocatori nelle due liste.`, 'ok');
    });

    // --- eventi della ricerca e dell'asta -----------------------------------

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

    $('btnRivela').addEventListener('click', () => {
        if (riservato && !confirm(
            'Stai per mettere a schermo i tuoi tetti di spesa e gli spostamenti di crediti.\n\n' +
            'È il tuo piano d\'asta: fallo vedere solo se non c\'è nessuno che guarda.\n\n' +
            'Procedo?')) return;

        riservato = !riservato;
        // I messaggi già scritti resterebbero com'erano: meglio ripulirli che
        // lasciare un numero a schermo dopo aver premuto "nascondi".
        for (const box of ['outCheck', 'outRandom', 'outAuction', 'outBuy', 'outOffList', 'outShortlists', 'outSettings']) say($(box), '');
        render();
        if (!riservato) say($('outSettings'), '⚠️ Numeri riservati a schermo. Ripremi il bottone per nasconderli.', 'warn');
    });

    $('btnShowLeft').addEventListener('click', () => {
        const wrap = $('leftWrap');
        wrap.hidden = !wrap.hidden;
        if (!wrap.hidden) { wrap.open = true; renderRemaining(); }
    });

    $('btnReset').addEventListener('click', () => {
        if (!confirm('Reset totale: ripristina la lista di partenza e cancella tutti gli acquisti. Procedo?')) return;
        engine.reset();
        // engine.reset() svuota extra: le liste di supporto tornano intere insieme al resto.
        shortlists.restoreAll();
        closeAuction();
        say($('outBuy'), '');
        say($('outCheck'), '');
        say($('outRandom'), '');
        say($('outShortlists'), '');
        say($('outSettings'), '✅ Reset completato.', 'ok');
        render();
    });

    $('btnUndo').addEventListener('click', () => {
        const res = engine.undo();
        if (!res.ok) { say($('outBuy'), `⚠️ ${res.message}`, 'warn'); return; }
        const p = res.action.player;
        const label = res.action.type === 'win'
            ? `acquisto di ${p.name} per ${res.action.price}`
            : `"andato ad altri" di ${p.name}`;
        // Un fuori lista in lista non ci torna: non c'era.
        const coda = p.offList
            ? 'Non era fra i desiderati, quindi è solo uscito dalla rosa e i crediti sono tornati agli altri.'
            : (riservato ? 'Rimesso in lista col suo tetto.' : `Rimesso in lista con tetto ${p.max}.`);
        say($('outBuy'), `↩️ Annullato: ${label}. ${coda}`, 'ok');
        closeAuction();
        render();
    });

    $('btnExportCSV').addEventListener('click', () => {
        // Il CSV esce dallo schermo e resta su un disco: se i numeri sono
        // nascosti qui, non devono uscire nemmeno di lì.
        engine.config.hideMaxInCsv = riservato;
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
    shortlists.fromState(engine.extra.shortlists);
    render();

    if (restored && (engine.purchases.length || engine.actions.length)) {
        say($('outBuy'), `↺ Ripreso il lavoro salvato: ${engine.purchases.length} acquisti, ${engine.spent} crediti spesi. Usa "Reset totale" per ricominciare.`, 'ok');
    } else if (!engine.storageAvailable) {
        say($('outSettings'), '⚠️ Il browser non permette di salvare: se ricarichi la pagina perdi tutto.', 'warn');
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
