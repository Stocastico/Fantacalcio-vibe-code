/**
 * Lista giocatori per l'asta principale — stagione 2026/27.
 *
 * Generato da tools/csv-to-players.mjs, ma è un normale file JavaScript:
 * puoi anche modificarlo a mano. Per rigenerarlo da un CSV:
 *
 *   npm run import -- lista.csv
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
 * Nota: la lista non è offuscata e questo repository è pubblico.
 */
;(function (global) {
    'use strict';

    const AUCTION_BUDGET = 500;

    const PLAYERS = [
        // Portieri — 3, 45 crediti
        { name: "Svilar",        role: "P", team: "Roma",     max:  36 },
        { name: "Falcone",       role: "P", team: "Lecce",    max:   8 },
        { name: "Paleari",       role: "P", team: "Torino",   max:   1 },

        // Difensori — 8, 115 crediti
        { name: "Mancini",       role: "D", team: "Roma",     max:  28 },
        { name: "N'Dicka",       role: "D", team: "Roma",     max:  23 },
        { name: "Rrahmani",      role: "D", team: "Napoli",   max:  20 },
        { name: "Bisseck",       role: "D", team: "Inter",    max:  14 },
        { name: "Gila",          role: "D", team: "Milan",    max:  13 },
        { name: "Circati",       role: "D", team: "Parma",    max:   8 },
        { name: "Tiago Gabriel", role: "D", team: "Lecce",    max:   5 },
        { name: "Haps",          role: "D", team: "Venezia",  max:   4 },

        // Centrocampisti — 8, 128 crediti
        { name: "Orsolini",      role: "C", team: "Bologna",  max:  60 },
        { name: "Vlasic",        role: "C", team: "Torino",   max:  21 },
        { name: "Thorstvedt",    role: "C", team: "Sassuolo", max:  13 },
        { name: "Casadei",       role: "C", team: "Torino",   max:  11 },
        { name: "Ekkelenkamp",   role: "C", team: "Udinese",  max:  10 },
        { name: "Rowe",          role: "C", team: "Bologna",  max:   8 },
        { name: "Bernabe",       role: "C", team: "Parma",    max:   3 },
        { name: "Fazzini",       role: "C", team: "Cagliari", max:   2 },

        // Attaccanti — 6, 212 crediti
        { name: "Hojlund",       role: "A", team: "Napoli",   max: 102 },
        { name: "Douvikas",      role: "A", team: "Como",     max:  46 },
        { name: "Berardi",       role: "A", team: "Sassuolo", max:  31 },
        { name: "Raspadori",     role: "A", team: "Atalanta", max:  16 },
        { name: "Akor Adams",    role: "A", team: "Venezia",  max:  10 },
        { name: "Colombo",       role: "A", team: "Genoa",    max:   7 },
    ];

    const api = { AUCTION_BUDGET, PLAYERS };

    global.FC = global.FC || {};
    global.FC.playersData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
