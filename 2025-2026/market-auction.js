(() => {
  'use strict';

  const STORAGE_KEY = 'marketAuctionStateV6';

  const DEFAULT_BUDGET = 416;
  const DEFAULT_POOL = [
    { name: 'Muric', max: 5 },
    { name: 'Ostigard', max: 20 },
    { name: 'Ramon', max: 20 },
    { name: 'Cambiaghi', max: 43 },
    { name: 'Zielinski', max: 45 },
    { name: 'Malen', max: 127 },
    { name: 'Orban', max: 131 },
  ];

  const $ = (id) => document.getElementById(id);
  const norm = (s) => (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const toInt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return Math.round(v);
  };

  function cloneDefaultPool() {
    return DEFAULT_POOL.map(p => ({ name: p.name, max: p.max }));
  }

  function sortByMaxDesc(list) {
    return [...list].sort((a, b) => (b.max - a.max) || a.name.localeCompare(b.name));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const ui = {
      spentPill: $('spentPill'),
      leftPill: $('leftPill'),
      outCheck: $('outCheck'),
      auctionSection: $('auctionSection'),
      playerInfo: $('playerInfo'),
      currentOffer: $('currentOffer'),
      outAuction: $('outAuction'),
      purchasesList: $('purchasesList'),
      outBuy: $('outBuy'),
      btnNextCall: $('btnNextCall'),
      btnResetAll: $('btnResetAll'),
      btnSuggest: $('btnSuggest'),
      btnWon: $('btnWon'),
      btnLost: $('btnLost'),
      btnUndo: $('btnUndo'),
      btnExportCSV: $('btnExportCSV'),

      offerName: $('offerName'),
      offerCurrent: $('offerCurrent'),
      btnAddOffer: $('btnAddOffer'),
      offersList: $('offersList'),
      outOffers: $('outOffers'),
    };

    let budget = DEFAULT_BUDGET;
    let pool = cloneDefaultPool();
    let purchases = [];
    let spent = 0;
    let current = null;
    let actions = []; // {type:'win'|'loss', ...}
    let offers = []; // {name, currentOffer, suggestion, status, at}

    function updateCounters() {
      ui.spentPill.textContent = `Speso: ${spent}`;
      ui.leftPill.textContent = `Residuo: ${Math.max(0, budget - spent)}`;
    }

    function renderPurchases() {
      ui.purchasesList.innerHTML = '';
      for (const p of purchases) {
        const li = document.createElement('li');
        li.textContent = `${p.name} - ${p.price}`;
        ui.purchasesList.appendChild(li);
      }
    }

    function renderOffers() {
      if (!ui.offersList) return;
      ui.offersList.innerHTML = '';
      for (const o of offers.slice().reverse()) {
        const li = document.createElement('li');
        if (o.status === 'interested') {
          li.textContent = `${o.name}: offerta ${o.currentOffer} → rilancio ${o.suggestion}`;
        } else if (o.status === 'stop') {
          li.textContent = `${o.name}: offerta ${o.currentOffer} → STOP (massimo raggiunto)`;
        } else if (o.status === 'not-interested') {
          li.textContent = `${o.name}: offerta ${o.currentOffer} → non interessati`;
        } else if (o.status === 'already-bought') {
          li.textContent = `${o.name}: già acquistato`;
        } else {
          li.textContent = `${o.name}: offerta ${o.currentOffer}`;
        }
        ui.offersList.appendChild(li);
      }
    }

    function resetAuctionUI() {
      current = null;
      ui.auctionSection.style.display = 'none';
      ui.playerInfo.textContent = '';
      ui.currentOffer.value = '';
      ui.outAuction.textContent = '';
    }

    function saveState() {
      const state = { budget, pool, purchases, spent, actions, offers };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { }
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.pool) || !Array.isArray(parsed.purchases)) return false;

        budget = (typeof parsed.budget === 'number' && Number.isFinite(parsed.budget))
          ? Math.max(0, Math.round(parsed.budget))
          : DEFAULT_BUDGET;
        pool = parsed.pool;
        purchases = parsed.purchases;
        spent = Number(parsed.spent) || 0;
        actions = Array.isArray(parsed.actions) ? parsed.actions : [];
        offers = Array.isArray(parsed.offers) ? parsed.offers : [];
        return true;
      } catch {
        return false;
      }
    }

    function nextCallCandidate() {
      if (!pool.length) return null;
      return sortByMaxDesc(pool)[0] || null;
    }

    function setCurrentPlayer(player) {
      current = player;
      ui.playerInfo.textContent = `${player.name}`;
      ui.auctionSection.style.display = '';
      ui.currentOffer.value = '1';
      ui.outAuction.textContent = '';
      ui.auctionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function suggestBid() {
      if (!current) return { ok: false, message: 'Nessun giocatore selezionato.' };

      const raw = (ui.currentOffer.value || '').trim();
      const bid = raw === '' ? 1 : toInt(raw);
      if (bid == null || bid < 1) return { ok: false, message: 'Offerta non valida.' };
      if (bid > current.max) return { ok: false, message: 'Stop: raggiunto il tuo massimo.' };
      return { ok: true, bid, message: `Ok: offriamo ${bid} crediti.` };
    }

    function findInPoolByName(name) {
      const key = norm(name);
      if (!key) return null;
      return pool.find(p => norm(p.name) === key) || null;
    }

    function findInPurchasesByName(name) {
      const key = norm(name);
      if (!key) return null;
      return purchases.find(p => norm(p.name) === key) || null;
    }

    function suggestBidForName(name, currentOffer) {
      const cur = currentOffer == null ? 0 : currentOffer;
      const next = cur <= 0 ? 1 : cur + 1;

      const bought = findInPurchasesByName(name);
      if (bought) return { status: 'already-bought', next: null };

      const p = findInPoolByName(name);
      if (!p) return { status: 'not-interested', next: null };

      if (next > p.max) return { status: 'stop', next: null };
      return { status: 'interested', next };
    }

    function removeFromPool(name) {
      const key = norm(name);
      const before = pool.length;
      pool = pool.filter(p => norm(p.name) !== key);
      return pool.length !== before;
    }

    function redistributeOnLossEven(amountRaw, topN = 3) {
      const amount = toInt(amountRaw);
      if (amount == null || amount <= 0) return { distributed: 0, targets: [] };

      const targets = sortByMaxDesc(pool).slice(0, topN);
      if (!targets.length) return { distributed: 0, targets: [] };

      const snapshots = targets.map(t => ({ name: t.name, oldMax: t.max }));

      const each = Math.floor(amount / targets.length);
      const rem = amount % targets.length;
      for (let i = 0; i < targets.length; i++) {
        targets[i].max += each + (i < rem ? 1 : 0);
      }

      const merged = targets.map(t => {
        const before = snapshots.find(s => norm(s.name) === norm(t.name));
        return { name: t.name, oldMax: before ? before.oldMax : null, newMax: t.max };
      });

      return { distributed: amount, targets: merged };
    }

    function addPurchase(name, price, max) {
      const priceInt = toInt(price);
      if (!name) { ui.outBuy.textContent = '❌ Nome mancante.'; return false; }
      if (priceInt == null || priceInt < 0) { ui.outBuy.textContent = '❌ Prezzo non valido.'; return false; }
      if (spent + priceInt > budget) { ui.outBuy.textContent = `❌ Budget insufficiente. Residuo ${Math.max(0, budget - spent)}, prezzo ${priceInt}.`; return false; }

      purchases.push({ name, price: priceInt, max: max ?? null });
      spent += priceInt;
      renderPurchases();
      updateCounters();
      ui.outBuy.textContent = `✅ Aggiunto "${name}" per ${priceInt}.`;
      return true;
    }

    function undoLast() {
      if (!actions.length) { ui.outBuy.textContent = '⚠️ Nessuna azione da annullare.'; return; }
      const last = actions.pop();

      if (last.type === 'win') {
        if (Array.isArray(last.redistributedTargets)) {
          for (const t of last.redistributedTargets) {
            const p = pool.find(x => norm(x.name) === norm(t.name));
            if (p && typeof t.oldMax === 'number') p.max = t.oldMax;
          }
        }

        const removedPurchase = purchases.pop();
        if (removedPurchase) spent -= removedPurchase.price;

        const exists = pool.some(p => norm(p.name) === norm(last.player.name));
        if (!exists) pool.push({ name: last.player.name, max: last.player.max });

        renderPurchases();
        updateCounters();
        saveState();
        ui.outBuy.textContent = `↩️ Annullato: Vinto "${last.player.name}".`;
        return;
      }

      if (last.type === 'loss') {
        if (Array.isArray(last.redistributedTargets)) {
          for (const t of last.redistributedTargets) {
            const p = pool.find(x => norm(x.name) === norm(t.name));
            if (p && typeof t.oldMax === 'number') p.max = t.oldMax;
          }
        }

        const exists = pool.some(p => norm(p.name) === norm(last.player.name));
        if (!exists) pool.push({ name: last.player.name, max: last.player.max });

        updateCounters();
        saveState();
        ui.outBuy.textContent = `↩️ Annullato: Perso "${last.player.name}" (rollback redistribuzione).`;
      }
    }

    function exportCSV() {
      if (!purchases.length) { ui.outBuy.textContent = '⚠️ Nessun acquisto da esportare.'; return; }

      const rows = [
        ['Nome', 'Prezzo'],
        ...purchases.map(p => [p.name, String(p.price)]),
        ['Totale speso', String(spent)],
        ['Budget', String(budget)],
        ['Residuo', String(Math.max(0, budget - spent))],
      ];

      const csv = rows
        .map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `market_auction_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ui.outBuy.textContent = '📦 CSV esportato.';
    }

    // Wire events
    ui.btnNextCall.addEventListener('click', () => {
      const p = nextCallCandidate();
      if (!p) {
        ui.outCheck.textContent = '❌ Pool vuoto.';
        resetAuctionUI();
        return;
      }
      ui.outCheck.textContent = `➡️ Prossimo: ${p.name}`;
      setCurrentPlayer(p);
    });

    ui.btnResetAll.addEventListener('click', () => {
      if (!confirm('Reset? Ripristina pool e azzera acquisti.')) return;
      budget = DEFAULT_BUDGET;
      pool = cloneDefaultPool();
      purchases = [];
      actions = [];
      spent = 0;
      renderPurchases();
      resetAuctionUI();
      ui.outCheck.textContent = '✅ Reset completato.';
      ui.outBuy.textContent = '';
      updateCounters();
      saveState();
    });

    ui.btnSuggest.addEventListener('click', () => {
      const res = suggestBid();
      ui.outAuction.textContent = res.ok ? `💰 ${res.message}` : `⚠️ ${res.message}`;
    });

    ui.btnWon.addEventListener('click', () => {
      if (!current) return;
      const res = suggestBid();
      if (!res.ok) { ui.outAuction.textContent = `⚠️ ${res.message}`; return; }

      const playerSnapshot = { name: current.name, max: current.max };
      const removed = removeFromPool(current.name);
      const ok = addPurchase(current.name, res.bid, current.max);
      if (!ok) {
        if (removed) pool.push(playerSnapshot);
        updateCounters();
        saveState();
        ui.outAuction.textContent = '❌ Impossibile registrare acquisto (controlla budget).';
        return;
      }

      const leftover = Math.max(0, playerSnapshot.max - res.bid);
      const redistribution = leftover > 0 ? redistributeOnLossEven(leftover, 3) : { targets: [] };

      actions.push({ type: 'win', player: playerSnapshot, redistributedTargets: redistribution.targets });
      saveState();
      ui.outAuction.textContent = redistribution.targets.length
        ? `🎉 Vinto: ${playerSnapshot.name} a ${res.bid}. Redistribuzione applicata.`
        : `🎉 Vinto: ${playerSnapshot.name} a ${res.bid}.`;
      resetAuctionUI();
    });

    ui.btnLost.addEventListener('click', () => {
      if (!current) return;
      const playerSnapshot = { name: current.name, max: current.max };
      removeFromPool(current.name);

      const redistribution = redistributeOnLossEven(playerSnapshot.max, 3);
      actions.push({ type: 'loss', player: playerSnapshot, redistributedTargets: redistribution.targets });

      ui.outAuction.textContent = redistribution.targets.length
        ? `😞 Perso: ${playerSnapshot.name}. Redistribuzione applicata sui prossimi 3.`
        : `😞 Perso: ${playerSnapshot.name}.`;

      updateCounters();
      saveState();
      resetAuctionUI();
    });

    ui.btnUndo.addEventListener('click', () => {
      undoLast();
      renderPurchases();
      updateCounters();
    });

    ui.btnExportCSV.addEventListener('click', exportCSV);

    if (ui.btnAddOffer) {
      ui.btnAddOffer.addEventListener('click', () => {
        const name = (ui.offerName?.value || '').trim();
        const curRaw = (ui.offerCurrent?.value || '').trim();
        const cur = curRaw === '' ? 0 : toInt(curRaw);
        if (!name) {
          ui.outOffers.textContent = '❌ Inserisci un nome.';
          return;
        }
        if (cur == null || cur < 0) {
          ui.outOffers.textContent = '❌ Offerta attuale non valida.';
          return;
        }

        const res = suggestBidForName(name, cur);
        const entry = {
          name,
          currentOffer: cur,
          suggestion: res.next,
          status: res.status,
          at: Date.now(),
        };
        offers.push(entry);
        // keep it small
        if (offers.length > 50) offers = offers.slice(-50);
        renderOffers();
        saveState();

        if (res.status === 'interested') ui.outOffers.textContent = `✅ Rilancia a ${res.next}.`;
        else if (res.status === 'stop') ui.outOffers.textContent = '⛔ STOP: raggiunto il tuo massimo.';
        else if (res.status === 'already-bought') ui.outOffers.textContent = 'ℹ️ Già acquistato.';
        else ui.outOffers.textContent = '🚫 Non interessati a questo giocatore.';
      });
    }

    // Init
    const restored = loadState();
    if (!restored) saveState();
    renderPurchases();
    renderOffers();
    updateCounters();
    resetAuctionUI();
  });
})();
