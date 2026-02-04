# Fantacalcio-vibe-code

Collezione di pagine HTML/JS **offline** per aiutare durante l’asta del fantacalcio.

Non serve build, non serve server: apri i file `.html` nel browser.

## Quick start

1. Scarica/clona la cartella.
2. Apri uno dei file HTML in un browser (Chrome/Edge/Firefox).
3. Se una pagina usa localStorage, lo stato resta salvato su quel browser/PC.

## Pagine e cosa fanno

### Quale pagina apro?

| Ti serve… | Apri… | Note |
| --- | --- | --- |
| Helper d’asta con lista **offuscata** + passphrase | [index.html](index.html) | Richiede i file JS/CSS accanto (già inclusi nel repo) |
| Helper d’asta offuscato **single-file** | [fantacalcio-standalone.html](fantacalcio-standalone.html) | Tutto in un file |
| Market auction (pool unico) con **max nascosti** | [market-auction-standalone.html](market-auction-standalone.html) | Consigliato per portabilità; alternativa modulare: [market-auction.html](market-auction.html) |

### Helper d’asta (lista offuscata)

- [index.html](index.html): helper principale con **lista offuscata + passphrase**.
  - Dipendenze: [style.css](style.css), [players.js](players.js), [script.js](script.js), [test-suite.js](test-suite.js).
  - Flusso: sblocchi con passphrase → cerchi/estrai giocatori → calcoli/registri acquisti → export CSV.
  - Nota sicurezza: è **offuscazione**, non crittografia forte.

- [fantacalcio-standalone.html](fantacalcio-standalone.html): versione **single-file** dell’helper offuscato.

- [fantacalcio-helper-autopilota-v8.html](fantacalcio-helper-autopilota-v8.html): variante “autopilota” leggera (UI minimale) sempre con lista offuscata.

### Market auction (pool unico, max nascosti)

Queste pagine sono pensate per il “market” con un pool unico (nessun ruolo) e **strategia privata**:
i massimali sono hardcoded ma **non vengono mai mostrati** a schermo.

- [market-auction.html](market-auction.html): versione modulare (HTML + JS separato).
  - Script: [market-auction.js](market-auction.js)
  - Caratteristiche:
    - Budget di default: 416
    - Pulsante **Prossimo**: chiama il giocatore col massimale più alto rimanente
    - Campo “La mia offerta”: parte da 1 quando fai “Prossimo”, puoi sovrascriverla
    - **Vinto**: registra l’acquisto al prezzo inserito nel campo
    - **Perso**: rimuove il giocatore e ridistribuisce i crediti
    - Ridistribuzione: avviene sia quando lo perdi sia quando lo vinci sotto-max (la differenza viene redistribuita)
    - Undo e export CSV
    - Stato salvato in localStorage

- [market-auction-standalone.html](market-auction-standalone.html): versione **portabile single-file** (HTML+CSS+JS nello stesso file).
  - Utile per passare il file su un altro PC senza copiare altro.

### Strumenti di offuscazione

- [obfuscation-tool.html](obfuscation-tool.html): tool per generare/testare la stringa offuscata (OBF).
  - Dipendenza: [obfuscation-utils.js](obfuscation-utils.js)
  - Uso tipico:
    1) incolli una lista JSON di giocatori
    2) scegli una passphrase
    3) generi `const OBF = "..."` da incollare in [players.js](players.js)

### Snippet e versioni storiche

- [fantacalcio-obf-snippet-v6.js](fantacalcio-obf-snippet-v6.js), [fantacalcio-obf-snippet-v7.js](fantacalcio-obf-snippet-v7.js), [fantacalcio-obf-snippet-v8.js](fantacalcio-obf-snippet-v8.js): snippet storici/di supporto per l’offuscazione.
- [STANDALONE-UPDATE-LOG.md](STANDALONE-UPDATE-LOG.md): changelog della versione standalone.

## Configurazione (cosa editare)

### Cambiare lista/budget del Market Auction

- In [market-auction.js](market-auction.js): modifica `DEFAULT_BUDGET` e `DEFAULT_POOL`.
- In [market-auction-standalone.html](market-auction-standalone.html): stessa cosa, dentro lo `<script>`.

## Test e documentazione

- [TESTING.md](TESTING.md): checklist di test manuali per l’helper offuscato.
- [test-suite.js](test-suite.js): suite automatica (da console dopo lo sblocco).
  - Apri [index.html](index.html), sblocca, poi in console: `runTests()`

Documenti di audit/report (storico):

- [BUG-REPORT-AND-FIXES.md](BUG-REPORT-AND-FIXES.md)
- [SECOND-AUDIT-REPORT.md](SECOND-AUDIT-REPORT.md)
- [FINAL-AUDIT-SUMMARY.md](FINAL-AUDIT-SUMMARY.md)
- [CREDIT-REDISTRIBUTION-TESTS.md](CREDIT-REDISTRIBUTION-TESTS.md)

## Note pratiche

- Offline-first: funziona senza rete.
- Privacy: i massimali del market auction sono hardcoded ma l’interfaccia non li espone.
- Persistenza: il market auction salva lo stato su localStorage; per azzerare usa “Reset” (o cancella i dati del sito nel browser).
