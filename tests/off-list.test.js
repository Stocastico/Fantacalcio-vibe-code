/**
 * Acquisto di un giocatore che nella lista dei desiderati non c'è.
 *
 * Serve quando all'asta ci sei di persona: prendi un'occasione non pianificata,
 * oppure alla fine devi solo riempire uno slot. Le regole:
 *  - riempie uno slot di rosa come un acquisto normale;
 *  - il prezzo lo pagano i tetti dei giocatori ancora in lista, perché per lui
 *    non c'era nessun credito messo da parte;
 *  - annullarlo NON lo infila nella lista dei desiderati: lì non c'è mai stato.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine } = require('../assets/js/core/engine.js');
const { memoryBackend } = require('../assets/js/core/storage.js');

const LISTA = [
    { name: 'Bomber', role: 'A', team: 'Roma', max: 40 },
    { name: 'Mezzala', role: 'C', team: 'Lecce', max: 30 },
    { name: 'Terzino', role: 'D', team: 'Como', max: 20 },
    { name: 'Riserva', role: 'P', team: 'Parma', max: 10 },
];

/** Budget 100, quattro slot di rosa: somma tetti = budget. */
const nuovo = (over = {}) => createEngine(Object.assign({
    budget: 100,
    players: LISTA,
    rosterSize: 4,
    redistribution: { strategy: 'spread', min: 1 },
}, over));

// --- registrare l'acquisto ---------------------------------------------------

test('un giocatore fuori lista si può comprare lo stesso', () => {
    const e = nuovo();
    const res = e.winOffList('Occasione', 12);

    assert.ok(res.ok);
    assert.equal(res.offList, true, 'il chiamante deve poter dire che non era fra i desiderati');
    assert.equal(res.price, 12);
    assert.equal(e.spent, 12);
    assert.equal(e.purchases.length, 1);
    assert.equal(e.bought('Occasione').offList, true);
});

test('nella lista dei desiderati non entra: quella resta il piano', () => {
    const e = nuovo();
    e.winOffList('Occasione', 12);

    assert.equal(e.pool.length, 4, 'i desiderati sono sempre gli stessi quattro');
    assert.equal(e.find('Occasione'), null);
});

test('riempie uno slot di rosa come un acquisto qualsiasi', () => {
    const e = nuovo();
    assert.equal(e.slotsLeft(), 4);
    e.winOffList('Occasione', 12);
    assert.equal(e.slotsLeft(), 3, 'uno slot in meno da riempire');
});

test('ruolo e squadra sono facoltativi e vengono tenuti', () => {
    const e = nuovo();
    e.winOffList('Occasione', 5, { role: 'a', team: 'Genoa' });
    const preso = e.bought('Occasione');
    assert.equal(preso.role, 'A', 'il ruolo viene normalizzato in maiuscolo');
    assert.equal(preso.team, 'Genoa');

    e.winOffList('Ignoto', 5, { role: 'Z' });
    assert.equal(e.bought('Ignoto').role, undefined, 'un ruolo inventato viene scartato');
});

test('la ricerca ignora accenti e maiuscole anche sui fuori lista', () => {
    const e = nuovo();
    e.winOffList('Vlahović', 9);
    assert.ok(e.bought('vlahovic'), 'lo ritrovo scrivendolo senza accenti');
});

// --- i crediti li pagano gli altri ------------------------------------------

test('il prezzo viene tolto ai tetti di chi resta in lista', () => {
    const e = nuovo();
    e.winOffList('Occasione', 12);

    assert.equal(e.sumMax(), 88, '100 di tetti meno i 12 spesi fuori piano');
    assert.equal(e.allocated(), 100, 'i conti restano chiusi sul budget');
    assert.ok(e.pool.every(p => p.max >= 1));
});

test('i crediti si tolgono da chi in quel momento ha il tetto più alto', () => {
    const e = nuovo();
    e.winOffList('Occasione', 3);

    // Bomber parte da 40 e resta il più caro a ogni prelievo: paga tutti e tre.
    assert.equal(e.find('Bomber').max, 37);
    assert.equal(e.find('Mezzala').max, 30, 'gli altri non vengono toccati');
    assert.equal(e.find('Terzino').max, 20);
    assert.equal(e.find('Riserva').max, 10);
});

test('nessun tetto scende sotto 1 credito, nemmeno spendendo il massimo', () => {
    const e = nuovo();
    const res = e.winOffList('Occasione', 97);   // il massimo spendibile

    assert.ok(res.ok);
    assert.ok(e.pool.every(p => p.max >= 1), 'restano tutti comprabili almeno a 1');

    // Comprando fuori lista la rosa si riempie ma la lista no: qui restano 4
    // desiderati per 3 slot, quindi un credito non ha più un tetto dove stare.
    // Non è un errore del calcolo: è il banner che deve dirtelo.
    assert.equal(res.unabsorbed, -1);
    assert.equal(e.sumMax(), 4, 'i quattro rimasti sono tutti a 1');
    assert.equal(e.allocated(), 101);
});

test('a lista vuota il fuori lista si compra ma i crediti non li paga nessuno', () => {
    const e = nuovo();
    for (const p of [...e.pool]) e.lose(p.name);
    assert.equal(e.pool.length, 0);

    const res = e.winOffList('Occasione', 20);
    assert.ok(res.ok, 'a lista finita è proprio così che si riempie la rosa');
    assert.equal(res.unabsorbed, -20, 'nessuno può assorbire la spesa: lo segnala il banner');
    assert.equal(e.left(), 80);
});

// --- i limiti ----------------------------------------------------------------

test('vale lo stesso limite di spesa degli altri acquisti', () => {
    const e = nuovo();
    const troppo = e.winOffList('Occasione', 98);   // ne servono 3 per gli altri slot

    assert.equal(troppo.ok, false);
    assert.match(troppo.message, /al massimo 97/);
    assert.equal(e.spent, 0, 'niente è stato registrato');

    assert.ok(e.winOffList('Occasione', 97).ok, 'al limite esatto passa');
});

test('un prezzo non valido viene rifiutato', () => {
    const e = nuovo();
    assert.equal(e.winOffList('Occasione', -1).ok, false);
    assert.equal(e.winOffList('Occasione', 'tanto').ok, false);
    assert.equal(e.winOffList('Occasione', '').ok, false);
    assert.equal(e.purchases.length, 0);
});

test('senza nome non si registra niente', () => {
    const e = nuovo();
    const res = e.winOffList('   ', 10);
    assert.equal(res.ok, false);
    assert.match(res.message, /nome/i);
});

test('se il nome è in lista rimanda all asta normale, col tetto', () => {
    const e = nuovo();
    const res = e.winOffList('bomber', 10);

    assert.equal(res.ok, false);
    assert.match(res.message, /è nella tua lista/);
    assert.match(res.message, /40/, 'ricorda il tetto che si perderebbe');
    assert.equal(e.spent, 0);
});

test('lo stesso giocatore non si compra due volte', () => {
    const e = nuovo();
    e.winOffList('Occasione', 10);
    const res = e.winOffList('occasione', 5);

    assert.equal(res.ok, false);
    assert.match(res.message, /già acquistato/);
    assert.equal(e.spent, 10);
});

test('un fuori lista già preso blocca anche l acquisto normale', () => {
    const e = nuovo();
    e.winOffList('Occasione', 10);
    assert.equal(e.win('Occasione', 5).ok, false, 'in lista non c\'è comunque');
});

// --- annullare ---------------------------------------------------------------

test('annullare un fuori lista non lo infila fra i desiderati', () => {
    const e = nuovo();
    e.winOffList('Occasione', 12);
    const res = e.undo();

    assert.ok(res.ok);
    assert.equal(res.action.player.offList, true, 'chi annulla sa che era un fuori lista');
    assert.equal(e.pool.length, 4);
    assert.equal(e.find('Occasione'), null, 'non deve comparire fra i giocatori che vuoi');
});

test('annullando, i crediti tornano ai tetti di prima', () => {
    const e = nuovo();
    const prima = e.pool.map(p => `${p.name}:${p.max}`).sort();

    e.winOffList('Occasione', 12);
    e.undo();

    assert.deepEqual(e.pool.map(p => `${p.name}:${p.max}`).sort(), prima);
    assert.equal(e.spent, 0);
    assert.equal(e.purchases.length, 0);
    assert.equal(e.slotsLeft(), 4, 'lo slot torna libero');
    assert.equal(e.allocated(), 100);
});

test('undo a catena su acquisti misti torna esattamente allo stato di partenza', () => {
    const e = nuovo();
    const prima = e.pool.map(p => `${p.name}:${p.max}`).sort();

    e.win('Terzino', 5);          // sotto il tetto: crediti agli altri
    e.winOffList('Occasione', 9); // fuori piano: crediti tolti agli altri
    e.lose('Riserva');            // agli altri
    e.win('Bomber', 55);          // sforamento

    while (e.actions.length) e.undo();

    assert.deepEqual(e.pool.map(p => `${p.name}:${p.max}`).sort(), prima);
    assert.equal(e.spent, 0);
    assert.equal(e.allocated(), 100);
});

// --- salvataggio e export ----------------------------------------------------

test('un fuori lista sopravvive al salvataggio', () => {
    const backend = memoryBackend();
    const opts = { storageKey: 'test:offlist', storageVersion: 1, storageBackend: backend };

    const primo = nuovo(opts);
    primo.winOffList('Occasione', 12, { role: 'A', team: 'Genoa' });

    const secondo = nuovo(opts);
    assert.ok(secondo.restore());

    const preso = secondo.bought('Occasione');
    assert.equal(preso.price, 12);
    assert.equal(preso.offList, true, 'resta marcato come fuori lista anche dopo il refresh');
    assert.equal(preso.team, 'Genoa');
    assert.equal(secondo.spent, 12);
});

test('dopo il ripristino l undo di un fuori lista si comporta uguale', () => {
    const backend = memoryBackend();
    const opts = { storageKey: 'test:offlist:undo', storageVersion: 1, storageBackend: backend };

    const primo = nuovo(opts);
    primo.winOffList('Occasione', 12);

    const secondo = nuovo(opts);
    secondo.restore();
    assert.ok(secondo.undo().ok);

    assert.equal(secondo.find('Occasione'), null);
    assert.equal(secondo.spent, 0);
    assert.equal(secondo.allocated(), 100, 'i tetti sono tornati come prima');
});

test('il CSV distingue i fuori lista e non gli inventa un massimale', () => {
    const e = nuovo();
    e.win('Terzino', 15);
    e.winOffList('Occasione', 12, { role: 'A', team: 'Genoa' });

    const rows = e.csvRows();
    const head = rows[0];
    const iMax = head.indexOf('Tuo massimale');
    const iOff = head.indexOf('Fuori lista');

    assert.ok(iOff > -1, 'la colonna compare quando serve');
    assert.equal(rows[1][iMax], '20', 'il desiderato tiene il suo tetto');
    assert.equal(rows[1][iOff], '');
    assert.equal(rows[2][iMax], '', 'per un fuori lista il massimale non esiste');
    assert.equal(rows[2][iOff], 'sì');
});

test('senza fuori lista il CSV resta identico a prima', () => {
    const e = nuovo();
    e.win('Terzino', 15);
    assert.equal(e.csvRows()[0].includes('Fuori lista'), false);
});
