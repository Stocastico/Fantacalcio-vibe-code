/**
 * Test end-to-end del convertitore: viene lanciato davvero come processo, con
 * il CSV sullo standard input e --dry-run, così non tocca i file del repo.
 *
 * Il "-" fra gli argomenti è quello che dice al tool di leggere lo standard
 * input: senza, un comando nudo rigenererebbe tutte le liste dai CSV del repo.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const TOOL = resolve(__dirname, '../tools/csv-to-lists.mjs');

function esegui(args, input = '') {
    const res = spawnSync(process.execPath, [TOOL, '--dry-run', ...args], {
        input,
        encoding: 'utf8',
        cwd: resolve(__dirname, '..'),
    });
    return { code: res.status, out: res.stdout || '', err: res.stderr || '' };
}

/** Un CSV letto dallo standard input. */
function importa(csv, args = []) {
    return esegui(['-', ...args], csv);
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

/** Il corpo di un array del file generato, senza il commento in testa. */
function corpoArray(out, nome) {
    const start = out.indexOf(`${nome} = [`);
    assert.notEqual(start, -1, `manca l'array ${nome}`);
    return out.slice(start, out.indexOf('];', start));
}

// --- fogli veri, con colonne in più -----------------------------------------

test('riconosce la colonna del massimale anche quando si chiama Offerta_max', () => {
    const { code, out } = importa(
        'Ruolo,Giocatore,Squadra,Offerta_max,Rigorista,Note\nA,Hojlund,Napoli,67,No,Riferimento offensivo\n',
        ['--budget', '67']);
    assert.equal(code, 0);
    assert.match(out, /name: "Hojlund",\s+role: "A",\s+team: "Napoli",\s+max:\s+67/);
});

test('le colonne in più del foglio non finiscono nel file generato', () => {
    const { out } = importa(
        'Ruolo,Giocatore,Squadra,Max,Rigorista,Note,Preso,Prezzo_pagato\nA,Colombo,Genoa,20,Si,Rigorista designato,,\n',
        ['--budget', '20']);
    const corpo = corpoArray(out, 'PLAYERS');
    assert.ok(!corpo.includes('Rigorista'), 'la colonna Rigorista è finita in lista');
    assert.ok(!corpo.includes('Prezzo_pagato'));
    assert.match(corpo, /\{ name: "Colombo", role: "A", team: "Genoa", max: 20 \},/);
});

test('la riga dei totali in fondo al foglio viene saltata senza lamentarsi', () => {
    const { code, out, err } = importa(
        'Ruolo,Giocatore,Squadra,Offerta_max\nP,Svilar,Roma,26\nA,Hojlund,Napoli,74\nTOTALE,,,100\n',
        ['--budget', '100']);
    assert.equal(code, 0);
    assert.match(out, /2 giocatori, somma massimali 100/);
    assert.ok(!/TOTALE/i.test(corpoArray(out, 'PLAYERS')), 'il totale è diventato un giocatore');
    assert.ok(!/nome mancante/.test(err), 'una riga di totali non è un errore da segnalare');
});

test('una riga senza nome che non è un totale viene invece segnalata', () => {
    const { err } = importa('Ruolo,Giocatore,Squadra,Max\nP,Svilar,Roma,26\nD,,Roma,10\n', ['--budget', '36']);
    assert.match(err, /nome mancante/);
});

test('anche nelle liste di supporto la riga dei totali viene saltata', () => {
    const { code, out } = importa(
        'Ruolo,Giocatore,Squadra,Offerta_max\nA,Kean,Fiorentina,60\nTOTALE,,,60\n',
        ['--target', 'esche']);
    assert.equal(code, 0);
    assert.match(out, /1 giocatori in "esche"/);
    assert.ok(!/TOTALE/i.test(corpoArray(out, 'BAITS')));
});

// --- liste di supporto ------------------------------------------------------

const CSV_SUPPORTO = `Ruolo,Giocatore,Squadra
C,Zaccagni,Lazio
A,Cutrone,Como
`;

test('le liste di supporto non vogliono la colonna del massimale', () => {
    const { code, out } = importa(CSV_SUPPORTO, ['--target', 'alternative']);
    assert.equal(code, 0);
    assert.match(out, /name: "Zaccagni",\s+role: "C",\s+team: "Lazio"/);
    assert.ok(!corpoArray(out, 'ALTERNATIVES').includes('max:'), 'qui i crediti non c\'entrano');
});

test('un massimale nel CSV delle liste di supporto viene ignorato', () => {
    const { code, out } = importa('Nome,Ruolo,Squadra,Max\nZaccagni,C,Lazio,99\n', ['--target', 'esche']);
    assert.equal(code, 0);
    assert.ok(!corpoArray(out, 'BAITS').includes('max:'));
    assert.ok(!corpoArray(out, 'BAITS').includes('99'));
});

test('importare una lista di supporto non svuota l altra', () => {
    const { code, out } = importa(CSV_SUPPORTO, ['--target', 'alternative']);
    assert.equal(code, 0);
    // Le esche non le ho toccate: arrivano dal loro CSV nel repo.
    assert.match(out, /const BAITS = \[\n\s+\{ name: "/);
    assert.match(out, /liste\/esche\.csv/);
});

test('le due liste di supporto stanno in un file solo, con le due costanti', () => {
    const { out } = importa(CSV_SUPPORTO, ['--target', 'esche']);
    assert.match(out, /const api = \{ ALTERNATIVES, BAITS \};/);
    assert.match(out, /global\.FC\.shortlistsData/);
    assert.match(out, /assets\/js\/data\/shortlists\.js non scritto/);
});

test('il file generato per le liste di supporto è JavaScript valido', () => {
    const { out } = importa(CSV_SUPPORTO, ['--target', 'alternative']);
    const codice = out.slice(out.indexOf('/**'));
    assert.doesNotThrow(() => new Function(codice));
});

test('anche nelle liste di supporto duplicati e righe rotte vengono segnalati', () => {
    const { code, err, out } = importa('Nome,Squadra\nLeao,Milan\nleao,Milan\n,Inter\n', ['--target', 'esche']);
    assert.equal(code, 0);
    assert.match(err, /duplicato/);
    assert.match(err, /nome mancante/);
    assert.match(out, /1 giocatori in "esche"/);
});

test('una lista di supporto senza righe valide non scrive niente', () => {
    const { code, err } = importa('Nome,Squadra\n,\n', ['--target', 'alternative']);
    assert.equal(code, 1);
    assert.match(err, /nessuna riga valida|nessuna riga di dati/i);
});

test('--target shortlists rigenera tutte e due dai CSV del repo', () => {
    const { code, out, err } = esegui(['--target', 'shortlists']);
    assert.equal(code, 0, err);
    assert.match(out, /liste\/alternative\.csv → \d+ giocatori in "alternative"/);
    assert.match(out, /liste\/esche\.csv → \d+ giocatori in "esche"/);
    assert.ok(!out.includes('assets/js/data/players.js non scritto'),
        'la lista d\'asta non viene rigenerata');
});

// --- il comando nudo --------------------------------------------------------

test('senza argomenti rigenera tutte e tre le liste dai CSV del repo', () => {
    const { code, out, err } = esegui([]);
    assert.equal(code, 0, err);
    assert.match(out, /liste\/lista\.csv → 25 giocatori/);
    assert.match(out, /liste\/alternative\.csv/);
    assert.match(out, /liste\/esche\.csv/);
    assert.match(out, /assets\/js\/data\/players\.js non scritto/);
    assert.match(out, /assets\/js\/data\/shortlists\.js non scritto/);
});

test('la lista d asta di default esce dal CSV del repo e quadra col budget', () => {
    const { out } = esegui([]);
    assert.match(out, /somma massimali 500, budget 500/);
    assert.match(out, /const AUCTION_BUDGET = 500;/);
    assert.match(out, /const ROSTER_SIZE = 25;/);
});

test('il mercato di riparazione non ha un CSV suo: senza file lo dice', () => {
    const { code, err } = esegui(['--target', 'market']);
    assert.equal(code, 1);
    assert.match(err, /nessun CSV indicato/);
});

test('un file passato a mano ha la precedenza sul CSV del repo', () => {
    const { code, out } = esegui(['liste/alternative.csv', '--target', 'esche']);
    assert.equal(code, 0);
    // Le esche diventano il contenuto del CSV delle alternative.
    assert.match(corpoArray(out, 'BAITS'), /Carnesecchi/);
});

// --- CSV mancante -----------------------------------------------------------

/**
 * Le due liste stanno in un file solo, quindi importarne una riscrive anche
 * l'altra: se il CSV dell'altra è sparito, la cosa giusta è tenere quella già
 * generata, non azzerarla in silenzio.
 */
test('se manca il CSV di una lista di supporto, quella lista non viene persa', () => {
    const { mkdtempSync, cpSync, rmSync, existsSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { join } = require('node:path');

    const root = resolve(__dirname, '..');
    const copia = mkdtempSync(join(tmpdir(), 'fanta-'));
    cpSync(root, copia, {
        recursive: true,
        filter: (src) => !/(\.git|node_modules|2025-2026)$/.test(src),
    });

    try {
        rmSync(join(copia, 'liste/esche.csv'));
        assert.ok(!existsSync(join(copia, 'liste/esche.csv')));

        const res = spawnSync(process.execPath, [
            resolve(copia, 'tools/csv-to-lists.mjs'), '--dry-run', '--target', 'alternative',
        ], { encoding: 'utf8', cwd: copia, input: '' });

        assert.equal(res.status, 0, res.stderr);
        assert.match(res.stderr, /esche.*non leggibile|non leggibile.*esche/);
        // Le esche restano quelle del file già generato.
        const { BAITS } = require('../assets/js/data/shortlists.js');
        for (const p of BAITS) assert.ok(res.stdout.includes(`"${p.name}"`), `persa l'esca ${p.name}`);
    } finally {
        rmSync(copia, { recursive: true, force: true });
    }
});
