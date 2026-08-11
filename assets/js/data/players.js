/**
 * Lista giocatori per l'asta principale — stagione 2026/27.
 *
 * ⚠️ SEGNAPOSTO: al momento qui c'è la lista usata nella stagione 2025/26,
 * riportata in chiaro come base di partenza. Sostituiscila con la tua lista
 * nuova prima dell'asta.
 *
 * Formato di ogni riga:
 *   { name: 'Cognome',  role: 'P' | 'D' | 'C' | 'A',  max: <crediti> }
 *
 *   name  come lo chiami tu; la ricerca ignora accenti e maiuscole
 *   role  P portiere, D difensore, C centrocampista, A attaccante
 *   max   il TUO tetto di spesa per quel giocatore, non il prezzo di listino
 *
 * Regola pratica: la somma dei `max` dovrebbe fare esattamente AUCTION_BUDGET.
 * Se non torna, l'app te lo segnala in alto con un avviso — non è un errore
 * bloccante, ma vuol dire che stai pianificando più o meno di quello che hai.
 *
 * Dalla stagione 2025/26 è cambiato questo: la lista non è più offuscata con
 * passphrase. L'asta si fa in presenza, quindi non c'è niente da nascondere
 * a chi apre il sorgente. Occhio però: questo repo è pubblico.
 */
;(function (global) {
    'use strict';

    const AUCTION_BUDGET = 500;

    const PLAYERS = [
        // Portieri
        { name: 'Falcone', role: 'P', max: 8 },
        { name: 'Butez', role: 'P', max: 7 },
        { name: 'Turati', role: 'P', max: 5 },

        // Difensori
        { name: 'Zappacosta', role: 'D', max: 15 },
        { name: 'Gatti', role: 'D', max: 14 },
        { name: 'Posch', role: 'D', max: 11 },
        { name: 'Bellanova', role: 'D', max: 11 },
        { name: 'Parisi', role: 'D', max: 10 },
        { name: 'Doig', role: 'D', max: 10 },
        { name: 'Valeri', role: 'D', max: 8 },
        { name: 'Zappa', role: 'D', max: 8 },

        // Centrocampisti
        { name: 'McTominay', role: 'C', max: 45 },
        { name: 'Koopmeiners', role: 'C', max: 28 },
        { name: 'Ferguson', role: 'C', max: 22 },
        { name: 'Pasalic', role: 'C', max: 19 },
        { name: 'Mkhitaryan', role: 'C', max: 18 },
        { name: 'Brescianini', role: 'C', max: 15 },
        { name: 'Baldanzi', role: 'C', max: 13 },
        { name: 'Ilic', role: 'C', max: 10 },

        // Attaccanti
        { name: 'Lautaro Martínez', role: 'A', max: 90 },
        { name: 'Thuram', role: 'A', max: 50 },
        { name: 'Vlahović', role: 'A', max: 35 },
        { name: 'Scamacca', role: 'A', max: 22 },
        { name: 'Orsolini', role: 'A', max: 13 },
        { name: 'Zaccagni', role: 'A', max: 13 },
    ];

    const api = { AUCTION_BUDGET, PLAYERS };

    global.FC = global.FC || {};
    global.FC.playersData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
