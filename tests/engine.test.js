const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine, normalizePlayers } = require('../assets/js/core/engine.js');
const { memoryBackend } = require('../assets/js/core/storage.js');

/** Lista giocattolo: somma dei massimali = 100, come il budget. */
const LISTA = [
    { name: 'Portiere', role: 'P', max: 10 },
    { name: 'Difensore', role: 'D', max: 20 },
    { name: 'Centrocampista', role: 'C', max: 30 },
    { name: 'Attaccante', role: 'A', max: 40 },
];

const nuovo = (over = {}) => createEngine(Object.assign({
    budget: 100,
    players: LISTA,
    redistribution: { strategy: 'spread', min: 1 },
}, over));

// --- normalizzazione della lista -------------------------------------------

test('normalizePlayers accetta sia max che bid e scarta le righe rotte', () => {
    const { players, problems } = normalizePlayers([
        { name: 'Con max', max: 10 },
        { name: 'Con bid', bid: 5 },          // formato delle stagioni precedenti
        { name: '', max: 3 },                  // niente nome
        { name: 'Senza tetto' },               // niente massimale
        { name: 'Con Max', max: 99 },          // doppione, differisce solo per maiuscole
        { name: 'Ruolo strano', max: 1, role: 'X' },
    ]);

    assert.deepEqual(players.map(p => p.name), ['Con max', 'Con bid', 'Ruolo strano']);
    assert.equal(players[1].max, 5);
    assert.equal(players[2].role, undefined, 'un ruolo non valido viene scartato, non tenuto');
    assert.equal(problems.length, 3);
});

test('normalizePlayers tiene la squadra, da team o da squadra', () => {
    const { players } = normalizePlayers([
        { name: 'Con team', max: 1, team: 'Roma' },
        { name: 'Con squadra', max: 1, squadra: 'Napoli' },
        { name: 'Senza', max: 1 },
        { name: 'Vuota', max: 1, team: '   ' },
    ]);
    assert.deepEqual(players.map(p => p.team), ['Roma', 'Napoli', undefined, undefined]);
});

// --- il campo squadra attraversa tutto il ciclo di vita ---------------------

test('la squadra sopravvive ad acquisto, undo, salvataggio ed export', () => {
    const backend = memoryBackend();
    const opts = {
        budget: 100,
        players: [{ name: 'Hojlund', role: 'A', team: 'Napoli', max: 100 }],
        storageKey: 'test:team',
        storageVersion: 1,
        storageBackend: backend,
    };
    const e = createEngine(opts);

    const res = e.win('Hojlund', 40);
    assert.equal(res.player.team, 'Napoli');
    assert.equal(e.purchases[0].team, 'Napoli');

    const rows = e.csvRows();
    assert.deepEqual(rows[0], ['Nome', 'Ruolo', 'Squadra', 'Prezzo', 'Tuo massimale']);
    assert.deepEqual(rows[1], ['Hojlund', 'A', 'Napoli', '40', '100']);
    assert.deepEqual(rows.at(-1), ['Residuo', '', '', '60', '']);

    const ricaricato = createEngine(opts);
    ricaricato.restore();
    assert.equal(ricaricato.purchases[0].team, 'Napoli');

    ricaricato.undo();
    assert.equal(ricaricato.find('Hojlund').team, 'Napoli', 'torna in lista con la sua squadra');
    assert.equal(ricaricato.find('Hojlund').role, 'A');
});

test('senza squadre il CSV non aggiunge la colonna', () => {
    const e = nuovo();
    e.win('Attaccante', 10);
    assert.ok(!e.csvRows()[0].includes('Squadra'));
});

// --- invariante del budget --------------------------------------------------

test('somma tetti + speso resta uguale al budget durante tutta l asta', () => {
    const e = nuovo();
    assert.equal(e.allocated(), 100);

    e.win('Attaccante', 25);          // preso sotto il tetto di 40
    assert.equal(e.allocated(), 100);

    e.lose('Centrocampista');          // perso: il suo tetto va agli altri
    assert.equal(e.allocated(), 100);

    e.win('Difensore', 5);
    assert.equal(e.allocated(), 100);
    assert.equal(e.spent, 30);
});

test('pagare sopra il tetto toglie crediti agli altri invece di sballare i conti', () => {
    const e = nuovo();
    const res = e.win('Portiere', 30);   // tetto 10, pagati 30

    assert.ok(res.ok);
    assert.ok(res.over);
    assert.equal(e.spent, 30);
    assert.equal(e.allocated(), 100, 'i 20 di sforamento sono usciti dai tetti degli altri');
    assert.equal(e.sumMax(), 70);
});

test('se la lista si svuota i crediti non assorbiti vengono segnalati', () => {
    const e = createEngine({ budget: 100, players: [{ name: 'Unico', max: 100 }] });
    const res = e.win('Unico', 40);

    assert.ok(res.ok);
    assert.equal(res.unabsorbed, 60, 'nessuno a cui girare i 60 risparmiati');
    assert.equal(e.allocated(), 40);
});

// --- acquisti ---------------------------------------------------------------

test('win rifiuta chi non è in lista, i doppioni e chi sfora il budget', () => {
    const e = nuovo();

    assert.match(e.win('Sconosciuto', 5).message, /non è nella lista/);
    assert.match(e.win('Portiere', 'tanti').message, /Prezzo non valido/);
    assert.match(e.win('Portiere', -1).message, /Prezzo non valido/);

    assert.ok(e.win('Portiere', 10).ok);
    assert.match(e.win('Portiere', 10).message, /non è nella lista/, 'ormai è fuori dalla lista');

    // Il tetto del giocatore si può sforare, i crediti no.
    assert.match(e.win('Attaccante', 200).message, /al massimo 90/);
});

test('il nome viene riconosciuto anche con accenti e maiuscole diverse', () => {
    const e = createEngine({ budget: 100, players: [{ name: 'Vlahović', max: 100 }] });
    assert.ok(e.win('vlahovic', 30).ok);
    assert.equal(e.purchases[0].name, 'Vlahović', 'salva il nome come sta nella lista');
});

// --- undo -------------------------------------------------------------------

test('undo di un acquisto rimette il giocatore in lista e ripristina i tetti', () => {
    const e = nuovo();
    const prima = e.pool.map(p => ({ name: p.name, max: p.max }));

    e.win('Attaccante', 10);
    assert.equal(e.spent, 10);
    assert.equal(e.pool.length, 3);

    const res = e.undo();
    assert.ok(res.ok);
    assert.equal(e.spent, 0);
    assert.equal(e.purchases.length, 0);
    assert.deepEqual(
        e.pool.map(p => ({ name: p.name, max: p.max })).sort((a, b) => a.name.localeCompare(b.name)),
        prima.sort((a, b) => a.name.localeCompare(b.name))
    );
});

test('undo di una perdita ripristina anche la ridistribuzione', () => {
    const e = nuovo();
    e.lose('Attaccante');
    assert.equal(e.sumMax(), 100);

    e.undo();
    assert.equal(e.pool.length, 4);
    assert.equal(e.find('Attaccante').max, 40);
    assert.equal(e.sumMax(), 100);
});

test('undo ripetuti tornano indietro nell ordine giusto', () => {
    const e = nuovo();
    e.win('Attaccante', 20);
    e.lose('Centrocampista');
    e.win('Difensore', 15);

    e.undo(); e.undo(); e.undo();

    assert.equal(e.spent, 0);
    assert.equal(e.pool.length, 4);
    assert.equal(e.allocated(), 100);
    assert.deepEqual(
        e.pool.map(p => p.max).sort((a, b) => a - b),
        [10, 20, 30, 40]
    );
});

test('undo senza azioni da annullare non rompe niente', () => {
    const e = nuovo();
    assert.equal(e.undo().ok, false);
});

// --- consiglio sul rilancio -------------------------------------------------

const pick = ({ status, bid }) => ({ status, bid });

test('bidAdvice rilancia di uno e segnala quando si esce dal piano', () => {
    const e = nuovo();
    assert.deepEqual(pick(e.bidAdvice('Attaccante', 10)), { status: 'bid', bid: 11 });
    assert.deepEqual(pick(e.bidAdvice('Attaccante', '')), { status: 'bid', bid: 1 });
    assert.deepEqual(pick(e.bidAdvice('Attaccante', 39)), { status: 'bid', bid: 40 });

    // Oltre il tetto pianificato, ma i crediti ci sono: si può fare.
    assert.deepEqual(pick(e.bidAdvice('Attaccante', 40)), { status: 'over', bid: 41 });

    // Oltre i crediti disponibili: qui ci si ferma davvero.
    assert.deepEqual(pick(e.bidAdvice('Attaccante', 100)), { status: 'stop', bid: null });

    assert.deepEqual(pick(e.bidAdvice('Attaccante', -1)), { status: 'invalid', bid: null });
    assert.deepEqual(pick(e.bidAdvice('Fantasma', 5)), { status: 'unknown', bid: null });
});

test('bidAdvice riconosce chi hai già comprato', () => {
    const e = nuovo();
    e.win('Portiere', 5);
    assert.equal(e.bidAdvice('Portiere', 3).status, 'already-bought');
});

test('la regola del 36 scatta solo sui tetti alti e sulle offerte basse', () => {
    const e = createEngine({ budget: 200, players: [{ name: 'Big', max: 90 }], easterEgg: true });
    assert.equal(e.bidAdvice('Big', 10).bid, 36, 'salta direttamente a 36');
    assert.equal(e.bidAdvice('Big', 36).bid, 37, 'da 35 in su si torna al rilancio normale');
    assert.equal(e.bidAdvice('Big', 50).bid, 51);

    const bassoTetto = createEngine({ budget: 200, players: [{ name: 'Small', max: 30 }], easterEgg: true });
    assert.equal(bassoTetto.bidAdvice('Small', 10).bid, 11, 'sotto i 37 di tetto la regola non si applica');

    const spenta = createEngine({ budget: 200, players: [{ name: 'Big', max: 90 }], easterEgg: false });
    assert.equal(spenta.bidAdvice('Big', 10).bid, 11);
});

// --- budget e reset ---------------------------------------------------------

test('setBudget rifiuta valori sotto quanto già speso', () => {
    const e = nuovo();
    e.win('Attaccante', 40);
    assert.match(e.setBudget(10).message, /già speso/);
    assert.ok(e.setBudget(300).ok);
    assert.equal(e.left(), 260);
});

test('reset riporta tutto alla lista di partenza', () => {
    const e = nuovo();
    e.win('Attaccante', 40);
    e.lose('Portiere');
    e.reset();

    assert.equal(e.pool.length, 4);
    assert.equal(e.spent, 0);
    assert.equal(e.purchases.length, 0);
    assert.equal(e.actions.length, 0);
    assert.equal(e.allocated(), 100);
});

// --- persistenza ------------------------------------------------------------

test('lo stato sopravvive alla ricarica della pagina', () => {
    const backend = memoryBackend();
    const opts = { storageKey: 'test:asta', storageVersion: 1, storageBackend: backend };

    const primo = nuovo(opts);
    primo.win('Attaccante', 22);
    primo.lose('Portiere');

    const secondo = nuovo(opts);
    assert.ok(secondo.restore());
    assert.equal(secondo.spent, 22);
    assert.equal(secondo.purchases[0].name, 'Attaccante');
    assert.equal(secondo.pool.length, 2);
    assert.equal(secondo.allocated(), 100);
    assert.ok(secondo.undo().ok, 'anche la cronologia per l undo è stata salvata');
});

test('uno stato salvato da una versione precedente viene ignorato', () => {
    const backend = memoryBackend();
    const vecchio = nuovo({ storageKey: 'test:asta', storageVersion: 1, storageBackend: backend });
    vecchio.win('Attaccante', 22);

    const nuovaVersione = nuovo({ storageKey: 'test:asta', storageVersion: 2, storageBackend: backend });
    assert.equal(nuovaVersione.restore(), false);
    assert.equal(nuovaVersione.spent, 0);
    assert.equal(nuovaVersione.pool.length, 4);
});

test('senza storage il motore funziona lo stesso', () => {
    const e = nuovo({ storageKey: null });
    assert.equal(e.storageAvailable, false);
    assert.ok(e.win('Portiere', 5).ok);
    assert.equal(e.restore(), false);
});

// --- export -----------------------------------------------------------------

test('il CSV riporta acquisti e totali', () => {
    const e = nuovo();
    e.win('Attaccante', 30);
    const rows = e.csvRows();

    assert.deepEqual(rows[0], ['Nome', 'Ruolo', 'Prezzo', 'Tuo massimale']);
    assert.deepEqual(rows[1], ['Attaccante', 'A', '30', '40']);
    assert.deepEqual(rows.at(-1), ['Residuo', '', '70', '']);
});

test('con hideMaxInCsv il massimale non finisce nel file', () => {
    const e = createEngine({
        budget: 100,
        players: [{ name: 'Tizio', max: 50 }],
        hideMaxInCsv: true,
    });
    e.win('Tizio', 30);
    const rows = e.csvRows();

    assert.deepEqual(rows[0], ['Nome', 'Prezzo']);
    assert.deepEqual(rows[1], ['Tizio', '30']);
    assert.ok(!JSON.stringify(rows).includes('50'), 'nessuna traccia del massimale');
});

test('esportare senza acquisti avvisa invece di scaricare un file vuoto', () => {
    const e = nuovo();
    assert.equal(e.exportCSV('x').ok, false);
});

// --- stato portabile --------------------------------------------------------
//
// La pagina base non tiene la lista in un file del repo: se la porta dentro
// l'HTML, esportando lo stato e rimettendocelo dentro alla riapertura. Sono
// queste due funzioni a reggere il passaggio del file da una persona all'altra.

test('state() restituisce tutto quello che serve a ripartire', () => {
    const e = nuovo({ budget: 100, players: [{ name: 'Tizio', max: 60 }, { name: 'Caio', max: 40 }] });
    e.win('Tizio', 50);
    const s = e.state();

    assert.deepEqual(Object.keys(s).sort(),
        ['actions', 'budget', 'extra', 'pool', 'purchases', 'rosterSize', 'spent'].sort());
    assert.equal(s.budget, 100);
    assert.equal(s.spent, 50);
    assert.deepEqual(s.purchases.map(p => [p.name, p.price]), [['Tizio', 50]]);
    assert.deepEqual(s.pool.map(p => p.name), ['Caio']);
});

test('state() è una copia: chi se la porta via non può sporcare il motore', () => {
    const e = nuovo({ budget: 100, players: [{ name: 'Tizio', max: 100 }] });
    const s = e.state();
    s.pool.push({ name: 'Intruso', max: 1 });
    s.budget = 9999;
    s.extra.roba = true;

    assert.equal(e.pool.length, 1);
    assert.equal(e.budget, 100);
    assert.deepEqual(e.extra, {});
});

test('restore(stato) riparte da uno stato arrivato da fuori', () => {
    const partenza = nuovo({ budget: 100, players: [{ name: 'Tizio', max: 60 }, { name: 'Caio', max: 40 }] });
    partenza.win('Tizio', 50);
    partenza.lose('Caio');

    const arrivo = nuovo({ budget: 500, players: [] });
    assert.equal(arrivo.restore(partenza.state()), true);
    assert.equal(arrivo.budget, 100);
    assert.equal(arrivo.spent, 50);
    assert.equal(arrivo.left(), 50);
    assert.deepEqual(arrivo.purchases.map(p => p.name), ['Tizio']);
    assert.deepEqual(arrivo.pool, []);
});

test('restore(stato) salva subito: chi riapre il file ritrova il lavoro', () => {
    const backend = memoryBackend();
    const partenza = nuovo({ budget: 100, players: [{ name: 'Tizio', max: 100 }] });
    partenza.win('Tizio', 30);

    const arrivo = nuovo({ budget: 500, players: [], storageKey: 'passaggio', storageBackend: backend });
    arrivo.restore(partenza.state());

    // Un motore nuovo sullo stesso storage deve vedere lo stato appena messo.
    const dopoRiapertura = nuovo({ budget: 500, players: [], storageKey: 'passaggio', storageBackend: backend });
    assert.equal(dopoRiapertura.restore(), true);
    assert.equal(dopoRiapertura.spent, 30);
    assert.deepEqual(dopoRiapertura.purchases.map(p => p.name), ['Tizio']);
});

test('restore(stato) rifiuta uno stato rotto invece di svuotare tutto', () => {
    const e = nuovo({ budget: 100, players: [{ name: 'Tizio', max: 100 }] });
    for (const rotto of [null, {}, { pool: 'no' }, { pool: [], purchases: 'no' }]) {
        assert.equal(e.restore(rotto), false, JSON.stringify(rotto));
    }
    assert.equal(e.pool.length, 1, 'la lista di prima è ancora lì');
});

test('lo stato continua a funzionare dopo un giro completo di export e import', () => {
    const a = nuovo({ budget: 100, players: [{ name: 'Tizio', max: 60 }, { name: 'Caio', max: 40 }] });
    a.win('Tizio', 30);

    const b = nuovo({ budget: 500, players: [] });
    b.restore(JSON.parse(JSON.stringify(a.state())));   // come passare per un file
    const res = b.win('Caio', 20);

    assert.equal(res.ok, true);
    assert.equal(b.spent, 50);
    assert.equal(b.undo().ok, true, 'anche l\'annulla deve reggere');
    assert.equal(b.spent, 30);
});
