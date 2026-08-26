/**
 * I file *-standalone.html sono generati: contengono una copia inline di CSS,
 * JS e liste. Se tocchi un sorgente e ti dimentichi `npm run build`, te li porti
 * all'asta vecchi — e il bello dei portabili è proprio che li usi lì.
 *
 * Il controllo è testuale: ogni asset citato dalla pagina sorgente deve
 * comparire dentro quella generata, a meno dell'indentazione che aggiunge il
 * build.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const leggi = (relPath) => readFileSync(resolve(root, relPath), 'utf8');

/** Toglie l'indentazione riga per riga: il build inline il codice rientrato di 8. */
const senzaRientri = (s) => s.split('\n').map(r => r.trimEnd().replace(/^\s+/, '')).join('\n').trim();

const PAGINE = [
    { src: 'index.html', out: 'index-standalone.html' },
    { src: 'market-auction.html', out: 'market-auction-standalone.html' },
    { src: 'inga.html', out: 'standalone_inga.html' },
];

for (const { src, out } of PAGINE) {
    const sorgente = leggi(src);
    const generata = leggi(out);
    const generataPiatta = senzaRientri(generata);

    const assets = [
        ...sorgente.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g),
        ...sorgente.matchAll(/<link\b[^>]*\bhref="([^"]+\.css)"/g),
    ].map(m => m[1]);

    test(`${out}: la pagina sorgente cita degli asset da inlinare`, () => {
        assert.ok(assets.length > 0, `nessun asset trovato in ${src}`);
    });

    for (const asset of assets) {
        test(`${out} contiene la versione aggiornata di ${asset}`, () => {
            assert.ok(
                generataPiatta.includes(senzaRientri(leggi(asset))),
                `${asset} è cambiato dopo l'ultimo build: lancia "npm run build".`
            );
        });
    }

    test(`${out} non carica più niente da fuori`, () => {
        assert.ok(!/<script\b[^>]*\bsrc=/.test(generata), 'è rimasto uno script esterno');
        assert.ok(!/<link\b[^>]*rel="stylesheet"/.test(generata), 'è rimasto un foglio di stile esterno');
    });

    test(`${out} è marcato come file generato`, () => {
        assert.match(generata, /FILE GENERATO/);
    });
}

test('la pagina d asta porta con sé anche le due liste di supporto', () => {
    const generata = leggi('index-standalone.html');
    for (const marcatore of ['ALTERNATIVES', 'BAITS', 'btnToggleAlternatives', 'btnToggleBaits', 'wrapBaits']) {
        assert.ok(generata.includes(marcatore), `manca ${marcatore} nel file portabile`);
    }
});

// --- la pagina base ---------------------------------------------------------
//
// standalone_inga.html è l'unica pagina che non porta una lista: se la carica
// da un CSV e poi si riscrive da sola, incollando i dati nel blocco
// "datiIniziali". Due cose non devono mai succedere: che il file nel repo
// contenga la lista di qualcuno, e che il blocco sparisca — senza, il bottone
// "scarica la pagina con tutto dentro" non avrebbe dove scrivere.

test('la pagina base ha il blocco dove si incollano i dati, ed è vuoto', () => {
    for (const file of ['inga.html', 'standalone_inga.html']) {
        const html = leggi(file);
        const blocco = html.match(/<script id="datiIniziali"[^>]*>([\s\S]*?)<\/script>/i);
        assert.ok(blocco, `${file}: manca il blocco datiIniziali`);
        assert.equal(blocco[1].trim(), 'null', `${file}: c'è dentro lo stato di qualcuno`);
    }
});

test('la pagina base non porta nessuna lista di giocatori', () => {
    const html = leggi('standalone_inga.html');
    assert.ok(!html.includes('FC.playersData'), 'players.js non c\'entra con questa pagina');
    assert.ok(!html.includes('FC.shortlistsData'), 'nemmeno le liste di supporto');

    // Nessun nome della lista vera deve essere finito qui dentro.
    const { PLAYERS } = require('../assets/js/data/players.js');
    for (const p of PLAYERS) {
        assert.ok(!html.includes(`"${p.name}"`), `${p.name} non dovrebbe stare nella pagina base`);
    }
});

test('la pagina base sa leggere un CSV e sa riscriversi', () => {
    const html = leggi('standalone_inga.html');
    assert.ok(html.includes('function readList'), 'senza lettore CSV non si carica niente');
    assert.ok(html.includes('id="fileCsv"'), 'manca il campo per scegliere il file');
    assert.ok(html.includes('btnSavePage'), 'manca il bottone per scaricare la pagina');
});
