/**
 * Lista giocatori per l'asta principale — stagione 2026/27.
 *
 * ⚠️  FILE GENERATO da tools/csv-to-lists.mjs, a partire da liste/lista.csv.
 * Modificalo pure a mano se hai fretta — è normale JavaScript — ma al prossimo
 * import quello che scrivi qui viene sovrascritto da liste/lista.csv.
 *
 *   npm run import                 # da liste/lista.csv
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
 * La somma dei massimali fa 500, esattamente il budget.
 *
 * ROSTER_SIZE è quanti giocatori devi avere a fine asta: serve a tenere da
 * parte 1 credito per ogni slot ancora vuoto. Non deve coincidere con la lunghezza
 * della lista — gli slot che avanzano li riempi con acquisti fuori lista.
 *
 * Nota: la lista non è offuscata e questo repository è pubblico.
 */
;(function (global) {
    'use strict';

    const AUCTION_BUDGET = 500;
    const ROSTER_SIZE = 25;

    const PLAYERS = [
        // Portieri — 3, 44 crediti
        { name: "Svilar",          role: "P", team: "Roma",      max: 42 },
        { name: "Palmisani",       role: "P", team: "Frosinone", max:  1 },
        { name: "Thiam",           role: "P", team: "Monza",     max:  1 },

        // Difensori — 8, 84 crediti
        { name: "Mancini",         role: "D", team: "Roma",      max: 36 },
        { name: "Pavlovic",        role: "D", team: "Milan",     max: 26 },
        { name: "Doekhi",          role: "D", team: "Lazio",     max: 10 },
        { name: "Rrahmani",        role: "D", team: "Napoli",    max:  4 },
        { name: "N'Dicka",         role: "D", team: "Roma",      max:  3 },
        { name: "Mina",            role: "D", team: "Cagliari",  max:  2 },
        { name: "Gabriel (Tiago)", role: "D", team: "Lecce",     max:  2 },
        { name: "Troilo",          role: "D", team: "Parma",     max:  1 },

        // Centrocampisti — 8, 172 crediti
        { name: "Calhanoglu",      role: "C", team: "Inter",     max: 80 },
        { name: "Orsolini",        role: "C", team: "Bologna",   max: 50 },
        { name: "Vlasic",          role: "C", team: "Torino",    max: 24 },
        { name: "Locatelli",       role: "C", team: "Juventus",  max: 14 },
        { name: "Casadei",         role: "C", team: "Torino",    max:  1 },
        { name: "Ekkelenkamp",     role: "C", team: "Udinese",   max:  1 },
        { name: "Bernabe",         role: "C", team: "Parma",     max:  1 },
        { name: "Fazzini",         role: "C", team: "Cagliari",  max:  1 },

        // Attaccanti — 6, 200 crediti
        { name: "Pinamonti",       role: "A", team: "Lazio",     max: 50 },
        { name: "Raspadori",       role: "A", team: "Atalanta",  max: 46 },
        { name: "Colombo Lo.",     role: "A", team: "Genoa",     max: 42 },
        { name: "Berardi",         role: "A", team: "Sassuolo",  max: 28 },
        { name: "Douvikas",        role: "A", team: "Como",      max: 18 },
        { name: "Adams A.",        role: "A", team: "Venezia",   max: 16 },
    ];

    const api = { AUCTION_BUDGET, ROSTER_SIZE, PLAYERS };

    global.FC = global.FC || {};
    global.FC.playersData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
