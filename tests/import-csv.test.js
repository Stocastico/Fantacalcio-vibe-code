/**
 * Test end-to-end del convertitore: viene lanciato davvero come processo, con
 * il CSV sullo standard input e --dry-run, così non tocca i file del repo.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const TOOL = resolve(__dirname, '../tools/csv-to-players.mjs');

function importa(csv, args = []) {
    const res = spawnSync(process.execPath, [TOOL, '--dry-run', ...args], {
        input: csv,
        encoding: 'utf8',
    });
    return { code: res.status, out: res.stdout || '', err: res.stderr || '' };
}

const CSV = `Ruolo,Giocatore,Squadra,Max
P,Svilar,Roma,36
D,N'Dicka,Roma,23
A,Hojlund,Napoli,41
`;

test('converte un CSV con intestazioni italiane', () => {
    const { code, out } = importa(CSV, ['--budget', '100']);
    assert.equal(code, 0);
    assert.match(out, /3 giocatori, somma massimali 100/);
    assert.match(out, /const AUCTION_BUDGET = 100;/);
    assert.match(out, /name: "Svilar",\s+role: "P",\s+team: "Roma",\s+max:\s+36/);
});

test('gli apostrofi nei nomi non rompono il file generato', () => {
    const { out } = importa(CSV, ['--budget', '100']);
    assert.match(out, /name: "N'Dicka"/);
    // Il file generato deve essere JavaScript valido.
    assert.doesNotThrow(() => new Function(out.slice(out.indexOf('/**'))));
});

test('raggruppa per ruolo in ordine P, D, C, A', () => {
    const { out } = importa(CSV, ['--budget', '100']);
    const ordine = ['Portieri', 'Difensori', 'Attaccanti'].map(r => out.indexOf(r));
    assert.deepEqual(ordine, [...ordine].sort((a, b) => a - b));
    assert.ok(!out.includes('Centrocampisti'), 'niente intestazione per un ruolo assente');
});

test('accetta anche intestazioni inglesi', () => {
    const { code, out } = importa('Role,Name,Team,Max\nA,Hojlund,Napoli,50\n', ['--budget', '50']);
    assert.equal(code, 0);
    assert.match(out, /name: "Hojlund",\s+role: "A",\s+team: "Napoli",\s+max:\s+50/);
});

test('gestisce i campi fra virgolette con virgole dentro', () => {
    const { code, out } = importa('Nome,Max\n"Rossi, Paolo",10\n');
    assert.equal(code, 0);
    assert.match(out, /name: "Rossi, Paolo"/);
});

test('senza colonna del nome si ferma senza scrivere', () => {
    const { code, err } = importa('Squadra,Max\nRoma,10\n');
    assert.equal(code, 1);
    assert.match(err, /Non trovo la colonna del nome/);
});

test('senza colonna del massimale si ferma senza scrivere', () => {
    const { code, err } = importa('Nome,Squadra\nSvilar,Roma\n');
    assert.equal(code, 1);
    assert.match(err, /Non trovo la colonna del massimale/);
});

test('segnala i duplicati e le righe rotte invece di ingoiarle', () => {
    const { code, err, out } = importa('Nome,Max\nSvilar,36\nsvilar,99\nSenzaTetto,\n');
    assert.equal(code, 0);
    assert.match(err, /duplicato/);
    assert.match(err, /massimale non valido/);
    assert.match(out, /1 giocatori/);
});

test('avvisa quando la somma non quadra col budget', () => {
    const { code, err } = importa(CSV, ['--budget', '500']);
    assert.equal(code, 0);
    assert.match(err, /Somma massimali \(100\) diversa dal budget \(500\)/);
});

test('per il mercato genera l altro file, senza ruoli e ordinato per massimale', () => {
    const { code, out } = importa('Nome,Max\nPiccolo,5\nGrosso,50\n', ['--target', 'market', '--budget', '55']);
    assert.equal(code, 0);
    assert.match(out, /const MARKET_BUDGET = 55;/);
    assert.match(out, /global\.FC\.marketData/);
    assert.ok(out.indexOf('Grosso') < out.indexOf('Piccolo'), 'il più caro viene per primo');

    // Solo il corpo dell'array: il commento in testa al file cita "role:" come
    // documentazione del formato, e non deve far fallire il controllo.
    const corpo = out.slice(out.indexOf('MARKET_POOL = ['), out.indexOf('];'));
    assert.ok(!corpo.includes('role:'), 'senza ruoli non aggiunge la colonna');
});

// La rosa da completare non si deduce dalla lista: puoi desiderare 20 giocatori
// e doverne comunque avere 25. Un import non deve perdere questo dato.
test('la lista d asta dichiara quanti giocatori deve avere la rosa', () => {
    const { out } = importa(CSV, ['--budget', '100']);
    assert.match(out, /const ROSTER_SIZE = 25;/, 'di default la rosa del fantacalcio');
    assert.match(out, /const api = \{ AUCTION_BUDGET, ROSTER_SIZE, PLAYERS \};/);
});

test('--roster cambia la rosa e il tool dice quanti slot restano fuori lista', () => {
    const { out } = importa(CSV, ['--budget', '100', '--roster', '30']);
    assert.match(out, /const ROSTER_SIZE = 30;/);
    assert.match(out, /27 slot li riempirai fuori lista/);
});

test('il mercato di riparazione non ha una rosa da completare', () => {
    const { out } = importa('Nome,Max\nTizio,5\n', ['--target', 'market', '--budget', '5']);
    assert.ok(!out.includes('ROSTER_SIZE'), 'lì gli slot non c\'entrano');
});

test('un target inesistente non fa danni', () => {
    const { code, err } = importa(CSV, ['--target', 'inventato']);
    assert.equal(code, 1);
    assert.match(err, /--target sconosciuto/);
});
