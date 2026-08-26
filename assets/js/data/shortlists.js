/**
 * Le due liste di supporto della pagina d'asta — stagione 2026/27.
 *
 * ⚠️  I nomi qui sotto sono un ESEMPIO: sostituiscili con i tuoi.
 *     È un normale file JavaScript, si modifica a mano (l'import da CSV
 *     riguarda solo players.js, queste liste no).
 *
 * Formato di ogni riga — niente massimali, qui non si compra:
 *   { name: "Cognome", role: "P" | "D" | "C" | "A", team: "Squadra" }
 *
 *   name  come lo chiami tu
 *   role  P portiere, D difensore, C centrocampista, A attaccante (opzionale)
 *   team  per riconoscere gli omonimi a colpo d'occhio (opzionale)
 *
 * ALTERNATIVES  i ripieghi: se un desiderato di players.js va a un altro, sono
 *               questi i nomi su cui ripiegare. Tienili nell'ordine in cui li
 *               vorresti: la pagina non li riordina.
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
        { name: "Carnesecchi",  role: "P", team: "Atalanta"   },
        { name: "Di Gregorio",  role: "P", team: "Juventus"   },
        { name: "Bijol",        role: "D", team: "Udinese"    },
        { name: "Cambiaso",     role: "D", team: "Juventus"   },
        { name: "Dodo",         role: "D", team: "Fiorentina" },
        { name: "Frattesi",     role: "C", team: "Inter"      },
        { name: "Zaccagni",     role: "C", team: "Lazio"      },
        { name: "Pellegrini",   role: "C", team: "Roma"       },
        { name: "Cutrone",      role: "A", team: "Como"       },
        { name: "Piccoli",      role: "A", team: "Cagliari"   },
    ];

    /** Le esche: li chiamo io per primo, ma non li voglio. */
    const BAITS = [
        { name: "Maignan",      role: "P", team: "Milan"      },
        { name: "Dimarco",      role: "D", team: "Inter"      },
        { name: "Bastoni",      role: "D", team: "Inter"      },
        { name: "De Bruyne",    role: "C", team: "Napoli"     },
        { name: "Pulisic",      role: "C", team: "Milan"      },
        { name: "Yildiz",       role: "C", team: "Juventus"   },
        { name: "Lautaro",      role: "A", team: "Inter"      },
        { name: "Leao",         role: "A", team: "Milan"      },
        { name: "Lookman",      role: "A", team: "Atalanta"   },
        { name: "Kean",         role: "A", team: "Fiorentina" },
    ];

    const api = { ALTERNATIVES, BAITS };

    global.FC = global.FC || {};
    global.FC.shortlistsData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
