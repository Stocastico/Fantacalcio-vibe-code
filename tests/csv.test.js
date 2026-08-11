const test = require('node:test');
const assert = require('node:assert/strict');
const { toCSV, stampedName, download } = require('../assets/js/core/csv.js');

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
