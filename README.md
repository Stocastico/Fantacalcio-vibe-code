# Fantacalcio – Helper d'asta 2026/27

Due pagine HTML/JS **offline** per l'asta e per il mercato di riparazione.
Niente build, niente server: apri il file `.html` col doppio click.

| File | A cosa serve |
| --- | --- |
| `index.html` | asta principale |
| `market-auction.html` | mercato di riparazione (massimali nascosti a schermo) |
| `*-standalone.html` | le stesse pagine in un file solo, per portarle in giro — **generate** |
| `liste/*.csv` | ⚙️ **le liste che modifichi tu**, anche da Excel |
| `assets/js/data/` | le stesse liste in JavaScript — **generate** dai CSV |
| `2025-2026/` | archivio della stagione scorsa, congelato |

## Il giorno dell'asta

**Prima di uscire di casa**, con Node a portata di mano:

```bash
npm run import   # legge liste/*.csv e riscrive assets/js/data/
npm run build    # rigenera i due file *-standalone.html
npm test         # facoltativo: controlla che le liste tornino
```

Poi porta con te **`index-standalone.html`**: è un file solo, funziona senza rete e
senza Node, basta il browser. Se all'asta non hai il computer con il repo, quello è
l'unico file che ti serve.

All'asta, in ordine:

1. **Apri la pagina** col doppio click e controlla le pillole in alto: *Crediti
   residui* deve essere il tuo budget, *Da comprare* i giocatori della rosa (25).
   Se il *Budget totale* o la *Rosa completa* non tornano, correggili in fondo alla
   pagina e premi *Applica*.
2. **Quando tocca a te chiamare**, apri *Da chiamare all'inizio* e butta sul tavolo
   un'esca, oppure usa *Estrai e inizia asta* / *Chiama il più caro* per pescare dai
   tuoi desiderati.
3. **Quando chiama un altro**, scrivi il nome in *Cerca per nome*. Se è fra i tuoi
   desiderati si apre il riquadro dell'asta; se non c'è, la pagina te lo dice.
4. **Mentre si rilancia**, tieni aggiornata l'*Offerta attuale sul tavolo* e premi
   *Calcola la mia offerta*: ti risponde **rilancia a N**, **sopra il tuo tetto** o
   **STOP**. Il numero da non superare mai è la pillola *Max spendibile*.
5. **Appena si chiude**, premi **✅ Preso io** (il prezzo è già compilato) oppure
   **😞 Andato ad altri**: è questo che tiene aggiornati i crediti degli altri.
   Sbagliato? *Annulla ultima azione*.
6. **Se il giocatore che hai preso non era in lista**, registralo in *Ho preso uno
   fuori lista*: serve a non ritrovarti con la rosa incompleta e i conti sballati.
7. **Se un tuo desiderato va via**, apri *Alternative* e scegli il ripiego. Togli con
   la ✕ chi è già stato chiamato, così resta davanti solo chi è ancora libero.
8. **A fine asta** premi *📦 Esporta CSV* per portarti via la rosa.

Lo stato è salvato nel browser dopo ogni azione: se la pagina si chiude o il computer
si spegne, riaprila e ritrovi tutto. *Reset totale* serve solo per ricominciare da capo.

> ⚠️ Il salvataggio è legato al file che hai aperto: se all'asta usi lo standalone,
> usa quello dall'inizio alla fine, non passare a `index.html` a metà.

## Aggiornare le liste

Le liste stanno in `liste/`, un CSV per lista:

| File | Cosa contiene | Colonne |
| --- | --- | --- |
| [`liste/lista.csv`](liste/lista.csv) | i tuoi desiderati, con i tetti di spesa | Ruolo, Giocatore, Squadra, Max |
| [`liste/alternative.csv`](liste/alternative.csv) | i ripieghi | Ruolo, Giocatore, Squadra |
| [`liste/esche.csv`](liste/esche.csv) | i giocatori da chiamare all'inizio | Ruolo, Giocatore, Squadra |

Li apri con Excel o con un editor di testo, li salvi, e poi:

```bash
npm run import   # riscrive assets/js/data/players.js e shortlists.js
npm run build    # rigenera i file portabili
```

I file `.js` sotto `assets/js/data/` sono **generati**: puoi anche modificarli a mano,
ma il prossimo `npm run import` li sovrascrive. Sono in JavaScript e non in CSV perché
le pagine si aprono col doppio click, e da `file://` il browser non ha il permesso di
leggere un file dal disco: la lista dev'essere già dentro la pagina.

Le colonne sono riconosciute per nome, in italiano o inglese (`Giocatore`, `Ruolo`,
`Squadra`, `Max`), in qualsiasi ordine; l'intestazione è obbligatoria. Nelle due liste
di supporto la colonna `Max` non serve e viene ignorata: lì non si compra niente.

Se un CSV ha righe rotte o nomi doppi il tool te lo dice e le salta, invece di
infilarti in asta una lista che non torna.

Altre forme dello stesso comando:

```bash
npm run import -- --target alternative   # solo le alternative
npm run import -- altro.csv              # la lista d'asta da un file tuo
npm run import -- pool.csv --target market   # il pool della riparazione
npm run import -- --dry-run              # stampa e basta, non scrive niente
cat lista.csv | npm run import -- -      # il "-" vuol dire standard input
```

Ogni riga della lista d'asta è `{ name, role, team, max }`, dove **`max` è il tuo tetto
di spesa**, non il prezzo di listino. La somma dei `max` dovrebbe fare il budget; se
non torna, il tool avvisa e la pagina lo scrive in un banner.

`ROSTER_SIZE` è quanti giocatori devi avere a fine asta (25). Non deve coincidere con
la lunghezza della lista: gli slot che avanzano li riempi con gli acquisti fuori lista.
Si cambia con `--roster N`, o dalla pagina stessa.

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

## Le due liste di supporto

Sotto la pagina d'asta ci sono due bottoni che aprono e chiudono altrettante liste:

- **Alternative** — su chi ripiego se un desiderato me lo portano via.
- **Da chiamare all'inizio** — le esche: i pezzi grossi che butti sul tavolo per far
  bruciare crediti agli altri mentre i tuoi desiderati sono ancora lì.

Sono promemoria, non liste d'asta: solo nome, ruolo e squadra, niente tetti, e non
toccano crediti né rosa. La ✕ accanto a ogni nome lo toglie quando è già stato
chiamato; le rimozioni si salvano nel browser insieme al resto. *Ripristina liste* le
rimette intere senza toccare l'asta, e anche il *Reset totale* le riporta come stanno
nei CSV.

I nomi che ci trovi sono un esempio: sostituiscili con i tuoi in
[`liste/alternative.csv`](liste/alternative.csv) e [`liste/esche.csv`](liste/esche.csv).

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
npm run import   # CSV → assets/js/data/
npm run build    # rigenera i file *-standalone.html
```

I file generati (`assets/js/data/*.js` e `*-standalone.html`) non si modificano a
mano: si rigenerano con i due comandi qui sopra, e la suite fallisce se restano
indietro rispetto ai sorgenti. Il codice in `assets/js/core/` non tocca il DOM e
funziona sia come `<script>` da `file://` sia con `require()` da Node — per questo i
test girano senza browser, e per questo non si usano moduli ES lato pagina.

> La lista non è più offuscata e questo repository è pubblico: chiunque può leggerla.
