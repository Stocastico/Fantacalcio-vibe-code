#!/usr/bin/env node
/**
 * Converte un CSV nella lista giocatori usata dalle pagine.
 *
 *   npm run import -- lista.csv                 → assets/js/data/players.js
 *   npm run import -- pool.csv --target market  → assets/js/data/market-pool.js
 *   cat lista.csv | npm run import
 *
 * Opzioni:
 *   --target players|market   quale file scrivere (default: players)
 *   --budget N               forza il budget invece di riusare quello già nel file
 *   --roster N               quanti giocatori deve avere la rosa a fine asta
 *                            (solo --target players; default: quello già nel file, o 25)
 *   --dry-run                stampa a schermo senza scrivere niente
 *
 * Intestazioni riconosciute (maiuscole e accenti indifferenti):
 *   nome     Giocatore, Nome, Name, Player
 *   ruolo    Ruolo, Role
 *   squadra  Squadra, Team, Club
 *   tetto    Max, Massimale, Tetto, Bid, Crediti
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

const TARGETS = {
    players: {
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
        file: 'assets/js/data/market-pool.js',
        budgetConst: 'MARKET_BUDGET',
        listConst: 'MARKET_POOL',
        globalName: 'marketData',
        groupByRole: false,
        title: 'Pool per il mercato di riparazione',
    },
};

const HEADERS = {
    name: ['giocatore', 'nome', 'name', 'player'],
    role: ['ruolo', 'role'],
    team: ['squadra', 'team', 'club'],
    max: ['max', 'massimale', 'tetto', 'bid', 'crediti'],
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

/** Associa ogni colonna del CSV a un campo del modello, in base all'intestazione. */
function mapColumns(headerRow) {
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
    if (mapping.max === undefined) {
        throw new Error(`Non trovo la colonna del massimale. Intestazioni lette: ${headerRow.join(', ')}`);
    }
    return mapping;
}

function rowsToPlayers(rows) {
    const mapping = mapColumns(rows[0]);
    const at = (row, field) => (mapping[field] === undefined ? '' : (row[mapping[field]] ?? ''));

    return rows.slice(1).map(row => ({
        name: at(row, 'name'),
        role: at(row, 'role'),
        team: at(row, 'team'),
        max: at(row, 'max'),
    }));
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

    return `/**
 * ${target.title} — stagione 2026/27.
 *
 * Generato da tools/csv-to-players.mjs, ma è un normale file JavaScript:
 * puoi anche modificarlo a mano. Per rigenerarlo da un CSV:
 *
 *   npm run import -- lista.csv${target.groupByRole ? '' : ' --target market'}
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

async function readInput(path) {
    if (path) return readFile(resolve(process.cwd(), path), 'utf8');
    if (process.stdin.isTTY) throw new Error('Nessun file indicato e niente sullo standard input.');
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

// --- main -------------------------------------------------------------------

const argv = process.argv.slice(2);
const options = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--')) options[arg.slice(2)] = argv[++i];
    else positional.push(arg);
}
const inputPath = positional[0];

const targetName = options.target || 'players';
const target = TARGETS[targetName];
if (!target) {
    console.error(`❌ --target sconosciuto: "${targetName}". Valori possibili: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
}

let raw;
try {
    raw = await readInput(inputPath);
} catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
}

const rows = parseCSV(raw);
if (rows.length < 2) {
    console.error('❌ Il CSV non ha righe di dati oltre all\'intestazione.');
    process.exit(1);
}

let candidates;
try {
    candidates = rowsToPlayers(rows);
} catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
}

// Stessa validazione che fa l'app a runtime.
const { players, problems } = normalizePlayers(candidates);
for (const p of problems) console.warn(`⚠️  ${p}`);
if (!players.length) {
    console.error('❌ Nessuna riga valida: non scrivo niente.');
    process.exit(1);
}

const total = players.reduce((a, p) => a + p.max, 0);
const budget = Number(options.budget) || (await currentConst(target, target.budgetConst)) || total;
const rosterSize = Number(options.roster)
    || (await currentConst(target, target.rosterConst))
    || target.rosterDefault;
const output = renderFile(players, budget, target, rosterSize);

console.log(`📋 ${players.length} giocatori, somma massimali ${total}, budget ${budget}.`);
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

if (options.dryRun) {
    console.log('\n--- dry run, nessun file scritto ---\n');
    console.log(output);
} else {
    await writeFile(resolve(root, target.file), output, 'utf8');
    console.log(`✅ Scritto ${relative(root, resolve(root, target.file))}`);
    console.log('   Ricordati di rigenerare i file portabili: npm run build');
}
