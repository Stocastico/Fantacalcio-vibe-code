/**
 * Le due liste di supporto: alternative e "da chiamare all'inizio".
 *
 * Coprono le due cose che possono rompersi davvero: che togliere un giocatore
 * lo tolga per davvero, e che le rimozioni salvate si ricarichino su una lista
 * che nel frattempo può essere cambiata (i nomi li modifichi a mano nel file).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createShortlists, normalizeEntries } = require('../assets/js/core/shortlists.js');
const { VALID_ROLES } = require('../assets/js/core/engine.js');
const data = require('../assets/js/data/shortlists.js');

const defs = () => ([
    {
        id: 'alternatives',
        label: 'Alternative',
        players: [
            { name: 'Zaccagni', role: 'C', team: 'Lazio' },
            { name: 'Cutrone', role: 'A', team: 'Como' },
        ],
    },
    {
        id: 'baits',
        label: "Da chiamare all'inizio",
        players: [{ name: 'Leao', role: 'A', team: 'Milan' }],
    },
]);

test('normalizeEntries: tiene nome, ruolo e squadra e butta via il massimale', () => {
    const { entries, problems } = normalizeEntries([{ name: 'Kean', role: 'a', team: 'Fiorentina', max: 99 }]);
    assert.deepEqual(entries, [{ name: 'Kean', role: 'A', team: 'Fiorentina' }]);
    assert.deepEqual(problems, []);
});

test('normalizeEntries: scarta righe senza nome, doppioni e ruoli inventati', () => {
    const { entries, problems } = normalizeEntries([
        { name: '  ' },
        { name: 'Leao', role: 'A' },
        { name: 'leào', role: 'A' },
        { name: 'Rowe', role: 'Z' },
    ]);
    assert.deepEqual(entries.map(p => p.name), ['Leao', 'Rowe']);
    assert.equal(entries[1].role, undefined, 'un ruolo non valido sparisce, la riga resta');
    assert.equal(problems.length, 2);
});

test('items: l\'ordine è quello del file, non si riordina', () => {
    const l = createShortlists(defs());
    assert.deepEqual(l.items('alternatives').map(p => p.name), ['Zaccagni', 'Cutrone']);
    assert.deepEqual(l.ids(), ['alternatives', 'baits']);
    assert.equal(l.label('baits'), "Da chiamare all'inizio");
});

test('remove: toglie il giocatore, ignorando accenti e maiuscole', () => {
    const l = createShortlists(defs());
    const res = l.remove('alternatives', 'zaccagni');
    assert.equal(res.ok, true);
    assert.equal(res.entry.name, 'Zaccagni');
    assert.deepEqual(l.items('alternatives').map(p => p.name), ['Cutrone']);
    assert.equal(l.removedCount('alternatives'), 1);
    assert.equal(l.size('alternatives'), 2, 'la lista di partenza non cambia');
});

test('remove: due volte lo stesso, o uno che non c\'è, non passa', () => {
    const l = createShortlists(defs());
    l.remove('alternatives', 'Zaccagni');
    assert.equal(l.remove('alternatives', 'Zaccagni').ok, false);
    assert.equal(l.remove('alternatives', 'Hojlund').ok, false);
    assert.equal(l.remove('inesistente', 'Zaccagni').ok, false);
    assert.equal(l.removedCount('alternatives'), 1);
});

test('remove: le due liste sono indipendenti', () => {
    const l = createShortlists(defs());
    l.remove('baits', 'Leao');
    assert.deepEqual(l.items('baits'), []);
    assert.equal(l.items('alternatives').length, 2);
});

test('restore e restoreAll: rimettono dentro chi avevi tolto', () => {
    const l = createShortlists(defs());
    l.remove('alternatives', 'Zaccagni');
    l.remove('baits', 'Leao');

    assert.deepEqual(l.restore('alternatives'), { ok: true, count: 1 });
    assert.equal(l.items('alternatives').length, 2);
    assert.equal(l.items('baits').length, 0, 'restore tocca solo la lista chiesta');

    assert.deepEqual(l.restoreAll(), { ok: true, count: 1 });
    assert.equal(l.items('baits').length, 1);
});

test('toState/fromState: le rimozioni sopravvivono al refresh', () => {
    const prima = createShortlists(defs());
    prima.remove('alternatives', 'Cutrone');

    const dopo = createShortlists(defs());
    assert.equal(dopo.fromState(prima.toState()), true);
    assert.deepEqual(dopo.items('alternatives').map(p => p.name), ['Zaccagni']);
});

test('fromState: uno stato assente o rotto lascia le liste intere', () => {
    const l = createShortlists(defs());
    assert.equal(l.fromState(undefined), false);
    assert.equal(l.fromState('boh'), false);
    l.fromState({ alternatives: 'non è un array', baits: null });
    assert.equal(l.items('alternatives').length, 2);
    assert.equal(l.items('baits').length, 1);
});

test('fromState: i nomi che nel frattempo hai tolto dal file vengono ignorati', () => {
    const l = createShortlists(defs());
    l.fromState({ alternatives: ['Zaccagni', 'Uno Che Non Esiste Più'] });
    assert.deepEqual(l.items('alternatives').map(p => p.name), ['Cutrone']);
    assert.equal(l.removedCount('alternatives'), 1);
});

test('fromState: ricaricare uno stato sovrascrive quello che c\'era', () => {
    const l = createShortlists(defs());
    l.remove('alternatives', 'Zaccagni');
    l.fromState({ alternatives: ['Cutrone'] });
    assert.deepEqual(l.items('alternatives').map(p => p.name), ['Zaccagni']);
});

// --- il file dati vero -----------------------------------------------------

for (const [chiave, lista] of Object.entries(data)) {
    test(`shortlists.js: ${chiave} è utilizzabile così com'è`, () => {
        const { entries, problems } = normalizeEntries(lista);
        assert.deepEqual(problems, [], 'righe scartate');
        assert.equal(entries.length, lista.length);
        assert.ok(entries.length > 0, 'lista vuota');
    });

    test(`shortlists.js: ${chiave} ha ruoli P/D/C/A e squadra`, () => {
        for (const p of lista) {
            assert.ok(VALID_ROLES.includes(p.role), `${p.name}: ruolo "${p.role}"`);
            assert.ok(p.team, `${p.name}: squadra mancante`);
            assert.equal(p.max, undefined, `${p.name}: qui i massimali non servono`);
        }
    });
}

test('shortlists.js: nessuno compare in tutte e due le liste', () => {
    const alt = new Set(data.ALTERNATIVES.map(p => p.name.toLowerCase()));
    const doppi = data.BAITS.filter(p => alt.has(p.name.toLowerCase()));
    assert.deepEqual(doppi, [], 'un\'esca non può essere anche un ripiego');
});
