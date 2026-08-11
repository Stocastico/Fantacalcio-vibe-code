# Fantacalcio – Helper d'asta 2026/27

Pagine HTML/JS **offline** per l'asta del fantacalcio e per il mercato di riparazione.
Niente build, niente server, niente account: apri il file `.html` col doppio click.

```
├── index.html                        ← helper per l'asta principale
├── market-auction.html               ← mercato di riparazione
├── index-standalone.html             ← le stesse due pagine in un file solo
├── market-auction-standalone.html      (generate, vedi "Sviluppo")
├── assets/
│   ├── style.css
│   └── js/
│       ├── core/                     logica condivisa, senza DOM
│       ├── data/                     ⚙️ le liste che devi modificare tu
│       ├── app-auction.js
│       └── app-market.js
├── tests/                            npm test
├── tools/build-standalone.mjs        npm run build
└── 2025-2026/                        archivio della stagione scorsa
```

## Da fare prima dell'asta

1. Apri [`assets/js/data/players.js`](assets/js/data/players.js) e **sostituisci la lista**:
   al momento contiene quella del 2025/26 come segnaposto.
   Ogni riga è `{ name: 'Cognome', role: 'P'|'D'|'C'|'A', max: <crediti> }`, dove `max`
   è il *tuo* tetto di spesa, non il prezzo di listino.
2. Controlla che la somma dei `max` faccia esattamente il budget (`AUCTION_BUDGET`, ora 500).
   Se non torna, la pagina te lo scrive in un banner in alto.
3. Stessa cosa in [`assets/js/data/market-pool.js`](assets/js/data/market-pool.js) per la riparazione.
4. Se hai modificato qualcosa e vuoi anche i file portabili aggiornati: `npm run build`.

## Le due pagine

### `index.html` — asta principale

Il flusso è: scegli chi chiamare → segui i rilanci → registri l'esito.

- **Estrai e inizia asta**: pesca a caso dalla tua lista e apre l'asta partendo da 1.
- **Chiama il più caro**: ti dà il giocatore col tetto più alto ancora libero.
- **Cerca per nome**: match parziale, accenti e maiuscole ignorati (`vlahovic` trova `Vlahović`).
- **Calcola la mia offerta**: scrivi l'offerta che c'è sul tavolo, ti dice a quanto rilanciare
  o ti dice STOP se sei arrivato al tuo tetto.
- **Preso io** / **Andato ad altri**: registrano l'esito e ridistribuiscono i crediti.
- **Annulla ultima azione**: torna indietro di un passo, ridistribuzione compresa.
- **Esporta CSV**, **Reset totale**, budget modificabile a mano.

### `market-auction.html` — mercato di riparazione

Pool unico senza ruoli, pensato per quando **qualcuno ti guarda lo schermo**: i tuoi
massimali non vengono mai stampati a video né esportati nel CSV. L'app dice solo
"rilancia a X" oppure "STOP".

- **Prossimo**: chiama il giocatore col massimale più alto rimasto.
- **Offerte degli altri**: scrivi nome e offerta corrente, ti dice se rilanciare,
  se fermarti, se non ti interessa o se l'hai già preso.

> Nota: nasconde i massimali *a schermo*, non nel file. Chiunque apra il sorgente li legge.

## Come funziona la ridistribuzione dei crediti

Il budget è un totale chiuso, quindi vale sempre:

```
somma dei tetti rimasti + crediti spesi = budget
```

- Prendi un giocatore **sotto** il tuo tetto → la differenza va agli altri.
- Il giocatore va a un avversario → tutto il suo tetto va agli altri.
- Paghi **sopra** il tuo tetto → lo sforamento viene tolto dai tetti degli altri.

Nell'asta principale i crediti si distribuiscono uno alla volta a rotazione, dal più
caro in giù. Nella riparazione si dividono in parti uguali fra i tre più cari.
Se l'invariante si rompe (lista esaurita, o lista di partenza che non quadra) la pagina
lo scrive in un banner invece di lasciarti scoprire il buco a fine asta.

## Sviluppo

Nessuna dipendenza da installare: serve solo Node ≥ 20 per test e build.

```bash
npm test        # suite in node --test, tutta logica pura
npm run build   # rigenera i due file *-standalone.html
```

I file `*-standalone.html` sono **generati**: non modificarli a mano, le tue modifiche
verrebbero sovrascritte. Rilancia `npm run build` dopo ogni cambio a HTML, CSS, JS o liste.

Il codice in `assets/js/core/` non tocca il DOM ed è caricabile sia come `<script>` da
`file://` sia con `require()` da Node: è per questo che i test girano senza browser.
Niente ESM lato pagina, perché i moduli ES non si caricano da `file://`.

## Cos'è cambiato rispetto alla 2025/26

**Rimosso**

- **Passphrase e offuscamento della lista.** L'asta si fa in presenza, non serve
  nascondere niente. Sono spariti `obfuscation-tool.html`, `obfuscation-utils.js`, gli
  snippet `fantacalcio-obf-snippet-v*.js` e il pannello "re-offusca".
  ⚠️ Questo repository è pubblico: ora la tua lista è leggibile da chiunque.
- Le copie standalone mantenute a mano, che si disallineavano dall'originale a ogni fix.

**Corretto**

- La ridistribuzione perdeva crediti: assegnava al massimo +1 a testa e buttava via il
  resto, così a fine asta i conti non tornavano. Ora distribuisce tutto.
- Sforare il tetto non aveva conseguenze sul resto della lista. Ora lo sforamento viene
  scalato dai tetti dei giocatori rimasti.
- L'annulla dell'asta principale sottraeva solo la spesa: non rimetteva il giocatore in
  lista e non annullava la ridistribuzione. Ora l'annulla è completo su entrambe le pagine.
- Confronti fra nomi a volte con accenti normalizzati e a volte no, con risultati diversi
  a seconda del pulsante premuto. Ora passano tutti dalla stessa funzione.
- Il "Reset" della riparazione non svuotava lo storico delle offerte.

**Cambiato**

- **"Calcola la mia offerta" non elimina più il giocatore da solo** quando superi il
  tetto: prima bastava premerlo per controllare e te lo cancellava. Ora scrive STOP e
  aspetta che tu prema "Andato ad altri".
- **Prezzo finale esplicito.** Prima il prezzo dell'acquisto veniva indovinato
  (`offerta + 1` oppure l'ultimo suggerimento). Ora c'è un campo apposta, precompilato
  col rilancio consigliato ma modificabile.

**Aggiunto**

- Salvataggio automatico anche nell'asta principale: se il browser si chiude a metà
  asta, riapri e riprendi da dove eri. Prima lo aveva solo la riparazione.
- Budget modificabile dalla pagina, senza toccare il codice.
- Banner che segnala quando i conti non quadrano.
- Suite di test automatica (`npm test`) al posto della vecchia `test-suite.js` da
  lanciare a mano dalla console del browser.
- Tema scuro automatico e supporto a `prefers-reduced-motion`.

**Non cambiato**

- Nessuna libreria da aggiornare: il progetto è vanilla JS senza dipendenze, e resta così.
- La regola del 36 è ancora lì (asta principale, tetti sopra 37 e offerte sotto 35).

## Archivio

La versione della stagione scorsa è in [`2025-2026/`](2025-2026/README.md), congelata
com'era. Non riceve correzioni: contiene i bug elencati sopra.
