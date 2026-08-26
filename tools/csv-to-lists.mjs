#!/usr/bin/env node
/**
 * Converte i CSV nelle liste che le pagine caricano.
 *
 * Le liste si tengono in `liste/*.csv` — quelli sono i file che modifichi tu,
 * anche da Excel. I `.js` sotto assets/js/data/ sono generati da qui: le pagine
 * si aprono col doppio click e da `file://` il browser non può leggere un CSV
 * dal disco, quindi la lista dev'essere già dentro un file JavaScript.
 *
 *   npm run import                                → rigenera tutto da liste/
 *   npm run import -- --target alternative        → solo le alternative
 *   npm run import -- altra-lista.csv             → la lista d'asta da un file tuo
 *   npm run import -- pool.csv --target market    → il pool della riparazione
 *   cat lista.csv | npm run import -- -           → il "-" vuol dire standard input
 *
 * Opzioni:
 *   --target tutto|players|market|alternative|esche|shortlists
 *                            cosa rigenerare (default: tutto, oppure players se
 *                            passi un file)
 *   --budget N               forza il budget invece di riusare quello già nel file
 *   --roster N               quanti giocatori deve avere la rosa a fine asta
 *                            (solo --target players; default: quello già nel file, o 25)
 *   --dry-run                stampa a schermo senza scrivere niente
 *
 * Intestazioni riconosciute (maiuscole e accenti indifferenti):
 *   nome     Giocatore, Nome, Name, Player
 *   ruolo    Ruolo, Role
 *   squadra  Squadra, Team, Club
 *   tetto    Max, Massimale, Tetto, Bid, Crediti, Offerta_max, Budget
 *
 * Le colonne in più (note, rigorista, "preso", ecc.) vengono ignorate, e una
 * riga di totali in fondo — "TOTALE, ,  , 500" — viene saltata invece di
 * diventare un giocatore senza nome.
 *
 * Il massimale serve solo alla lista d'asta e al pool della riparazione: nelle
 * due liste di supporto non si compra niente, quindi lì la colonna è ignorata.
 *
 * La validazione passa dalle stesse funzioni che usa l'app, così se un file
 * viene accettato qui viene accettato anche a schermo.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { normalizePlayers } = require('../assets/js/core/engine.js');
const { normalizeEntries } = require('../assets/js/core/shortlists.js');

/** Le liste con un massimale: una per file generato. */
const PLAYER_TARGETS = {
    players: {
        kind: 'players',
        csv: 'liste/lista.csv',
        file: 'assets/js/data/players.js',
        budgetConst: 'AUCTION_BUDGET',
        listConst: 'PLAYERS',
        globalName: 'playersData',
        groupByRole: true,
        title: "Lista giocatori per l'asta principale",
        // Quanti giocatori devi avere a fine asta. Non è la lunghezza della lista:
        // puoi desiderarne meno e riempire il resto con acquisti fuori lista.
        rosterConst: 'ROSTER_SIZE',
        rosterDefault: 25,
    },
    market: {
        kind: 'players',
        // Il pool della riparazione non ha un CSV fisso: lo passi quando serve.
        csv: null,
        file: 'assets/js/data/market-pool.js',
        budgetConst: 'MARKET_BUDGET',
        listConst: 'MARKET_POOL',
        globalName: 'marketData',
        groupByRole: false,
        title: 'Pool per il mercato di riparazione',
    },
};

/**
 * Le due liste di supporto stanno in un file solo, quindi si rigenerano
 * insieme: importarne una rilegge comunque l'altra dal suo CSV.
 */
const SHORTLISTS_FILE = 'assets/js/data/shortlists.js';
const SHORTLISTS = [
    {
        id: 'alternative',
        csv: 'liste/alternative.csv',
        listConst: 'ALTERNATIVES',
        comment: 'Su chi ripiego se il desiderato me lo portano via.',
    },
    {
        id: 'esche',
        csv: 'liste/esche.csv',
        listConst: 'BAITS',
        comment: 'Le esche: li chiamo io per primo, ma non li voglio.',
    },
];

const HEADERS = {
    name: ['giocatore', 'nome', 'name', 'player'],
    role: ['ruolo', 'role'],
    team: ['squadra', 'team', 'club'],
    max: ['max', 'massimale', 'tetto', 'bid', 'crediti', 'offerta_max', 'offerta max', 'offerta massima', 'budget'],
};

const ROLE_LABELS = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };
const ROLE_ORDER = ['P', 'D', 'C', 'A'];

// --- parsing ----------------------------------------------------------------

/** Parser CSV minimale ma corretto su virgolette, virgole nei campi e CRLF. */
function parseCSV(input) {
    const text = input.replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else quoted = false;
            } else field += ch;
            continue;
        }

        if (ch === '"') { quoted = true; }
        else if (ch === ',' || ch === ';') { row.push(field); field = ''; }
        else if (ch === '\r') { /* gestito dal \n che segue */ }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else field += ch;
    }
    row.push(field);
    rows.push(row);

    return rows
        .map(r => r.map(c => c.trim()))
        .filter(r => r.some(c => c !== ''));
}

const slug = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Associa ogni colonna del CSV a un campo del modello, in base all'intestazione.
 * Il massimale è obbligatorio solo dove i crediti servono davvero.
 */
function mapColumns(headerRow, needMax) {
    const mapping = {};
    headerRow.forEach((head, i) => {
        const key = slug(head);
        for (const [field, aliases] of Object.entries(HEADERS)) {
            if (aliases.includes(key)) mapping[field] = i;
        }
    });
    if (mapping.name === undefined) {
        throw new Error(`Non trovo la colonna del nome. Intestazioni lette: ${headerRow.join(', ')}`);
    }
    if (needMax && mapping.max === undefined) {
        throw new Error(`Non trovo la colonna del massimale. Intestazioni lette: ${headerRow.join(', ')}`);
    }
    return mapping;
}

/**
 * Le righe di riepilogo che uno si mette in fondo al foglio ("TOTALE … 500")
 * non sono giocatori: saltarle in silenzio evita un avviso a ogni import.
 */
const RIEPILOGHI = ['totale', 'totali', 'total', 'somma', 'sum'];

function isRiepilogo(row, mapping) {
    const nome = mapping.name === undefined ? '' : String(row[mapping.name] ?? '').trim();
    if (nome) return false;
    return row.some(cella => RIEPILOGHI.includes(slug(cella)));
}

function rowsToRecords(rows, needMax) {
    const mapping = mapColumns(rows[0], needMax);
    const at = (row, field) => (mapping[field] === undefined ? '' : (row[mapping[field]] ?? ''));

    return rows.slice(1).filter(row => !isRiepilogo(row, mapping)).map(row => ({
        name: at(row, 'name'),
        role: at(row, 'role'),
        team: at(row, 'team'),
        max: at(row, 'max'),
    }));
}

/** CSV → righe già validate, con gli scarti segnalati a schermo. */
function readList(raw, { needMax, source }) {
    const rows = parseCSV(raw);
    if (rows.length < 2) {
        throw new Error(`${source}: nessuna riga di dati oltre all'intestazione.`);
    }
    const candidates = rowsToRecords(rows, needMax);
    const { players, entries, problems } = needMax
        ? normalizePlayers(candidates)
        : normalizeEntries(candidates);
    for (const p of problems) console.warn(`⚠️  ${source}: ${p}`);
    const list = players || entries;
    if (!list.length) throw new Error(`${source}: nessuna riga valida.`);
    return list;
}

// --- generazione ------------------------------------------------------------

const q = (s) => JSON.stringify(String(s));

/** Le colonne si incolonnano: la virgola resta attaccata al valore, il padding va dopo. */
function renderPlayer(p, widths) {
    const cell = (label, value, width) => `${label}: ${value},`.padEnd(label.length + width + 3);
    const parts = [cell('name', q(p.name), widths.name)];
    if (widths.role) parts.push(cell('role', q(p.role), widths.role));
    if (widths.team) parts.push(cell('team', q(p.team), widths.team));
    parts.push(`max: ${String(p.max).padStart(widths.max)}`);
    return `        { ${parts.join(' ')} },`;
}

function renderList(players, target) {
    const anyRole = players.some(p => p.role);
    const anyTeam = players.some(p => p.team);
    const widths = {
        name: Math.max(...players.map(p => q(p.name).length)),
        role: anyRole ? Math.max(...players.map(p => q(p.role || '').length)) : 0,
        team: anyTeam ? Math.max(...players.map(p => q(p.team || '').length)) : 0,
        max: Math.max(...players.map(p => String(p.max).length)),
    };

    const lines = [];
    if (target.groupByRole && anyRole) {
        for (const role of ROLE_ORDER) {
            const group = players.filter(p => p.role === role).sort((a, b) => b.max - a.max);
            if (!group.length) continue;
            if (lines.length) lines.push('');
            const total = group.reduce((a, p) => a + p.max, 0);
            lines.push(`        // ${ROLE_LABELS[role]} — ${group.length}, ${total} crediti`);
            for (const p of group) lines.push(renderPlayer(p, widths));
        }
        const senzaRuolo = players.filter(p => !ROLE_ORDER.includes(p.role));
        if (senzaRuolo.length) {
            lines.push('', '        // Senza ruolo');
            for (const p of senzaRuolo) lines.push(renderPlayer(p, widths));
        }
    } else {
        for (const p of [...players].sort((a, b) => b.max - a.max)) lines.push(renderPlayer(p, widths));
    }
    return lines.join('\n');
}

function renderFile(players, budget, target, rosterSize) {
    const total = players.reduce((a, p) => a + p.max, 0);
    const quadra = total === budget
        ? `La somma dei massimali fa ${total}, esattamente il budget.`
        : `⚠️ La somma dei massimali fa ${total} ma il budget è ${budget}: l'app lo segnala con un banner.`;

    const roster = target.rosterConst
        ? `    const ${target.rosterConst} = ${rosterSize};\n`
        : '';
    const rosterDoc = target.rosterConst
        ? `\n * ${target.rosterConst} è quanti giocatori devi avere a fine asta: serve a tenere da\n` +
          ` * parte 1 credito per ogni slot ancora vuoto. Non deve coincidere con la lunghezza\n` +
          ` * della lista — gli slot che avanzano li riempi con acquisti fuori lista.\n`
        : '';
    const comando = target.csv
        ? `npm run import                 # da ${target.csv}`
        : `npm run import -- pool.csv --target market`;

    return `/**
 * ${target.title} — stagione 2026/27.
 *
 * ⚠️  FILE GENERATO da tools/csv-to-lists.mjs${target.csv ? `, a partire da ${target.csv}` : ''}.
 * Modificalo pure a mano se hai fretta — è normale JavaScript — ma al prossimo
 * import quello che scrivi qui viene sovrascritto${target.csv ? ` da ${target.csv}` : ''}.
 *
 *   ${comando}
 *   npm run build                  # rigenera i file portabili
 *
 * Formato di ogni riga:
 *   { name: "Cognome", role: "P" | "D" | "C" | "A", team: "Squadra", max: <crediti> }
 *
 *   name  come lo chiami tu; la ricerca ignora accenti e maiuscole
 *   role  P portiere, D difensore, C centrocampista, A attaccante (opzionale)
 *   team  solo per riconoscere gli omonimi a colpo d'occhio (opzionale)
 *   max   il TUO tetto di spesa per quel giocatore, non il prezzo di listino
 *
 * ${quadra}
 *${rosterDoc} *
 * Nota: la lista non è offuscata e questo repository è pubblico.
 */
;(function (global) {
    'use strict';

    const ${target.budgetConst} = ${budget};
${roster}
    const ${target.listConst} = [
${renderList(players, target)}
    ];

    const api = { ${target.budgetConst}, ${target.rosterConst ? `${target.rosterConst}, ` : ''}${target.listConst} };

    global.FC = global.FC || {};
    global.FC.${target.globalName} = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
}

/** Una riga delle liste di supporto: come renderPlayer, ma senza massimale. */
function renderEntry(p, widths) {
    const cell = (label, value, width) => `${label}: ${value},`.padEnd(label.length + width + 3);
    const parts = [cell('name', q(p.name), widths.name)];
    if (widths.role) parts.push(cell('role', q(p.role || ''), widths.role));
    if (widths.team) parts.push(`team: ${q(p.team || '').padEnd(widths.team)}`);
    return `        { ${parts.join(' ')} },`;
}

function renderEntries(entries) {
    const widths = {
        name: Math.max(...entries.map(p => q(p.name).length)),
        role: entries.some(p => p.role) ? Math.max(...entries.map(p => q(p.role || '').length)) : 0,
        team: entries.some(p => p.team) ? Math.max(...entries.map(p => q(p.team || '').length)) : 0,
    };
    // L'ordine è quello del CSV: è una lista curata, non la si riordina.
    return entries.map(p => renderEntry(p, widths)).join('\n');
}

function renderShortlistsFile(lists) {
    const blocchi = SHORTLISTS.map(def => `    /** ${def.comment} */
    const ${def.listConst} = [
${renderEntries(lists[def.id])}
    ];`).join('\n\n');

    return `/**
 * Le due liste di supporto della pagina d'asta — stagione 2026/27.
 *
 * ⚠️  FILE GENERATO da tools/csv-to-lists.mjs, a partire da
 *     ${SHORTLISTS.map(d => d.csv).join(' e ')}.
 * Quelli sono i file che modifichi tu; qui dentro si può scrivere a mano, ma al
 * prossimo import viene tutto sovrascritto.
 *
 *   npm run import                 # rigenera anche players.js
 *   npm run build                  # rigenera i file portabili
 *
 * Formato di ogni riga — niente massimali, qui non si compra:
 *   { name: "Cognome", role: "P" | "D" | "C" | "A", team: "Squadra" }
 *
 * ALTERNATIVES  i ripieghi: se un desiderato di players.js va a un altro, sono
 *               questi i nomi su cui ripiegare. L'ordine è quello del CSV.
 *
 * BAITS         le esche, che nella pagina si chiamano "Da chiamare all'inizio":
 *               i pezzi grossi che butti sul tavolo per far bruciare crediti
 *               agli altri mentre i tuoi desiderati sono ancora lì.
 *
 * In asta togli con la ✕ chi è già stato chiamato; il "Reset totale" della
 * pagina rimette tutto com'è scritto qui.
 */
;(function (global) {
    'use strict';

${blocchi}

    const api = { ${SHORTLISTS.map(d => d.listConst).join(', ')} };

    global.FC = global.FC || {};
    global.FC.shortlistsData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
}

// --- lettura degli ingressi -------------------------------------------------

/** Rilegge una costante dal file già esistente, così un import non la resetta di nascosto. */
async function currentConst(target, name) {
    if (!name) return null;
    try {
        const src = await readFile(resolve(root, target.file), 'utf8');
        const m = src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
        return m ? Number(m[1]) : null;
    } catch {
        return null;
    }
}

/**
 * Lo standard input si legge solo se lo chiedi con "-": senza argomenti il
 * comando rigenera tutto dai CSV del repo, e mettersi ad aspettare qualcosa
 * che non arriva mai lo farebbe sembrare piantato.
 */
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

const readRepoFile = (relPath) => readFile(resolve(root, relPath), 'utf8');

// --- main -------------------------------------------------------------------

const argv = process.argv.slice(2);
const options = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--stdin') options.stdin = true;
    else if (arg.startsWith('--')) options[arg.slice(2)] = argv[++i];
    else positional.push(arg);
}
const useStdin = options.stdin === true || positional[0] === '-';
const inputPath = positional[0] === '-' ? undefined : positional[0];

// Senza un file e senza "-" si rigenera tutto dai CSV del repo: è il caso
// normale, "ho aggiornato le liste in Excel".
const targetName = options.target || (inputPath || useStdin ? 'players' : 'tutto');

const VALIDI = ['tutto', ...Object.keys(PLAYER_TARGETS), ...SHORTLISTS.map(s => s.id), 'shortlists'];
if (!VALIDI.includes(targetName)) {
    console.error(`❌ --target sconosciuto: "${targetName}". Valori possibili: ${VALIDI.join(', ')}`);
    process.exit(1);
}

const scritti = [];

function fatale(message) {
    console.error(`❌ ${message}`);
    process.exit(1);
}

/** Il CSV da usare: quello passato a mano, lo standard input, o il default del repo. */
async function sorgente(defaultCsv, etichetta) {
    if (inputPath) return { raw: await readFile(resolve(process.cwd(), inputPath), 'utf8'), source: inputPath };
    if (useStdin) return { raw: await readStdin(), source: 'standard input' };
    if (defaultCsv) return { raw: await readRepoFile(defaultCsv), source: defaultCsv };
    fatale(`${etichetta}: nessun CSV indicato. Passa un file, oppure "-" per leggerlo dallo standard input.`);
}

async function importaPlayers(name) {
    const target = PLAYER_TARGETS[name];
    const { raw, source } = await sorgente(target.csv, name);

    let players;
    try {
        players = readList(raw, { needMax: true, source });
    } catch (err) {
        fatale(err.message);
    }

    const total = players.reduce((a, p) => a + p.max, 0);
    const budget = Number(options.budget) || (await currentConst(target, target.budgetConst)) || total;
    const rosterSize = Number(options.roster)
        || (await currentConst(target, target.rosterConst))
        || target.rosterDefault;

    console.log(`📋 ${source} → ${players.length} giocatori, somma massimali ${total}, budget ${budget}.`);
    if (target.rosterConst && players.length !== rosterSize) {
        const diff = rosterSize - players.length;
        console.log(diff > 0
            ? `   Rosa da ${rosterSize}: ${diff} slot li riempirai fuori lista.`
            : `   Rosa da ${rosterSize}: hai ${-diff} desiderati in più di quanti slot ci sono.`);
    }
    for (const role of ROLE_ORDER) {
        const group = players.filter(p => p.role === role);
        if (group.length) console.log(`   ${role}: ${group.length} giocatori, ${group.reduce((a, p) => a + p.max, 0)} crediti`);
    }
    if (total !== budget) {
        console.warn(`⚠️  Somma massimali (${total}) diversa dal budget (${budget}): differenza ${total - budget}.`);
        console.warn('   Usa --budget per allinearlo, oppure correggi la lista.');
    }

    scritti.push({ file: target.file, output: renderFile(players, budget, target, rosterSize) });
}

/**
 * Rigenera le due liste di supporto. Quella che non stai importando viene
 * riletta dal suo CSV; se il CSV non c'è si tiene quella già generata, invece
 * di svuotarla di nascosto.
 */
async function importaShortlists(only) {
    const lists = {};

    for (const def of SHORTLISTS) {
        const suo = only === undefined || only === def.id;

        if (suo) {
            const { raw, source } = await sorgente(def.csv, def.id);
            try {
                lists[def.id] = readList(raw, { needMax: false, source });
            } catch (err) {
                fatale(err.message);
            }
            console.log(`📋 ${source} → ${lists[def.id].length} giocatori in "${def.id}".`);
            continue;
        }

        try {
            lists[def.id] = readList(await readRepoFile(def.csv), { needMax: false, source: def.csv });
        } catch {
            // Niente CSV (o CSV rotto): tengo quello che c'è già nel file generato.
            try {
                lists[def.id] = require(`../${SHORTLISTS_FILE}`)[def.listConst] || [];
            } catch {
                lists[def.id] = [];
            }
            console.warn(`⚠️  ${def.csv} non leggibile: tengo "${def.id}" com'era.`);
        }
    }

    if (!SHORTLISTS.some(def => lists[def.id].length)) {
        fatale('Le liste di supporto sono vuote: non scrivo niente.');
    }

    scritti.push({ file: SHORTLISTS_FILE, output: renderShortlistsFile(lists) });
}

try {
    if (targetName === 'tutto') {
        await importaPlayers('players');
        await importaShortlists();
    } else if (PLAYER_TARGETS[targetName]) {
        await importaPlayers(targetName);
    } else if (targetName === 'shortlists') {
        await importaShortlists();
    } else {
        await importaShortlists(targetName);
    }
} catch (err) {
    fatale(err.message);
}

if (options.dryRun) {
    for (const { file, output } of scritti) {
        console.log(`\n--- dry run, ${file} non scritto ---\n`);
        console.log(output);
    }
} else {
    for (const { file, output } of scritti) {
        await writeFile(resolve(root, file), output, 'utf8');
        console.log(`✅ Scritto ${relative(root, resolve(root, file))}`);
    }
    console.log('   Ricordati di rigenerare i file portabili: npm run build');
}
