# Fantacalcio – Helper d'asta 2026/27

Due pagine HTML/JS **offline** per l'asta e per il mercato di riparazione.
Niente build, niente server: apri il file `.html` col doppio click.

| File | A cosa serve |
| --- | --- |
| `index.html` | asta principale |
| `market-auction.html` | mercato di riparazione (massimali nascosti a schermo) |
| `*-standalone.html` | le stesse pagine in un file solo, per portarle in giro — **generate** |
| `assets/js/data/` | ⚙️ le liste che modifichi tu |
| `2025-2026/` | archivio della stagione scorsa, congelato |

## Aggiornare la lista

Da CSV, o a mano su [`assets/js/data/players.js`](assets/js/data/players.js).

```bash
npm run import -- lista.csv   # riscrive players.js
npm run build                 # rigenera i file portabili
```

Il CSV vuole un'intestazione; le colonne sono riconosciute per nome, in italiano o
inglese (`Giocatore`, `Ruolo`, `Squadra`, `Max`), in qualsiasi ordine.
`--target market` aggiorna il pool della riparazione, `--dry-run` non scrive niente.

Ogni riga è `{ name, role, team, max }`, dove **`max` è il tuo tetto di spesa**, non il
prezzo di listino. La somma dei `max` dovrebbe fare il budget; se non torna, la pagina
lo scrive in un banner.

`ROSTER_SIZE` nello stesso file è quanti giocatori devi avere a fine asta (25). Non
deve coincidere con la lunghezza della lista: gli slot che avanzano li riempi con
gli acquisti fuori lista. Si cambia con `--roster N` o a mano.

## Quanto puoi spendere

Il `max` della lista è un piano: **in asta lo puoi sforare**. Il limite vero è la
pillola *Max spendibile*:

```
max spendibile = crediti residui − 1 per ogni slot di rosa che resterà vuoto
```

Con 500 crediti e 25 giocatori da comprare, sul primo arrivi a 476. Il totale della
rosa si imposta nella pagina (0 = nessuna riserva).

*Calcola la mia offerta* dà tre risposte: **rilancia a N** (dentro il piano),
**sopra il tuo tetto** (sostenibile, ma quei crediti li togli agli altri), **STOP**
(non ci sono i crediti).

Due pillole simili ma diverse: **In lista** sono i giocatori rimasti nella wishlist,
**Da comprare** sono gli slot di rosa ancora vuoti — cala solo quando compri.

## Prendere uno fuori lista

Se sei all'asta di persona capita l'occasione non pianificata, o alla fine restano
slot da riempire e desiderati non ne hai più. Il riquadro *Ho preso uno fuori lista*
lo registra lo stesso, dicendoti che non era fra i giocatori desiderati.

Vale come uno slot di rosa riempito, e siccome per lui non avevi messo da parte
niente **il prezzo lo pagano i tetti di chi resta in lista**: è la stessa regola dello
sforamento, su un tetto di zero. Se cerchi un nome che nella lista non c'è, la pagina
te lo scrive e ti precompila il modulo. Annullarlo lo toglie dalla rosa senza
infilarlo fra i desiderati: lì non c'era.

## Ridistribuzione dei crediti

Il budget è un totale chiuso: `somma dei tetti rimasti + speso = budget`.

- Preso sotto il tuo tetto → la differenza va agli altri.
- Andato a un avversario → tutto il suo tetto va agli altri.
- Pagato sopra il tuo tetto → lo sforamento viene tolto agli altri, mai sotto 1 credito.
- Preso uno fuori lista → il prezzo pieno viene tolto agli altri.

Se l'invariante si rompe, la pagina lo dice in un banner invece di fartelo scoprire a
fine asta.

## Sviluppo

Zero dipendenze, serve solo Node ≥ 20.

```bash
npm test         # suite in node --test
npm run build    # rigenera i file *-standalone.html
```

I `*-standalone.html` sono generati: non modificarli a mano, rilancia `npm run build`
dopo ogni cambio. Il codice in `assets/js/core/` non tocca il DOM e funziona sia come
`<script>` da `file://` sia con `require()` da Node — per questo i test girano senza
browser, e per questo non si usano moduli ES lato pagina.

> La lista non è più offuscata e questo repository è pubblico: chiunque può leggerla.
