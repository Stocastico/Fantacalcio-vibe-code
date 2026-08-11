/**
 * Sforare il tetto di un giocatore.
 *
 * Il `max` della lista è un piano, non un vincolo: in asta si può pagare di più.
 * I limiti veri sono due, e valgono insieme:
 *   1. non oltre i crediti rimasti;
 *   2. devi tenere 1 credito per ogni slot di rosa che resterà vuoto.
 * Quello che paghi in eccesso viene tolto dai tetti dei giocatori ancora in lista.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine } = require('../assets/js/core/engine.js');

const LISTA = [
    { name: 'Bomber', max: 40 },
    { name: 'Mezzala', max: 30 },
    { name: 'Terzino', max: 20 },
    { name: 'Riserva', max: 10 },
];

/** Budget 100, quattro giocatori da comprare: somma tetti = budget. */
const nuovo = (over = {}) => createEngine(Object.assign({
    budget: 100,
    players: LISTA,
    rosterSize: 4,
    redistribution: { strategy: 'spread', min: 1 },
}, over));

// --- il limite di spesa -----------------------------------------------------

test('il limite tiene da parte 1 credito per ogni slot ancora vuoto', () => {
    const e = nuovo();
    assert.equal(e.slotsLeft(), 4);
    assert.equal(e.reserve(), 3, 'dopo questo acquisto restano 3 slot');
    assert.equal(e.maxSpendable(), 97);
});

test('il limite si alza man mano che la rosa si riempie', () => {
    const e = nuovo();
    e.win('Riserva', 1);
    assert.equal(e.slotsLeft(), 3);
    assert.equal(e.maxSpendable(), 97, '99 rimasti meno 2 di riserva');

    e.win('Terzino', 1);
    assert.equal(e.maxSpendable(), 97, '98 rimasti meno 1 di riserva');

    e.win('Mezzala', 1);
    assert.equal(e.reserve(), 0, 'ultimo slot: niente da tenere da parte');
    assert.equal(e.maxSpendable(), 97);
});

test('senza rosa impostata il limite è semplicemente il residuo', () => {
    const e = nuovo({ rosterSize: 0 });
    assert.equal(e.slotsLeft(), 0);
    assert.equal(e.reserve(), 0);
    assert.equal(e.maxSpendable(), 100);
});

test('a rosa piena il limite torna a essere il residuo', () => {
    const e = createEngine({ budget: 100, players: LISTA, rosterSize: 1 });
    e.win('Riserva', 10);
    assert.equal(e.slotsLeft(), 0);
    assert.equal(e.maxSpendable(), 90);
});

// --- comprare sopra il tetto ------------------------------------------------

test('si può pagare più del tetto pianificato', () => {
    const e = nuovo();
    const res = e.win('Terzino', 50);   // tetto 20

    assert.ok(res.ok);
    assert.ok(res.over);
    assert.equal(e.spent, 50);
});

test('lo sforamento viene tolto ai tetti dei giocatori rimasti', () => {
    const e = nuovo();
    e.win('Terzino', 50);               // tetto 20, sforamento 30

    assert.equal(e.sumMax(), 50, '80 di tetti rimasti meno i 30 di sforamento');
    assert.equal(e.allocated(), 100, 'i conti restano chiusi sul budget');
    assert.ok(e.pool.every(p => p.max >= 1));
});

test('lo sforamento non spinge nessuno sotto 1 credito', () => {
    const e = createEngine({
        budget: 100,
        players: [{ name: 'Caro', max: 90 }, { name: 'Scarso', max: 10 }],
        rosterSize: 2,
        redistribution: { strategy: 'spread', min: 1 },
    });
    const res = e.win('Scarso', 99);    // tetto 10, sforamento 89

    assert.ok(res.ok);
    assert.equal(e.find('Caro').max, 1, 'non può scendere sotto 1');
    assert.equal(res.unabsorbed, 0, 'con la riserva attiva lo sforamento è sempre assorbibile');
    assert.equal(e.allocated(), 100);
});

test('senza riserva si può sforare fino a rendere la lista incomprabile', () => {
    // Con rosterSize 0 sparisce la rete di sicurezza: si arriva a spendere tutto
    // il residuo e i crediti da recuperare non ci sono più. Il banner lo segnala.
    const e = createEngine({
        budget: 15,
        players: [{ name: 'Caro', max: 5 }, { name: 'Scarso', max: 10 }],
        rosterSize: 0,
        redistribution: { strategy: 'spread', min: 1 },
    });
    const res = e.win('Scarso', 15);    // tetto 10, sforamento 5, ma si recuperano solo 4

    assert.ok(res.ok);
    assert.equal(e.find('Caro').max, 1);
    assert.equal(res.unabsorbed, -1, 'un credito di sforamento non recuperabile');
    assert.ok(e.allocated() > e.budget, 'ed è proprio questo che il banner segnala');
});

// --- i limiti che restano ---------------------------------------------------

test('non si può spendere più di quanto serve a completare la rosa', () => {
    const e = nuovo();
    const res = e.win('Bomber', 98);    // ne servono 3 per gli altri slot

    assert.equal(res.ok, false);
    assert.match(res.message, /al massimo 97/);
    assert.match(res.message, /3 giocatori da comprare/);
    assert.equal(e.spent, 0, 'niente è stato registrato');
    assert.equal(e.pool.length, 4, 'il giocatore è ancora in lista');
});

test('al limite esatto l acquisto passa', () => {
    const e = nuovo();
    assert.ok(e.win('Bomber', 97).ok);
    assert.equal(e.left(), 3);
    assert.equal(e.maxSpendable(), 1, 'restano 3 crediti e 3 slot: 1 a testa');
});

test('senza riserva il limite è il residuo pieno', () => {
    const e = nuovo({ rosterSize: 0 });
    assert.equal(e.win('Bomber', 101).ok, false);
    assert.ok(e.win('Bomber', 100).ok);
    assert.equal(e.left(), 0);
});

test('a crediti finiti il messaggio non parla di riserva', () => {
    const e = nuovo({ rosterSize: 0 });
    e.win('Bomber', 100);
    const res = e.win('Mezzala', 1);
    assert.equal(res.ok, false);
    assert.match(res.message, /è tutto quello che ti resta/);
});

// --- consiglio sul rilancio -------------------------------------------------

test('bidAdvice distingue "sfori il piano" da "non te lo puoi permettere"', () => {
    const e = nuovo();

    const dentro = e.bidAdvice('Terzino', 10);
    assert.equal(dentro.status, 'bid');
    assert.equal(dentro.bid, 11);
    assert.equal(dentro.overBy, 0);
    assert.equal(dentro.cap, 97);

    const sopra = e.bidAdvice('Terzino', 25);   // tetto 20
    assert.equal(sopra.status, 'over');
    assert.equal(sopra.bid, 26);
    assert.equal(sopra.overBy, 6);

    const troppo = e.bidAdvice('Terzino', 97);  // 98 supera il limite di 97
    assert.equal(troppo.status, 'stop');
    assert.equal(troppo.bid, null);
});

test('il limite di spesa compare anche nei consigli su chi non è in lista', () => {
    const e = nuovo();
    assert.equal(e.bidAdvice('Fantasma', 5).cap, 97);
});

test('la regola del 36 non fa mai sforare il limite di spesa', () => {
    const e = createEngine({
        budget: 40,
        players: [{ name: 'Big', max: 100 }, { name: 'Altro', max: 5 }],
        rosterSize: 2,
        easterEgg: true,
    });
    // Il limite è 40 - 1 = 39, quindi 36 ci sta.
    assert.equal(e.bidAdvice('Big', 10).bid, 36);

    const stretto = createEngine({
        budget: 20,
        players: [{ name: 'Big', max: 100 }],
        rosterSize: 1,
        easterEgg: true,
    });
    assert.equal(stretto.bidAdvice('Big', 10).status, 'stop', '36 non è sostenibile con 20 crediti');
});

// --- impostazione della rosa ------------------------------------------------

test('setRosterSize aggiorna il limite e rifiuta valori impossibili', () => {
    const e = nuovo();
    e.win('Riserva', 10);

    assert.ok(e.setRosterSize(6).ok);
    assert.equal(e.slotsLeft(), 5);
    assert.equal(e.maxSpendable(), 86, '90 rimasti meno 4 di riserva');

    assert.ok(e.setRosterSize(0).ok, 'zero è sempre valido: toglie la riserva');
    assert.equal(e.maxSpendable(), 90);

    assert.equal(e.setRosterSize(-1).ok, false);
    assert.equal(e.setRosterSize('molti').ok, false);
});

test('la rosa non può essere più piccola di quanti ne hai già comprati', () => {
    const e = nuovo();
    e.win('Riserva', 1);
    e.win('Terzino', 1);
    assert.match(e.setRosterSize(1).message, /già comprati 2/);
});

test('la dimensione della rosa viene salvata e ripristinata', () => {
    const { memoryBackend } = require('../assets/js/core/storage.js');
    const backend = memoryBackend();
    const opts = { storageKey: 'test:roster', storageVersion: 1, storageBackend: backend };

    const primo = nuovo(opts);
    primo.setRosterSize(11);

    const secondo = nuovo(opts);
    secondo.restore();
    assert.equal(secondo.rosterSize, 11);
});

// --- undo -------------------------------------------------------------------

test('annullare uno sforamento rimette i tetti com erano', () => {
    const e = nuovo();
    const prima = e.pool.map(p => `${p.name}:${p.max}`).sort();

    e.win('Terzino', 50);
    e.undo();

    assert.deepEqual(e.pool.map(p => `${p.name}:${p.max}`).sort(), prima);
    assert.equal(e.spent, 0);
    assert.equal(e.allocated(), 100);
    assert.equal(e.maxSpendable(), 97);
});
