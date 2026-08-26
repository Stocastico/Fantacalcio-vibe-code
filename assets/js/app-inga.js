/**
 * Versione base dell'helper d'asta, per chi chiama al posto di qualcun altro.
 *
 * Due differenze dalla pagina principale, e sono il motivo per cui esiste:
 *
 *  - la lista non arriva da un file del repo, ma da un CSV caricato a mano;
 *  - la pagina sa riscriversi. "Scarica la pagina con tutto dentro" produce una
 *    copia di questo stesso file con la lista e gli acquisti incollati nel
 *    blocco <script id="datiIniziali">. Quel file si manda per mail: chi lo
 *    apre riparte da lì senza avere il CSV, senza npm e senza rete.
 *
 * Tutto il resto (rilanci, ridistribuzione dei crediti, riserva per la rosa) è
 * lo stesso motore della pagina principale.
 */
;(function (global) {
    'use strict';

    const { engine: engineApi, credits, text, csv } = global.FC;

    const $ = (id) => document.getElementById(id);

    /**
     * La pagina così com'è adesso, presa prima di toccare qualsiasi cosa: è lo
     * stampo da cui esce la copia da scaricare. Il file non si può rileggere da
     * disco (da file:// il browser non lo permette), ma il DOM appena caricato
     * è ancora identico al file.
     */
    const STAMPO = '<!doctype html>\n' + document.documentElement.outerHTML;

    const engine = engineApi.createEngine({
        budget: 500,
        players: [],
        redistribution: { strategy: 'spread', min: 1 },
        storageKey: 'fantacalcio:inga:2026-2027',
        storageVersion: 1,
        easterEgg: true,
        rosterSize: 25,
    });

    let current = null;
    let suggested = null;

    // --- helper di output ---------------------------------------------------

    function say(el, message, tone) {
        el.textContent = message;
        el.classList.remove('is-ok', 'is-warn', 'is-error');
        if (tone) el.classList.add(`is-${tone}`);
    }

    /** "Lautaro (A, Inter)" — ruolo e squadra solo se il CSV li aveva. */
    function describePlayer(p) {
        const details = [p.role, p.team].filter(Boolean).join(', ');
        return details ? `${p.name} (${details})` : p.name;
    }

    const haLista = () => engine.pool.length > 0 || engine.purchases.length > 0;

    // --- rendering ----------------------------------------------------------

    function render() {
        const conLista = haLista();
        $('app').hidden = !conLista;
        $('importWrap').open = !conLista;
        $('importSummary').textContent = conLista ? 'Carica un\'altra lista' : '1) Carica la lista';

        $('playersLeft').textContent = `In lista: ${engine.pool.length}`;
        $('sumNow').textContent = `Somma tetti: ${engine.sumMax()}`;
        $('budgetLeft').textContent = `Crediti residui: ${engine.left()}`;
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

    function renderCap() {
        const pill = $('maxSpend');
        const cap = engine.maxSpendable();
        const slots = engine.slotsLeft();
        pill.textContent = `Max spendibile: ${cap}`;
        pill.classList.toggle('pill-danger', slots > 0 && cap < 1);
        pill.title = slots > 0
            ? `Restano ${engine.left()} crediti e ${slots} giocatori da comprare: ${engine.reserve()} vanno tenuti da parte per gli altri posti.`
            : `Nessun posto da tenere da parte: puoi arrivare fino al residuo di ${engine.left()}.`;
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
                price.title = `Sopra il tetto di ${p.max}`;
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

    /** Se la somma dei tetti più lo speso non fa i crediti totali, meglio dirlo subito. */
    function renderBanner() {
        const banner = $('banner');
        if (!haLista()) { banner.hidden = true; return; }

        const diff = engine.allocated() - engine.budget;
        if (diff === 0) { banner.hidden = true; return; }

        banner.hidden = false;
        banner.className = 'banner ' + (diff > 0 ? 'banner-warn' : 'banner-info');
        banner.textContent = diff > 0
            ? `⚠️ La lista vale ${diff} crediti più di quelli disponibili: somma tetti ${engine.sumMax()} + speso ${engine.spent} = ${engine.allocated()}, crediti totali ${engine.budget}. Si può giocare lo stesso, ma i tetti sono un po' ottimisti.`
            : `ℹ️ Ci sono ${-diff} crediti non assegnati a nessuno in lista.`;
    }

    // --- import del CSV -----------------------------------------------------

    /**
     * Carica la lista da un CSV. La lettura è la stessa del comando `npm run
     * import`, quindi accetta le stesse intestazioni (e anche nessuna: in quel
     * caso le colonne sono nome e offerta massima, in quest'ordine).
     */
    function importaCSV(testo, nomeFile) {
        const out = $('outImport');

        let records;
        try {
            ({ records } = csv.readList(testo, { needMax: true }));
        } catch (err) {
            say(out, `❌ ${err.message}`, 'error');
            return;
        }

        if (engine.purchases.length && !confirm(
            `Hai già registrato ${engine.purchases.length} acquisti.\n\n` +
            'Caricare una lista nuova li cancella. Procedo?')) {
            say(out, 'Annullato: la lista di prima è ancora quella buona.', 'warn');
            return;
        }

        const res = engine.loadPlayers(records);
        if (!res.ok) { say(out, `❌ ${res.message}`, 'error'); return; }

        // La lista di partenza serve a "Ricomincia da capo": senza, l'unico modo
        // per tornare indietro sarebbe ricaricare il CSV.
        engine.extra.listaOriginale = engine.pool.map(p => ({ name: p.name, role: p.role, team: p.team, max: p.max }));
        engine.persist();

        const parti = [`✅ Caricati ${res.count} giocatori${nomeFile ? ` da ${nomeFile}` : ''}, somma dei tetti ${engine.sumMax()}.`];
        if (res.problems.length) parti.push(`${res.problems.length} righe saltate: ${res.problems.join(' ')}`);
        say(out, parti.join(' '), res.problems.length ? 'warn' : 'ok');
        render();
    }

    $('fileCsv').addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => importaCSV(String(reader.result), file.name);
        reader.onerror = () => say($('outImport'), '❌ Non riesco a leggere il file.', 'error');
        reader.readAsText(file, 'utf-8');
        e.target.value = '';   // così ricaricare lo stesso file rifà scattare l'evento
    });

    // --- la pagina che si riscrive ------------------------------------------

    /**
     * Infila lo stato dentro una copia dello stampo e la fa scaricare.
     *
     * Il JSON va nel blocco <script id="datiIniziali">, con i "<" scritti come
     * escape JSON (\u003c): un tag di chiusura finito dentro il nome di un
     * giocatore chiuderebbe lo script, e la copia nascerebbe rotta.
     */
    function scaricaPagina() {
        const out = $('outSave');
        if (!haLista()) { say(out, '⚠️ Prima carica una lista.', 'warn'); return; }

        const dati = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            salvatoIl: new Date().toISOString(),
            state: engine.state(),
        };
        const json = JSON.stringify(dati).replace(/</g, '\\u003c');

        const BLOCCO = /(<script id="datiIniziali"[^>]*>)[\s\S]*?(<\/script>)/i;
        if (!BLOCCO.test(STAMPO)) {
            say(out, '❌ Non trovo il punto dove incollare i dati: la pagina è stata modificata a mano?', 'error');
            return;
        }
        const html = STAMPO.replace(BLOCCO, (m, apre, chiude) => apre + json + chiude);

        const oggi = new Date().toISOString().slice(0, 10);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `standalone_inga_${oggi}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const quanti = engine.purchases.length === 1 ? '1 acquisto' : `${engine.purchases.length} acquisti`;
        say(out, `⬇️ Scaricato standalone_inga_${oggi}.html: dentro ci sono ${engine.pool.length} giocatori ancora in lista e ${quanti}.`, 'ok');
    }

    /** I dati incollati nel file, se questa copia è già stata salvata da qualcuno. */
    function datiIniziali() {
        const el = $('datiIniziali');
        if (!el) return null;
        try {
            const dati = JSON.parse((el.textContent || '').trim() || 'null');
            return dati && dati.state && Array.isArray(dati.state.pool) ? dati : null;
        } catch {
            return null;
        }
    }

    $('btnSavePage').addEventListener('click', scaricaPagina);

    // --- asta ---------------------------------------------------------------

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

        if (advice.status === 'invalid') { say(out, '❌ Offerta non valida.', 'error'); return; }

        if (advice.status === 'stop') {
            suggested = null;
            $('finalPrice').value = '';
            const slots = engine.slotsLeft();
            say(out, slots > 1
                ? `⛔ STOP, lascialo andare: non si può superare ${advice.cap}. Restano ${engine.left()} crediti e ${slots} giocatori da comprare.`
                : `⛔ STOP: non si può superare ${advice.cap}, è tutto quello che resta.`, 'error');
            return;
        }

        suggested = advice.bid;
        $('finalPrice').value = String(advice.bid);

        if (advice.status === 'over') {
            say(out, `⚠️ Puoi rilanciare a ${advice.bid}, ma sono ${advice.overBy} crediti sopra il tetto di ${advice.max}: quei crediti li togli agli altri giocatori della lista. Il limite vero è ${advice.cap}.`, 'warn');
            return;
        }

        say(out, `💰 Rilancia a ${advice.bid} (il tetto per lui è ${advice.max}, il limite di spesa ${advice.cap}).`, 'ok');
    }

    function confirmWin() {
        if (!current) return;
        const out = $('outAuction');
        const raw = $('finalPrice').value;
        const price = raw === '' ? suggested : text.toInt(raw);

        if (price === null || price === undefined) {
            say(out, '❌ Scrivi il prezzo finale pagato (o premi prima "Posso rilanciare?").', 'error');
            return;
        }

        const res = engine.win(current.name, price);
        if (!res.ok) { say(out, `❌ ${res.message}`, 'error'); return; }

        const parti = [`🎉 Preso ${res.player.name} per ${res.price}.`];
        if (res.over) parti.push(`Sono ${res.price - res.player.max} sopra il tetto di ${res.player.max}: tolti agli altri.`);
        if (res.redistribution.changes.length) parti.push(credits.describe(res.redistribution) + '.');
        if (res.unabsorbed) {
            parti.push(res.unabsorbed > 0
                ? `${res.unabsorbed} crediti non assegnati: la lista è corta.`
                : `⚠️ ${-res.unabsorbed} crediti di sforamento non recuperabili: gli altri sono già tutti a 1.`);
        }

        say($('outBuy'), parti.join(' '), res.over ? 'warn' : 'ok');
        closeAuction();
        render();
        flashLastPurchase();
    }

    function confirmLoss() {
        if (!current) return;
        const res = engine.lose(current.name);
        if (!res.ok) { say($('outAuction'), `❌ ${res.message}`, 'error'); return; }
        const parti = [`😞 ${res.player.name} è andato a un altro, tolto dalla lista.`];
        if (res.redistribution.changes.length) parti.push(credits.describe(res.redistribution) + '.');
        say($('outBuy'), parti.join(' '), 'warn');
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
            const presi = text.findCandidates(q, engine.purchases);
            if (presi.length) {
                say(out, `ℹ️ ${presi.map(p => `${p.name} (${p.price})`).join(', ')}: già preso.`, 'warn');
                return;
            }
            say(out, `❌ "${q}" non è in lista: lascialo perdere, non era fra i suoi.`, 'error');
            return;
        }
        if (matches.length > 1) {
            closeAuction();
            say(out, `⚠️ Più di uno con questo nome:\n- ${matches.map(m => m.name).join('\n- ')}`, 'warn');
            return;
        }
        say(out, `✅ Trovato: ${describePlayer(matches[0])}`, 'ok');
        openAuction(matches[0]);
    }

    // --- eventi -------------------------------------------------------------

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
        if (!p) { say($('outRandom'), '❌ Non è rimasto nessuno in lista.', 'error'); return; }
        say($('outRandom'), `🎯 Estratto: ${describePlayer(p)}`, 'ok');
        openAuction(p, 1);
    });

    $('btnNext').addEventListener('click', () => {
        const p = engine.nextByMax();
        if (!p) { say($('outRandom'), '❌ Non è rimasto nessuno in lista.', 'error'); return; }
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

    $('btnUndo').addEventListener('click', () => {
        const res = engine.undo();
        if (!res.ok) { say($('outBuy'), `⚠️ ${res.message}`, 'warn'); return; }
        const p = res.action.player;
        const label = res.action.type === 'win'
            ? `acquisto di ${p.name} per ${res.action.price}`
            : `"andato a un altro" di ${p.name}`;
        say($('outBuy'), `↩️ Annullato: ${label}. Rimesso in lista con tetto ${p.max}.`, 'ok');
        closeAuction();
        render();
    });

    $('btnExportCSV').addEventListener('click', () => {
        const res = engine.exportCSV('acquisti_inga');
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
        say($('outSettings'), `✅ ${engine.budget} crediti, rosa da ${engine.rosterSize} (ne mancano ${engine.slotsLeft()}), sul prossimo puoi arrivare a ${engine.maxSpendable()}.`, 'ok');
    });

    $('btnReset').addEventListener('click', () => {
        const originale = engine.extra.listaOriginale;
        if (!Array.isArray(originale) || !originale.length) {
            say($('outSettings'), '⚠️ Non ho più la lista di partenza: ricarica il CSV.', 'warn');
            return;
        }
        if (!confirm('Rimette la lista come l\'hai caricata e cancella tutti gli acquisti. Procedo?')) return;

        const res = engine.loadPlayers(originale);
        if (!res.ok) { say($('outSettings'), `❌ ${res.message}`, 'error'); return; }
        engine.extra.listaOriginale = originale;
        engine.persist();
        closeAuction();
        say($('outBuy'), '');
        say($('outCheck'), '');
        say($('outRandom'), '');
        say($('outSettings'), '✅ Ricominciato da capo.', 'ok');
        render();
    });

    // --- avvio --------------------------------------------------------------

    /*
     * Tre casi: la pagina ha i dati incollati dentro (è una copia salvata da
     * qualcuno), il browser ha un lavoro in corso, o non c'è niente e si parte
     * dal CSV. Se il file porta dati più nuovi di quelli del browser vincono i
     * suoi: vuol dire che è appena arrivato per mail.
     */
    const dalFile = datiIniziali();
    const dalBrowser = engine.restore();

    if (dalFile && engine.extra.fileId !== dalFile.id) {
        const cerano = dalBrowser && (engine.purchases.length || engine.pool.length);
        engine.restore(dalFile.state);
        engine.extra.fileId = dalFile.id;
        engine.persist();
        render();
        const quando = dalFile.salvatoIl ? new Date(dalFile.salvatoIl).toLocaleString('it-IT') : null;
        say($('outBuy'), cerano
            ? `↺ Questo file porta una lista più recente${quando ? ` (salvata il ${quando})` : ''}: uso quella, il lavoro precedente su questo browser è stato messo da parte.`
            : `↺ Lista caricata dal file${quando ? `, salvata il ${quando}` : ''}: ${engine.pool.length} giocatori in lista, ${engine.purchases.length === 1 ? '1 acquisto' : `${engine.purchases.length} acquisti`}.`, 'ok');
    } else {
        render();
        if (dalBrowser && (engine.purchases.length || engine.actions.length)) {
            say($('outBuy'), `↺ Ripreso il lavoro salvato: ${engine.purchases.length} acquisti, ${engine.spent} crediti spesi.`, 'ok');
        } else if (!engine.storageAvailable) {
            say($('outImport'), '⚠️ Questo browser non permette di salvare: se chiudi la pagina perdi tutto. Scarica la pagina con tutto dentro ogni tanto.', 'warn');
        }
    }

    if (haLista()) {
        say($('outImport'), 'La lista è già caricata. Se ne carichi un\'altra, gli acquisti fatti finora vengono cancellati.', 'warn');
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
