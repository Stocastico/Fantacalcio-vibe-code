/**
 * Pool per il mercato di riparazione — stagione 2026/27.
 *
 * ⚠️ SEGNAPOSTO: valori dell'ultima riparazione 2025/26. Aggiornali prima del
 * prossimo mercato.
 *
 * Qui non ci sono ruoli: è un pool unico, i giocatori vengono chiamati in
 * ordine di massimale decrescente col pulsante "Prossimo".
 *
 * I massimali non compaiono mai a schermo: l'app mostra solo il nome e ti dice
 * se rilanciare o fermarti. Questo serve quando qualcuno ti guarda lo schermo,
 * non a nascondere il file — chiunque apra questo sorgente li vede.
 */
;(function (global) {
    'use strict';

    const MARKET_BUDGET = 416;

    const MARKET_POOL = [
        { name: 'Orban', max: 131 },
        { name: 'Malen', max: 127 },
        { name: 'Zielinski', max: 45 },
        { name: 'Cambiaghi', max: 43 },
        { name: 'Ostigard', max: 20 },
        { name: 'Ramon', max: 20 },
        { name: 'Muric', max: 5 },
    ];

    const api = { MARKET_BUDGET, MARKET_POOL };

    global.FC = global.FC || {};
    global.FC.marketData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
