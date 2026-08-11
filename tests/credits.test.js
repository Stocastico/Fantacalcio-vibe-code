const test = require('node:test');
const assert = require('node:assert/strict');
const { redistribute, revert } = require('../assets/js/core/credits.js');

const pool = (...pairs) => pairs.map(([name, max]) => ({ name, max }));
const sum = (list) => list.reduce((a, p) => a + p.max, 0);

test('spread assegna tutti i crediti anche se sono più dei giocatori rimasti', () => {
    // Questo è il bug della versione 2025/26: distribuiva al massimo un credito
    // per giocatore e il resto spariva, sballando il budget.
    const p = pool(['A', 30], ['B', 20], ['C', 10]);
    const before = sum(p);
    const res = redistribute(p, 50, { strategy: 'spread' });

    assert.equal(res.distributed, 50);
    assert.equal(sum(p), before + 50);
});

test('spread parte dai più cari e gira a rotazione', () => {
    const p = pool(['A', 30], ['B', 20], ['C', 10]);
    redistribute(p, 4, { strategy: 'spread' });
    assert.deepEqual(p.map(x => x.max), [32, 21, 11]);
});

test('even divide in parti uguali fra i primi N, il resto ai più cari', () => {
    const p = pool(['A', 100], ['B', 50], ['C', 20], ['D', 10]);
    const res = redistribute(p, 10, { strategy: 'even', topN: 3 });

    assert.equal(res.distributed, 10);
    assert.deepEqual(p.map(x => x.max), [104, 53, 23, 10]);
    assert.equal(p.find(x => x.name === 'D').max, 10, 'il quarto resta fuori');
});

test('even con importo più piccolo del numero di destinatari', () => {
    const p = pool(['A', 100], ['B', 50], ['C', 20]);
    redistribute(p, 2, { strategy: 'even', topN: 3 });
    assert.deepEqual(p.map(x => x.max), [101, 51, 20]);
});

test('un importo negativo toglie crediti invece di aggiungerli', () => {
    const p = pool(['A', 30], ['B', 20], ['C', 10]);
    const res = redistribute(p, -5, { strategy: 'spread', min: 1 });

    assert.equal(res.distributed, -5);
    assert.equal(sum(p), 55);
    assert.ok(p.every(x => x.max >= 1));
});

test('togliendo crediti non si scende mai sotto il minimo', () => {
    const p = pool(['A', 3], ['B', 2]);
    const res = redistribute(p, -100, { strategy: 'spread', min: 1 });

    assert.deepEqual(p.map(x => x.max), [1, 1]);
    assert.equal(res.distributed, -3, 'ha potuto assorbire solo 3 crediti');
    assert.equal(res.requested, -100);
});

test('pool vuoto o importo zero non fanno nulla', () => {
    assert.deepEqual(redistribute([], 20, {}), { requested: 20, distributed: 0, changes: [] });
    const p = pool(['A', 10]);
    assert.equal(redistribute(p, 0, {}).distributed, 0);
    assert.equal(p[0].max, 10);
});

test('changes registra un solo record per giocatore, con il valore di partenza', () => {
    const p = pool(['A', 10], ['B', 5]);
    const res = redistribute(p, 6, { strategy: 'spread' });

    assert.equal(res.changes.length, 2);
    assert.deepEqual(res.changes.find(c => c.name === 'A'), { name: 'A', oldMax: 10, newMax: 13 });
});

test('revert rimette i massimali com erano', () => {
    const p = pool(['A', 30], ['B', 20], ['C', 10]);
    const res = redistribute(p, 17, { strategy: 'spread' });
    revert(p, res.changes);
    assert.deepEqual(p.map(x => x.max), [30, 20, 10]);
});

test('revert ignora i giocatori non più presenti', () => {
    const p = pool(['A', 30]);
    assert.equal(revert(p, [{ name: 'Sparito', oldMax: 5 }]), 0);
    assert.equal(p[0].max, 30);
});
