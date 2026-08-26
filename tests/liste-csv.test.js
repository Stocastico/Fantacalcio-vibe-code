/**
 * I CSV in liste/ sono la sorgente vera delle liste; i file sotto
 * assets/js/data/ sono generati da lì con `npm run import`.
 *
 * Questi test tengono insieme le due cose: che i CSV siano leggibili e sensati,
 * e che i .js committati siano esattamente quelli che i CSV producono adesso.
 * Se modifichi un CSV e ti dimentichi l'import, il fallimento arriva qui invece
 * che a metà asta.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const TOOL = resolve(root, 'tools/csv-to-lists.mjs');

const players = require('../assets/js/data/players.js');
const shortlists = require('../assets/js/data/shortlists.js');

const CSV = {
    lista: 'liste/lista.csv',
    alternative: 'liste/alternative.csv',
    esche: 'liste/esche.csv',
};

/** Parser minimo, apposta diverso da quello del tool: due bug uguali sono improbabili. */
function leggiCSV(relPath) {
    const testo = readFileSync(resolve(root, relPath), 'utf8').replace(/^﻿/, '');
    const righe = testo.split(/\r?\n/).filter(r => r.trim() !== '');
    const intestazione = righe[0].split(',').map(c => c.trim().toLowerCase());
    return righe.slice(1).map(riga => {
        const celle = riga.split(',').map(c => c.trim());
        return Object.fromEntries(intestazione.map((h, i) => [h, celle[i] ?? '']));
    });
}

/** Lancia il tool in dry-run e ricava il contenuto che scriverebbe in ogni file. */
function generati(args = []) {
    const res = spawnSync(process.execPath, [TOOL, '--dry-run', ...args], {
        encoding: 'utf8',
        cwd: root,
        input: '',
    });
    assert.equal(res.status, 0, `il tool è uscito con errore: ${res.stderr}`);

    const out = res.stdout;
    const marcatore = /\n--- dry run, (.+?) non scritto ---\n/g;
    const blocchi = {};
    const punti = [...out.matchAll(marcatore)];
    punti.forEach((m, i) => {
        const inizio = m.index + m[0].length;
        const fine = i + 1 < punti.length ? punti[i + 1].index : out.length;
        blocchi[m[1]] = out.slice(inizio, fine);
    });
    return blocchi;
}

// --- i CSV -----------------------------------------------------------------

for (const [nome, path] of Object.entries(CSV)) {
    test(`${path} esiste e ha righe di dati`, () => {
        assert.ok(existsSync(resolve(root, path)), `manca ${path}`);
        assert.ok(leggiCSV(path).length > 0, 'solo intestazione, nessun giocatore');
    });

    test(`${path}: ogni riga ha nome, ruolo e squadra`, () => {
        for (const riga of leggiCSV(path)) {
            assert.ok(riga.giocatore, `riga senza nome in ${path}`);
            assert.ok(['P', 'D', 'C', 'A'].includes(riga.ruolo), `${riga.giocatore}: ruolo "${riga.ruolo}"`);
            assert.ok(riga.squadra, `${riga.giocatore}: squadra mancante`);
        }
    });

    test(`${path}: nessun nome ripetuto`, () => {
        const nomi = leggiCSV(path).map(r => r.giocatore.toLowerCase());
        assert.equal(new Set(nomi).size, nomi.length, `nomi doppi in ${path}`);
    });
}

test('liste/lista.csv: i massimali sono interi positivi e sommano al budget', () => {
    const righe = leggiCSV(CSV.lista);
    let somma = 0;
    for (const riga of righe) {
        const max = Number(riga.max);
        assert.ok(Number.isInteger(max) && max >= 1, `${riga.giocatore}: max "${riga.max}"`);
        somma += max;
    }
    assert.equal(somma, players.AUCTION_BUDGET, 'la somma dei tetti deve fare il budget');
});

test('le due liste di supporto non hanno la colonna del massimale', () => {
    for (const path of [CSV.alternative, CSV.esche]) {
        const intestazione = readFileSync(resolve(root, path), 'utf8').split(/\r?\n/)[0].toLowerCase();
        assert.ok(!/\bmax\b|massimale|tetto/.test(intestazione), `${path}: qui i crediti non servono`);
    }
});

// --- CSV e file generati dicono la stessa cosa ------------------------------

const stessoContenuto = (righeCSV, lista) => {
    assert.equal(lista.length, righeCSV.length, 'numero di giocatori diverso');
    righeCSV.forEach((riga, i) => {
        assert.equal(lista[i].name, riga.giocatore, `riga ${i + 1}: nome diverso`);
        assert.equal(lista[i].role, riga.ruolo, `${riga.giocatore}: ruolo diverso`);
        assert.equal(lista[i].team, riga.squadra, `${riga.giocatore}: squadra diversa`);
    });
};

test('shortlists.js dice esattamente quello che dicono i due CSV, nello stesso ordine', () => {
    stessoContenuto(leggiCSV(CSV.alternative), shortlists.ALTERNATIVES);
    stessoContenuto(leggiCSV(CSV.esche), shortlists.BAITS);
});

test('players.js contiene gli stessi giocatori di liste/lista.csv', () => {
    const righe = leggiCSV(CSV.lista);
    assert.equal(players.PLAYERS.length, righe.length);

    const daCSV = new Map(righe.map(r => [r.giocatore.toLowerCase(), r]));
    for (const p of players.PLAYERS) {
        const riga = daCSV.get(p.name.toLowerCase());
        assert.ok(riga, `${p.name} non è nel CSV`);
        assert.equal(p.role, riga.ruolo, `${p.name}: ruolo diverso`);
        assert.equal(p.team, riga.squadra, `${p.name}: squadra diversa`);
        assert.equal(p.max, Number(riga.max), `${p.name}: massimale diverso`);
    }
});

// --- niente deriva fra CSV e file generati ---------------------------------

test('i file generati sono aggiornati: rifare l import non cambierebbe niente', () => {
    const blocchi = generati();
    const attesi = ['assets/js/data/players.js', 'assets/js/data/shortlists.js'];
    assert.deepEqual(Object.keys(blocchi).sort(), [...attesi].sort());

    for (const file of attesi) {
        const suDisco = readFileSync(resolve(root, file), 'utf8');
        // trim ai bordi: il dry-run stampa una riga vuota prima del contenuto.
        assert.equal(
            blocchi[file].trim(),
            suDisco.trim(),
            `${file} non corrisponde ai CSV: lancia "npm run import".`
        );
    }
});
