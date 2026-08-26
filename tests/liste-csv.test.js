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

/**
 * Le colonne dei CSV le scrivi tu, quindi vanno riconosciute per sinonimo come
 * fa il tool. Gli alias sono ripetuti qui apposta: se il test riusasse la
 * tabella del tool, un alias sbagliato passerebbe inosservato da tutte e due
 * le parti.
 */
const ALIAS = {
    nome: ['giocatore', 'nome', 'name', 'player'],
    ruolo: ['ruolo', 'role'],
    squadra: ['squadra', 'team', 'club'],
    max: ['max', 'massimale', 'tetto', 'bid', 'crediti',
          'offerta_massima', 'offerta massima', 'offerta_max', 'offerta max', 'budget'],
};

const RIEPILOGHI = ['totale', 'totali', 'total', 'somma', 'sum'];

/** Parser minimo, apposta diverso da quello del tool: due bug uguali sono improbabili. */
function leggiCSV(relPath) {
    const testo = readFileSync(resolve(root, relPath), 'utf8').replace(/^﻿/, '');
    const righe = testo.split(/\r?\n/).filter(r => r.trim() !== '');
    const intestazione = righe[0].split(',').map(c => c.trim().toLowerCase());

    // Da intestazione a campo del modello: "Offerta_max" → max, "Note" → niente.
    const campo = intestazione.map(h => {
        for (const [nome, alias] of Object.entries(ALIAS)) if (alias.includes(h)) return nome;
        return null;
    });

    return righe.slice(1)
        .map(riga => {
            const celle = riga.split(',').map(c => c.trim());
            const out = { nome: '', ruolo: '', squadra: '', max: '' };
            campo.forEach((nome, i) => { if (nome) out[nome] = celle[i] ?? ''; });
            out.celle = celle;
            return out;
        })
        // La riga dei totali in fondo al foglio non è un giocatore.
        .filter(r => !(r.nome === '' && r.celle.some(c => RIEPILOGHI.includes(c.toLowerCase()))));
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
            assert.ok(riga.nome, `riga senza nome in ${path}`);
            assert.ok(['P', 'D', 'C', 'A'].includes(riga.ruolo), `${riga.nome}: ruolo "${riga.ruolo}"`);
            assert.ok(riga.squadra, `${riga.nome}: squadra mancante`);
        }
    });

    test(`${path}: nessun nome ripetuto`, () => {
        const nomi = leggiCSV(path).map(r => r.nome.toLowerCase());
        assert.equal(new Set(nomi).size, nomi.length, `nomi doppi in ${path}`);
    });
}

test('liste/lista.csv: i massimali sono interi positivi e sommano al budget', () => {
    const righe = leggiCSV(CSV.lista);
    let somma = 0;
    for (const riga of righe) {
        const max = Number(riga.max);
        assert.ok(Number.isInteger(max) && max >= 1, `${riga.nome}: max "${riga.max}"`);
        somma += max;
    }
    assert.equal(somma, players.AUCTION_BUDGET, 'la somma dei tetti deve fare il budget');
});

test('nelle liste di supporto un eventuale massimale non finisce nel file generato', () => {
    // I CSV possono avere colonne in più (offerta, note, "sostituisce"): nelle
    // due liste di supporto non si compra niente, quindi restano fuori.
    const generato = readFileSync(resolve(root, 'assets/js/data/shortlists.js'), 'utf8');
    const corpo = generato.slice(generato.indexOf('ALTERNATIVES = ['));
    assert.ok(!corpo.includes('max:'), 'un massimale è finito nelle liste di supporto');

    for (const lista of [shortlists.ALTERNATIVES, shortlists.BAITS]) {
        for (const p of lista) {
            assert.deepEqual(Object.keys(p).sort(), ['name', 'role', 'team'], `${p.name}: campi in più`);
        }
    }
});

test('la riga dei totali del foglio non diventa un giocatore', () => {
    const grezzo = readFileSync(resolve(root, CSV.lista), 'utf8');
    if (!/^\s*totale/im.test(grezzo)) return; // il foglio può non averla
    assert.ok(!players.PLAYERS.some(p => /totale/i.test(p.name)), 'la riga TOTALE è finita in lista');
    assert.equal(players.PLAYERS.length, leggiCSV(CSV.lista).length);
});

// --- CSV e file generati dicono la stessa cosa ------------------------------

const stessoContenuto = (righeCSV, lista) => {
    assert.equal(lista.length, righeCSV.length, 'numero di giocatori diverso');
    righeCSV.forEach((riga, i) => {
        assert.equal(lista[i].name, riga.nome, `riga ${i + 1}: nome diverso`);
        assert.equal(lista[i].role, riga.ruolo, `${riga.nome}: ruolo diverso`);
        assert.equal(lista[i].team, riga.squadra, `${riga.nome}: squadra diversa`);
    });
};

test('shortlists.js dice esattamente quello che dicono i due CSV, nello stesso ordine', () => {
    stessoContenuto(leggiCSV(CSV.alternative), shortlists.ALTERNATIVES);
    stessoContenuto(leggiCSV(CSV.esche), shortlists.BAITS);
});

test('players.js contiene gli stessi giocatori di liste/lista.csv', () => {
    const righe = leggiCSV(CSV.lista);
    assert.equal(players.PLAYERS.length, righe.length);

    const daCSV = new Map(righe.map(r => [r.nome.toLowerCase(), r]));
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

// --- la lista di esempio ----------------------------------------------------
//
// liste/esempio-inga.csv non entra in nessuna pagina: serve a provare
// standalone_inga.html senza dover inventare una lista ogni volta, e a far
// vedere che formato vuole. Deve restare una lista credibile: 3-8-8-6 e 500
// crediti tondi, altrimenti come esempio non insegna niente.

const ESEMPIO = 'liste/esempio-inga.csv';

test(`${ESEMPIO}: 25 giocatori, 3 portieri, 8 difensori, 8 centrocampisti, 6 attaccanti`, () => {
    const righe = leggiCSV(ESEMPIO);
    const perRuolo = (ruolo) => righe.filter(r => r.ruolo === ruolo).length;

    assert.equal(righe.length, 25);
    assert.deepEqual(
        { P: perRuolo('P'), D: perRuolo('D'), C: perRuolo('C'), A: perRuolo('A') },
        { P: 3, D: 8, C: 8, A: 6 }
    );
});

test(`${ESEMPIO}: i tetti sommano a 500`, () => {
    const somma = leggiCSV(ESEMPIO).reduce((a, r) => a + Number(r.max), 0);
    assert.equal(somma, 500);
});

test(`${ESEMPIO}: nomi tutti diversi e tetti interi positivi`, () => {
    const righe = leggiCSV(ESEMPIO);
    const nomi = righe.map(r => r.nome.toLowerCase());
    assert.equal(new Set(nomi).size, nomi.length, 'nomi doppi');
    for (const r of righe) {
        const max = Number(r.max);
        assert.ok(Number.isInteger(max) && max >= 1, `${r.nome}: max "${r.max}"`);
        assert.ok(r.squadra, `${r.nome}: squadra mancante`);
    }
});

test(`${ESEMPIO}: la pagina base la accetta così com'è`, () => {
    const { normalizePlayers } = require('../assets/js/core/engine.js');
    const csv = require('../assets/js/core/csv.js');

    const { records } = csv.readList(readFileSync(resolve(root, ESEMPIO), 'utf8'), { needMax: true });
    const { players, problems } = normalizePlayers(records);
    assert.deepEqual(problems, [], 'righe che la pagina scarterebbe');
    assert.equal(players.length, 25);
});
