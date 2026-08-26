/**
 * CSV in entrata e in uscita.
 *
 * La lettura sta qui e non nel tool di import perché la usano in due: `npm run
 * import` da Node, e la pagina che si carica la lista da un file scelto a mano.
 * Un solo parser vuol dire che un CSV accettato da una parte è accettato anche
 * dall'altra. La parte di download esiste solo nel browser.
 */
;(function (global) {
    'use strict';

    const isNode = typeof module !== 'undefined' && !!module.exports;
    const text = isNode ? require('./text.js') : global.FC.text;
    const { norm } = text;

    /** Intestazioni riconosciute, in italiano e in inglese. */
    const HEADERS = {
        name: ['giocatore', 'nome', 'name', 'player'],
        role: ['ruolo', 'role'],
        team: ['squadra', 'team', 'club'],
        max: ['max', 'massimale', 'tetto', 'bid', 'crediti',
              'offerta_massima', 'offerta massima', 'offerta_max', 'offerta max', 'budget'],
    };

    /**
     * Le righe di riepilogo che uno si mette in fondo al foglio ("TOTALE … 500")
     * non sono giocatori: saltarle evita di segnalarle come righe rotte.
     */
    const RIEPILOGHI = ['totale', 'totali', 'total', 'somma', 'sum'];

    /** Parser minimale ma corretto su virgolette, virgole nei campi e CRLF. */
    function parse(input) {
        const testo = String(input ?? '').replace(/^\ufeff/, '');
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;

        for (let i = 0; i < testo.length; i++) {
            const ch = testo[i];

            if (quoted) {
                if (ch === '"') {
                    if (testo[i + 1] === '"') { field += '"'; i++; }
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

    /**
     * Associa le colonne ai campi del modello leggendo l'intestazione.
     * Restituisce null se la prima riga non è un'intestazione riconoscibile.
     */
    function mapColumns(headerRow) {
        const mapping = {};
        headerRow.forEach((head, i) => {
            const key = norm(head);
            for (const [field, alias] of Object.entries(HEADERS)) {
                if (alias.includes(key) && mapping[field] === undefined) mapping[field] = i;
            }
        });
        return Object.keys(mapping).length ? mapping : null;
    }

    function isRiepilogo(row, mapping) {
        const nome = mapping.name === undefined ? '' : String(row[mapping.name] ?? '').trim();
        if (nome) return false;
        return row.some(cella => RIEPILOGHI.includes(norm(cella)));
    }

    /**
     * CSV → righe { name, role, team, max }, ancora da validare.
     *
     * L'intestazione è facoltativa: senza, si assume "nome, offerta massima",
     * che è come viene fuori una lista scritta di fretta.
     *
     * @param {string} testoCSV
     * @param {object} opts  { needMax: il massimale è obbligatorio }
     */
    function readList(testoCSV, opts) {
        const needMax = !!(opts && opts.needMax);
        const rows = parse(testoCSV);
        if (!rows.length) throw new Error('Il file è vuoto.');

        const daIntestazione = mapColumns(rows[0]);
        const mapping = daIntestazione || { name: 0, max: 1 };
        const dati = daIntestazione ? rows.slice(1) : rows;

        if (mapping.name === undefined) {
            throw new Error(`Non trovo la colonna del nome. Intestazioni lette: ${rows[0].join(', ')}`);
        }
        if (needMax && mapping.max === undefined) {
            throw new Error(`Non trovo la colonna del massimale. Intestazioni lette: ${rows[0].join(', ')}`);
        }
        if (!dati.length) throw new Error('Nessuna riga di dati oltre all\'intestazione.');

        const at = (row, field) => (mapping[field] === undefined ? '' : (row[mapping[field]] ?? ''));
        return {
            conIntestazione: !!daIntestazione,
            records: dati.filter(row => !isRiepilogo(row, mapping)).map(row => ({
                name: at(row, 'name'),
                role: at(row, 'role'),
                team: at(row, 'team'),
                max: at(row, 'max'),
            })),
        };
    }

    /**
     * Righe -> testo CSV. Tutti i campi vengono quotati e le virgolette
     * raddoppiate, così nomi con virgole o accenti non rompono il file.
     * Il BOM lo aggiunge `download()`, serve a Excel per leggere gli accenti.
     */
    function toCSV(rows) {
        return rows
            .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\r\n');
    }

    /** Nome file con la data di oggi, es. acquisti_2026-08-11.csv */
    function stampedName(prefix) {
        return `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    /** Scarica il CSV. No-op fuori dal browser. */
    function download(filename, csvText) {
        if (typeof document === 'undefined') return false;
        const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }

    const api = { HEADERS, parse, mapColumns, readList, toCSV, stampedName, download };

    global.FC = global.FC || {};
    global.FC.csv = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
