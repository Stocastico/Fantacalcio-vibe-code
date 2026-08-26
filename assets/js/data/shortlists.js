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
        { name: "Carnesecchi", role: "P", team: "Atalanta"   },
        { name: "Di Gregorio", role: "P", team: "Juventus"   },
        { name: "Bijol",       role: "D", team: "Udinese"    },
        { name: "Cambiaso",    role: "D", team: "Juventus"   },
        { name: "Dodo",        role: "D", team: "Fiorentina" },
        { name: "Frattesi",    role: "C", team: "Inter"      },
        { name: "Zaccagni",    role: "C", team: "Lazio"      },
        { name: "Pellegrini",  role: "C", team: "Roma"       },
        { name: "Cutrone",     role: "A", team: "Como"       },
        { name: "Piccoli",     role: "A", team: "Cagliari"   },
    ];

    /** Le esche: li chiamo io per primo, ma non li voglio. */
    const BAITS = [
        { name: "Maignan",   role: "P", team: "Milan"      },
        { name: "Dimarco",   role: "D", team: "Inter"      },
        { name: "Bastoni",   role: "D", team: "Inter"      },
        { name: "De Bruyne", role: "C", team: "Napoli"     },
        { name: "Pulisic",   role: "C", team: "Milan"      },
        { name: "Yildiz",    role: "C", team: "Juventus"   },
        { name: "Lautaro",   role: "A", team: "Inter"      },
        { name: "Leao",      role: "A", team: "Milan"      },
        { name: "Lookman",   role: "A", team: "Atalanta"   },
        { name: "Kean",      role: "A", team: "Fiorentina" },
    ];

    const api = { ALTERNATIVES, BAITS };

    global.FC = global.FC || {};
    global.FC.shortlistsData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
