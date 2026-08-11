/**
 * Controlli sui file dati veri, non su liste giocattolo.
 *
 * Servono a beccare un errore di battitura in players.js *prima* dell'asta,
 * invece che a metà, quando i conti smettono di tornare.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlayers, VALID_ROLES } = require('../assets/js/core/engine.js');

const listini = [
    { label: 'players.js', ...require('../assets/js/data/players.js'), budgetKey: 'AUCTION_BUDGET', listKey: 'PLAYERS' },
    { label: 'market-pool.js', ...require('../assets/js/data/market-pool.js'), budgetKey: 'MARKET_BUDGET', listKey: 'MARKET_POOL' },
];

for (const listino of listini) {
    const lista = listino[listino.listKey];
    const budget = listino[listino.budgetKey];

    test(`${listino.label}: tutte le righe sono valide`, () => {
        const { players, problems } = normalizePlayers(lista);
        assert.deepEqual(problems, [], 'righe scartate dal motore');
        assert.equal(players.length, lista.length);
    });

    test(`${listino.label}: nessun nome duplicato`, () => {
        const { players } = normalizePlayers(lista);
        assert.equal(new Set(players.map(p => p.name.toLowerCase())).size, players.length);
    });

    test(`${listino.label}: i massimali sono interi positivi`, () => {
        for (const p of lista) {
            assert.ok(Number.isInteger(p.max) && p.max >= 1, `${p.name}: max = ${p.max}`);
        }
    });

    test(`${listino.label}: i ruoli, se ci sono, sono P/D/C/A`, () => {
        for (const p of lista) {
            if (p.role !== undefined) assert.ok(VALID_ROLES.includes(p.role), `${p.name}: ruolo "${p.role}"`);
        }
    });

    // Pianificare meno del budget è legittimo (tieni una riserva); pianificare
    // più del budget no: vuol dire che la lista non è comprabile per intero.
    test(`${listino.label}: la somma dei massimali non supera il budget`, () => {
        const somma = lista.reduce((a, p) => a + p.max, 0);
        assert.ok(somma <= budget, `somma ${somma}, budget ${budget}: eccesso ${somma - budget}`);
    });
}

test('players.js: la somma dei massimali fa esattamente il budget', () => {
    const { PLAYERS, AUCTION_BUDGET } = require('../assets/js/data/players.js');
    const somma = PLAYERS.reduce((a, p) => a + p.max, 0);
    assert.equal(somma, AUCTION_BUDGET, `somma ${somma}, budget ${AUCTION_BUDGET}`);
});

test('players.js: la lista 2026/27 ha la composizione attesa', () => {
    const { PLAYERS } = require('../assets/js/data/players.js');
    const perRuolo = PLAYERS.reduce((m, p) => (m[p.role] = (m[p.role] || 0) + 1, m), {});
    assert.deepEqual(perRuolo, { P: 3, D: 8, C: 8, A: 6 });
    assert.equal(PLAYERS.length, 25);
    assert.ok(PLAYERS.every(p => p.team), 'ogni giocatore ha la squadra');
});
