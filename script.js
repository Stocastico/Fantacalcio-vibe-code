// Utils
async function sha256Bytes(str) { const enc = new TextEncoder().encode(str); const hash = await crypto.subtle.digest("SHA-256", enc); return new Uint8Array(hash); }
function b64ToBytes(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++)out[i] = bin.charCodeAt(i); return out; }
function bytesToB64(bytes) { let bin = ""; for (let i = 0; i < bytes.length; i++)bin += String.fromCharCode(bytes[i]); return btoa(bin); }
function deobfuscate(obf, key) { const out = new Uint8Array(obf.length); for (let i = 0; i < obf.length; i++)out[i] = (obf[i] - key[i % key.length] + 256) % 256; return out; }
function obfuscate(plain, key) { const out = new Uint8Array(plain.length); for (let i = 0; i < plain.length; i++)out[i] = (plain[i] + key[i % key.length]) % 256; return out; }

// State
let ORIGINAL = null, roster = null; const START_BUDGET = 500; let purchases = []; let spent = 0; let currentAuctionPlayer = null; let lastSuggestedBid = null;
const norm = s => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const sumBid = list => list.reduce((a, x) => a + (x.bid || 0), 0);
const countsByRole = list => list.reduce((m, x) => (m[x.role] = (m[x.role] || 0) + 1, m), { P: 0, D: 0, C: 0, A: 0 });

function updateCounters() {
    if (!roster) return;
    const c = countsByRole(roster);
    document.getElementById("countP").textContent = `P: ${c.P}`;
    document.getElementById("countD").textContent = `D: ${c.D}`;
    document.getElementById("countC").textContent = `C: ${c.C}`;
    document.getElementById("countA").textContent = `A: ${c.A}`;
    document.getElementById("sumNow").textContent = `Somma tetti: ${sumBid(roster)}`;
    document.getElementById("budgetLeft").textContent = `Crediti residui: ${START_BUDGET - spent}`;
    document.getElementById("playersLeft").textContent = `Giocatori rimanenti: ${roster.length}`;
    document.getElementById("spentPill").textContent = `Speso: ${spent}`;
    document.getElementById("leftPill").textContent = `Residuo: ${START_BUDGET - spent}`;
}

// Variante 'ext': non mostra il tetto massimo/prezzo stimato
const formatPlayer = p => `${p.name} - ${p.role}`;

function listRemaining() {
    const order = { P: 0, D: 1, C: 2, A: 3 };
    return [...roster].sort((a, b) => (order[a.role] - order[b.role]) || (b.bid - a.bid) || a.name.localeCompare(b.name)).map(formatPlayer).join("\n");
}

function findCandidates(q, inList = roster) {
    const s = norm(q);
    if (!s) return [];
    const exact = inList.filter(p => norm(p.name) === s);
    if (exact.length === 1) return exact;
    return inList.filter(p => norm(p.name).includes(s));
}

function redistributeCredits(savedCredits, purchasedPlayerName) {
    if (savedCredits <= 0 || !roster || roster.length === 0) return 0;

    // Get remaining players (excluding the one just purchased) sorted by max bid (highest first)
    const remainingPlayers = roster
        .filter(p => norm(p.name) !== norm(purchasedPlayerName))
        .sort((a, b) => (b.bid || 0) - (a.bid || 0));

    let creditsToDistribute = Math.min(savedCredits, remainingPlayers.length);
    let distributed = 0;

    // Add +1 to the most expensive players until credits run out
    for (let i = 0; i < creditsToDistribute && i < remainingPlayers.length; i++) {
        remainingPlayers[i].bid = (remainingPlayers[i].bid || 0) + 1;
        distributed++;
    }

    return distributed;
}

function addPurchase(name, price) {
    const out = document.getElementById("outBuy");
    if (!name) { out.innerHTML = "❌ Nome mancante."; return false; }
    if (!Number.isFinite(price) || price < 0) { out.innerHTML = "❌ Prezzo non valido."; return false; }
    const priceInt = Math.round(price);
    const playerInList = ORIGINAL ? ORIGINAL.find(p => norm(p.name) === norm(name)) : null;
    if (!playerInList) { out.innerHTML = `❌ <span class="warn">"${name}" non è nella tua lista originale di giocatori.</span>`; return false; }
    const already = purchases.find(p => norm(p.name) === norm(name));
    if (already) { out.innerHTML = `❌ <span class="warn">"${name}" già acquistato (${already.price} crediti).`; return false; }
    if (spent + priceInt > START_BUDGET) { out.innerHTML = `❌ <span class="warn">Budget insufficiente. Residuo ${START_BUDGET - spent}, prezzo ${priceInt}.`; return false; }

    const over = playerInList.bid && priceInt > playerInList.bid;
    const savedCredits = playerInList.bid ? Math.max(0, playerInList.bid - priceInt) : 0;

    purchases.push({ name, price: priceInt });
    spent += priceInt;

    // Redistribute saved credits to remaining players
    let redistributed = 0;
    if (savedCredits > 0) {
        redistributed = redistributeCredits(savedCredits, name);
    }

    const li = document.createElement("li");
    li.textContent = `${name} - ${priceInt}` + (over ? ` (>${playerInList.bid})` : "");
    li.classList.add("flash-add");
    document.getElementById("purchasesList").appendChild(li);

    let message = over ? `⚠️ Aggiunto "${name}" per ${priceInt}` : `✅ Aggiunto "${name}" per ${priceInt}`;
    if (redistributed > 0) {
        message += ` | 💰 ${redistributed} crediti ridistribuiti ai giocatori più costosi`;
    }
    out.innerHTML = message;

    updateCounters();
    return li;
}

function undoPurchase() {
    const out = document.getElementById("outBuy");
    if (purchases.length === 0) { out.innerHTML = "⚠️ Nessun acquisto da annullare."; return; }
    const last = purchases.pop();
    spent -= last.price;
    const list = document.getElementById("purchasesList");
    if (list.lastChild) list.removeChild(list.lastChild);
    out.innerHTML = `↩️ Annullato "${last.name}" per ${last.price}`;
    updateCounters();
}

function exportCSV() {
    const out = document.getElementById("outBuy");
    if (purchases.length === 0) { out.innerHTML = "⚠️ Nessun acquisto da esportare."; return; }
    const rows = [["Nome", "Prezzo"], ...purchases.map(p => [p.name, String(p.price)])];
    rows.push(["Totale speso", String(spent)]);
    rows.push(["Residuo", String(START_BUDGET - spent)]);
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acquisti_fantacalcio_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    out.innerHTML = "📦 CSV esportato.";
}

const $ = sel => document.querySelector(sel);

// Unlock logic function
async function performUnlock() {
    const pw = $("#pw").value || "";
    const out = $("#outUnlock");
    try {
        const key = await sha256Bytes(pw);
        const obf = b64ToBytes(OBF);
        const plain = deobfuscate(obf, key);
        const text = new TextDecoder().decode(plain);
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Formato elenco non valido.");
        ORIGINAL = parsed;
        roster = JSON.parse(JSON.stringify(ORIGINAL));
        $("#locked").style.display = "none";
        $("#app").style.display = "";
        updateCounters();
        document.getElementById("leftList").textContent = listRemaining();
    } catch (e) {
        console.error(e);
        out.innerHTML = "❌ <span class='warn'>Passphrase errata o dati corrotti.</span>";
    }
}

// Unlock button click
$("#btnUnlock").addEventListener("click", performUnlock);

// Unlock on Enter key press in password field
$("#pw").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        performUnlock();
    }
});

// Main event delegation
document.addEventListener("click", ev => {
    const id = ev.target && ev.target.id;
    if (!id) return;

    if (id === "btnCheck") {
        const q = $("#q").value;
        const out = $("#outCheck");
        const auctionSection = document.getElementById("auctionSection");
        const matches = findCandidates(q);
        if (matches.length === 0) {
            out.innerHTML = `❌ <span class="warn">"${q}" non è nella tua lista attuale.</span>`;
            auctionSection.style.display = "none";
            currentAuctionPlayer = null;
            lastSuggestedBid = null;
        } else if (matches.length > 1) {
            out.textContent = `⚠️ Trovati più match:\n- ${matches.map(m => m.name).join("\n- ")}`;
            auctionSection.style.display = "none";
            currentAuctionPlayer = null;
            lastSuggestedBid = null;
        } else {
            const player = matches[0];
            currentAuctionPlayer = player;
            lastSuggestedBid = null;
            out.innerHTML = `✅ <span class="ok">${formatPlayer(player)}</span>`;
            document.getElementById("playerInfo").innerHTML = `<strong>${player.name}</strong> (${player.role})`;
            document.getElementById("currentOffer").value = "";
            document.getElementById("outAuction").innerHTML = "";
            auctionSection.style.display = "block";
        }
    }

    if (id === "btnClear") {
        $("#q").value = "";
        $("#outCheck").textContent = "";
        document.getElementById("auctionSection").style.display = "none";
        currentAuctionPlayer = null;
        lastSuggestedBid = null;
        $("#q").focus();
    }

    if (id === "btnRandom") {
        const out = $("#outRandom");
        if (!roster || roster.length === 0) {
            out.innerHTML = "❌ Lista vuota: nessun giocatore rimanente.";
            return;
        }
        const i = Math.floor(Math.random() * roster.length);
        const p = roster[i];
        out.innerHTML = `🎯 <strong>${p.name}</strong> - ruolo ${p.role}`;
        currentAuctionPlayer = p;
        lastSuggestedBid = null;
        const auctionSection = document.getElementById("auctionSection");
        document.getElementById("playerInfo").innerHTML = `<strong>${p.name}</strong> (${p.role})`;
        document.getElementById("currentOffer").value = "1";
        document.getElementById("outAuction").innerHTML = "";
        auctionSection.style.display = "block";
        auctionSection.scrollIntoView({ behavior: "smooth" });
    }

    if (id === "btnShowLeft") {
        const wrap = document.getElementById("leftWrap");
        const list = document.getElementById("leftList");
        if (wrap.style.display === "none") {
            list.textContent = listRemaining();
            wrap.style.display = "";
        } else wrap.style.display = "none";
    }

    if (id === "btnReset") {
        if (!confirm("Ripristinare la lista originale (500 totali)?")) return;
        roster = JSON.parse(JSON.stringify(ORIGINAL));
        updateCounters();
        document.getElementById("leftList").textContent = listRemaining();
        document.getElementById("outRandom").textContent = "";
        document.getElementById("outCheck").textContent = "";
    }

    if (id === "btnReObf") {
        const newpw = $("#newpw").value || "";
        const out = $("#outReObf");
        if (!newpw) {
            out.innerHTML = "❌ Inserisci una nuova passphrase.";
            return;
        }
        (async () => {
            try {
                const key = await sha256Bytes(newpw);
                const text = JSON.stringify(ORIGINAL);
                const plain = new TextEncoder().encode(text);
                const obf = obfuscate(plain, key);
                const b64 = bytesToB64(obf);
                out.innerHTML = "✅ Nuova stringa OBF (copiala nel file sulla variabile <code>OBF</code>):\n\n" + b64;
            } catch (e) {
                console.error(e);
                out.innerHTML = "❌ Errore nella generazione.";
            }
        })();
    }

    if (id === "btnUndoBuy") undoPurchase();

    if (id === "btnExportCSV") exportCSV();

    if (id === "btnCalculateBid") {
        if (!currentAuctionPlayer) return;
        const outAuction = document.getElementById("outAuction");
        const val = document.getElementById("currentOffer").value || "";
        if (!val) {
            outAuction.innerHTML = "❌ Inserisci l'offerta attuale.";
            return;
        }
        const currentOffer = Number(val);
        if (!Number.isFinite(currentOffer) || currentOffer < 1) {
            outAuction.innerHTML = "❌ Offerta non valida.";
            return;
        }
        const currentOfferInt = Math.round(currentOffer);
        const maxBid = currentAuctionPlayer.bid;
        if (currentOfferInt >= maxBid) {
            // lost - remove from roster
            const before = roster.length;
            roster = roster.filter(p => p.name !== currentAuctionPlayer.name);
            if (roster.length !== before) {
                updateCounters();
                if (document.getElementById("leftWrap").style.display !== "none")
                    document.getElementById("leftList").textContent = listRemaining();
            }
            outAuction.innerHTML = `😞 <strong>${currentAuctionPlayer.name}</strong> andato ad altri (raggiunto limite interno).`;
            lastSuggestedBid = null;
            setTimeout(() => {
                document.getElementById("auctionSection").style.display = "none";
                currentAuctionPlayer = null;
            }, 2500);
        } else {
            // Easter egg: if max bid > 37 and current offer < 35, offer 36
            let ourBid;
            if (maxBid > 37 && currentOfferInt < 35) {
                ourBid = 36;
            } else {
                ourBid = currentOfferInt + 1;
            }
            lastSuggestedBid = { player: currentAuctionPlayer.name, value: ourBid };
            outAuction.innerHTML = `💰 <span class="ok">Offriamo: <strong>${ourBid}</strong> crediti</span>`;
        }
    }

    if (id === "btnPlayerWon") {
        if (!currentAuctionPlayer) return;
        const val = document.getElementById("currentOffer").value || "";
        const outAuction = document.getElementById("outAuction");
        if (!val) {
            outAuction.innerHTML = "❌ Inserisci il prezzo finale di acquisto.";
            return;
        }
        const base = Math.round(Number(val));
        if (!Number.isFinite(base) || base < 0) {
            outAuction.innerHTML = "❌ Prezzo non valido.";
            return;
        }
        // Usa il suggerimento calcolato (ourBid) se ancora valido, altrimenti assume base+1
        let finalPrice = base + 1;
        if (lastSuggestedBid && lastSuggestedBid.player === currentAuctionPlayer.name)
            finalPrice = lastSuggestedBid.value;
        const li = addPurchase(currentAuctionPlayer.name, finalPrice);
        if (li) {
            const before = roster.length;
            roster = roster.filter(p => norm(p.name) !== norm(currentAuctionPlayer.name));
            if (roster.length !== before) {
                updateCounters();
                if (document.getElementById("leftWrap").style.display !== "none")
                    document.getElementById("leftList").textContent = listRemaining();
            }
            outAuction.innerHTML = `🎉 <strong>${currentAuctionPlayer.name}</strong> acquisito, budget aggiornato e rimosso dalla lista rimanente.`;
            li.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => li.classList.remove('flash-add'), 1600);
            document.getElementById("auctionSection").style.display = "none";
            currentAuctionPlayer = null;
            lastSuggestedBid = null;
        } else {
            outAuction.innerHTML = `⚠️ Verifica messaggi sotto la sezione acquisti: impossibile aggiungere <strong>${currentAuctionPlayer.name}</strong>.`;
        }
    }

    if (id === "btnPlayerLost") {
        if (!currentAuctionPlayer) return;
        const outAuction = document.getElementById("outAuction");
        const before = roster.length;
        roster = roster.filter(p => p.name !== currentAuctionPlayer.name);
        if (roster.length !== before) {
            updateCounters();
            if (document.getElementById("leftWrap").style.display !== "none")
                document.getElementById("leftList").textContent = listRemaining();
            outAuction.innerHTML = `😞 <strong>${currentAuctionPlayer.name}</strong> andato ad altri e rimosso.`;
        } else {
            outAuction.innerHTML = `😞 <strong>${currentAuctionPlayer.name}</strong> andato ad altri.`;
        }
        setTimeout(() => {
            document.getElementById("auctionSection").style.display = "none";
            currentAuctionPlayer = null;
        }, 1800);
    }
});
