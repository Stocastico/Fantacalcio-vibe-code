/**
 * Le due liste di supporto della pagina d'asta — stagione 2026/27.
 *
 * ⚠️  FILE GENERATO da tools/csv-to-lists.mjs, a partire da
 *     liste/alternative.csv e liste/esche.csv.
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

    /** Su chi ripiego se il desiderato me lo portano via. */
    const ALTERNATIVES = [
        { name: "Butez",         role: "P", team: "Como"     },
        { name: "Carnesecchi",   role: "P", team: "Atalanta" },
        { name: "Pavlovic",      role: "D", team: "Milan"    },
        { name: "Mina",          role: "D", team: "Cagliari" },
        { name: "McTominay",     role: "C", team: "Napoli"   },
        { name: "Perrone",       role: "C", team: "Como"     },
        { name: "Zielinski",     role: "C", team: "Inter"    },
        { name: "Goncalo Ramos", role: "A", team: "Milan"    },
        { name: "Davis",         role: "A", team: "Udinese"  },
        { name: "Krstovic",      role: "A", team: "Atalanta" },
    ];

    /** Le esche: li chiamo io per primo, ma non li voglio. */
    const BAITS = [
        { name: "Lautaro",  role: "A", team: "Inter"      },
        { name: "Malen",    role: "A", team: "Roma"       },
        { name: "Dimarco",  role: "D", team: "Inter"      },
        { name: "Nico Paz", role: "C", team: "Como"       },
        { name: "Thuram",   role: "A", team: "Inter"      },
        { name: "Scamacca", role: "A", team: "Atalanta"   },
        { name: "Pulisic",  role: "C", team: "Milan"      },
        { name: "Bremer",   role: "D", team: "Juventus"   },
        { name: "Kean",     role: "A", team: "Fiorentina" },
        { name: "Yildiz",   role: "A", team: "Juventus"   },
    ];

    const api = { ALTERNATIVES, BAITS };

    global.FC = global.FC || {};
    global.FC.shortlistsData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
