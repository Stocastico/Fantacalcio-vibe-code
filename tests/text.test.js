const test = require('node:test');
const assert = require('node:assert/strict');
const { norm, sameName, toInt, findCandidates, sortByRole, sortByMaxDesc } = require('../assets/js/core/text.js');

test('norm toglie accenti, maiuscole e spazi di troppo', () => {
    assert.equal(norm('Vlahović'), 'vlahovic');
    assert.equal(norm('  Lautaro   Martínez '), 'lautaro martinez');
    assert.equal(norm(undefined), '');
});

test('sameName confronta ignorando accenti, ma non fa matchare il vuoto', () => {
    assert.ok(sameName('Vlahović', 'vlahovic'));
    assert.ok(!sameName('', ''));
    assert.ok(!sameName('Gatti', 'Gatto'));
});

test('toInt distingue "vuoto" da "zero"', () => {
    assert.equal(toInt(''), null);
    assert.equal(toInt(null), null);
    assert.equal(toInt('non un numero'), null);
    assert.equal(toInt(0), 0);
    assert.equal(toInt('0'), 0);
    assert.equal(toInt('3.6'), 4);
    assert.equal(toInt(-2), -2);
});

test('findCandidates preferisce il match esatto a quello parziale', () => {
    const list = [{ name: 'Thuram', max: 50 }, { name: 'Thuram-Ulien', max: 5 }];
    assert.deepEqual(findCandidates('Thuram', list).map(p => p.name), ['Thuram']);
    assert.equal(findCandidates('thur', list).length, 2);
});

test('findCandidates ignora accenti e query vuote', () => {
    const list = [{ name: 'Vlahović', max: 35 }];
    assert.equal(findCandidates('vlahovic', list).length, 1);
    assert.equal(findCandidates('   ', list).length, 0);
    assert.equal(findCandidates('x', null).length, 0);
});

test('sortByMaxDesc ordina per massimale e poi per nome', () => {
    const list = [{ name: 'Bbb', max: 10 }, { name: 'Aaa', max: 10 }, { name: 'Ccc', max: 20 }];
    assert.deepEqual(sortByMaxDesc(list).map(p => p.name), ['Ccc', 'Aaa', 'Bbb']);
});

test('sortByRole mette i ruoli in ordine P, D, C, A e i senza-ruolo in fondo', () => {
    const list = [
        { name: 'Att', role: 'A', max: 1 },
        { name: 'Por', role: 'P', max: 1 },
        { name: 'Nes', max: 1 },
        { name: 'Cen', role: 'C', max: 1 },
    ];
    assert.deepEqual(sortByRole(list).map(p => p.name), ['Por', 'Cen', 'Att', 'Nes']);
});
