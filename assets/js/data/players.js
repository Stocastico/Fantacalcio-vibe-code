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
        // Portieri — 3, 37 crediti
        { name: "Svilar",        role: "P", team: "Roma",     max: 26 },
        { name: "Falcone",       role: "P", team: "Lecce",    max:  7 },
        { name: "Caprile",       role: "P", team: "Cagliari", max:  4 },

        // Difensori — 8, 109 crediti
        { name: "Mancini",       role: "D", team: "Roma",     max: 30 },
        { name: "Rrahmani",      role: "D", team: "Napoli",   max: 20 },
        { name: "N'Dicka",       role: "D", team: "Roma",     max: 20 },
        { name: "Doekhi",        role: "D", team: "Lazio",    max: 12 },
        { name: "Gila",          role: "D", team: "Milan",    max: 12 },
        { name: "Tiago Gabriel", role: "D", team: "Lecce",    max:  7 },
        { name: "Marin",         role: "D", team: "Napoli",   max:  4 },
        { name: "Troilo",        role: "D", team: "Parma",    max:  4 },

        // Centrocampisti — 8, 175 crediti
        { name: "Calhanoglu",    role: "C", team: "Inter",    max: 66 },
        { name: "Orsolini",      role: "C", team: "Bologna",  max: 50 },
        { name: "Vlasic",        role: "C", team: "Torino",   max: 20 },
        { name: "Casadei",       role: "C", team: "Torino",   max: 11 },
        { name: "Ekkelenkamp",   role: "C", team: "Udinese",  max: 11 },
        { name: "Locatelli",     role: "C", team: "Juventus", max:  8 },
        { name: "Bernabe",       role: "C", team: "Parma",    max:  6 },
        { name: "Helgason",      role: "C", team: "Venezia",  max:  3 },

        // Attaccanti — 6, 179 crediti
        { name: "Hojlund",       role: "A", team: "Napoli",   max: 67 },
        { name: "Douvikas",      role: "A", team: "Como",     max: 42 },
        { name: "Raspadori",     role: "A", team: "Atalanta", max: 20 },
        { name: "Colombo",       role: "A", team: "Genoa",    max: 20 },
        { name: "Akor Adams",    role: "A", team: "Venezia",  max: 16 },
        { name: "Berardi",       role: "A", team: "Sassuolo", max: 14 },
    ];

    const api = { AUCTION_BUDGET, ROSTER_SIZE, PLAYERS };

    global.FC = global.FC || {};
    global.FC.playersData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
