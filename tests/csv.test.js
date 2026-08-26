const test = require('node:test');
const assert = require('node:assert/strict');
const { toCSV, stampedName, download, parse, readList } = require('../assets/js/core/csv.js');

test('toCSV quota tutti i campi e raddoppia le virgolette', () => {
    const csv = toCSV([
        ['Nome', 'Prezzo'],
        ['Lautaro Martínez', 90],
        ['Un "soprannome"', 5],
        ['Cognome, Nome', 1],
    ]);

    assert.equal(csv.split('\r\n')[1], '"Lautaro Martínez","90"');
    assert.equal(csv.split('\r\n')[2], '"Un ""soprannome""","5"');
    assert.equal(csv.split('\r\n')[3], '"Cognome, Nome","1"');
});

test('toCSV gestisce celle vuote e righe vuote', () => {
    assert.equal(toCSV([[null, undefined, '']]), '"","",""');
    assert.equal(toCSV([['a'], [], ['b']]), '"a"\r\n\r\n"b"');
});

test('stampedName mette la data di oggi nel nome file', () => {
    const oggi = new Date().toISOString().slice(0, 10);
    assert.equal(stampedName('acquisti'), `acquisti_${oggi}.csv`);
});

test('download non esplode fuori dal browser', () => {
    assert.equal(download('x.csv', 'a,b'), false);
});

// --- lettura ---------------------------------------------------------------
//
// Lo stesso lettore lo usano `npm run import` da Node e la pagina base quando
// carichi un CSV a mano: un file accettato da una parte dev'essere accettato
// anche dall'altra, ed è per questo che sta nel core.

const righe = (testo, opts) => readList(testo, opts).records;

test('parse: virgolette, virgole nei campi, punto e virgola e CRLF', () => {
    assert.deepEqual(parse('a,b\r\n"c, con virgola",d\n'), [['a', 'b'], ['c, con virgola', 'd']]);
    assert.deepEqual(parse('a;b\nc;d'), [['a', 'b'], ['c', 'd']]);
    assert.deepEqual(parse('"dice ""ciao""",1'), [['dice "ciao"', '1']]);
});

test('parse: righe vuote e BOM di Excel non diventano dati', () => {
    assert.deepEqual(parse('﻿Nome,Max\n\n\nTizio,5\n'), [['Nome', 'Max'], ['Tizio', '5']]);
    assert.deepEqual(parse(''), []);
});

test('legge un CSV con intestazione, in qualsiasi ordine di colonne', () => {
    assert.deepEqual(righe('Squadra,Max,Giocatore\nInter,84,Lautaro\n', { needMax: true }),
        [{ name: 'Lautaro', role: '', team: 'Inter', max: '84' }]);
});

test('riconosce i nomi italiani e inglesi della colonna del tetto', () => {
    for (const testata of ['Max', 'Massimale', 'Tetto', 'Bid', 'Crediti', 'Offerta_massima', 'Offerta_max', 'Budget']) {
        assert.deepEqual(righe(`Giocatore,${testata}\nLautaro,84\n`, { needMax: true })[0].max, '84', testata);
    }
});

test('senza intestazione assume "nome, offerta massima"', () => {
    const letto = readList('Lautaro,84\nKean,60\n', { needMax: true });
    assert.equal(letto.conIntestazione, false);
    assert.deepEqual(letto.records.map(r => [r.name, r.max]), [['Lautaro', '84'], ['Kean', '60']]);
});

test('con intestazione la prima riga non diventa un giocatore', () => {
    const letto = readList('Giocatore,Offerta_massima\nLautaro,84\n', { needMax: true });
    assert.equal(letto.conIntestazione, true);
    assert.equal(letto.records.length, 1);
});

test('le colonne che non conosce le lascia dove sono', () => {
    const r = righe('Ruolo,Giocatore,Squadra,Max,Rigorista,Note\nA,Hojlund,Napoli,67,No,Titolare\n', { needMax: true })[0];
    assert.deepEqual(r, { name: 'Hojlund', role: 'A', team: 'Napoli', max: '67' });
});

test('la riga dei totali in fondo al foglio viene saltata', () => {
    for (const coda of ['TOTALE,,,500', 'Totali,,,500', 'somma,,,500']) {
        const r = righe(`Ruolo,Giocatore,Squadra,Max\nP,Svilar,Roma,26\n${coda}\n`, { needMax: true });
        assert.equal(r.length, 1, coda);
    }
});

test('una riga senza nome che non è un totale resta, e la scarta chi valida', () => {
    const r = righe('Ruolo,Giocatore,Squadra,Max\nP,Svilar,Roma,26\nD,,Roma,10\n', { needMax: true });
    assert.equal(r.length, 2);
    assert.equal(r[1].name, '');
});

test('senza colonna del nome non si legge niente', () => {
    assert.throws(() => readList('Squadra,Max\nRoma,10\n', { needMax: true }), /colonna del nome/);
});

test('senza colonna del tetto si legge solo dove il tetto non serve', () => {
    assert.throws(() => readList('Giocatore,Squadra\nLautaro,Inter\n', { needMax: true }), /colonna del massimale/);
    assert.deepEqual(righe('Giocatore,Squadra\nLautaro,Inter\n', { needMax: false }),
        [{ name: 'Lautaro', role: '', team: 'Inter', max: '' }]);
});

test('un file vuoto o con la sola intestazione lo dice invece di fingere', () => {
    assert.throws(() => readList('', { needMax: true }), /vuoto/);
    assert.throws(() => readList('Giocatore,Max\n', { needMax: true }), /Nessuna riga di dati/);
});
