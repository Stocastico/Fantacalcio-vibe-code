# 🧪 Fantasy Football Auction App - Testing Guide

## Quick Test Setup

### Prerequisites

1. Open `index.html` in a web browser
2. Have your passphrase ready
3. Open browser Developer Tools (F12) for debugging

---

## 🔍 Testing Checklist

### 1. **Authentication & Data Loading**

- [ ] **Unlock with correct passphrase**
  - Enter correct passphrase → should unlock and show app
  - Check all counters display (P, D, C, A, budget, remaining players)
- [ ] **Unlock with wrong passphrase**
  - Enter incorrect passphrase → should show error message
- [ ] **Enter key unlock**
  - Type passphrase and press Enter → should unlock
- [ ] **Empty passphrase**
  - Try to unlock without entering passphrase → should handle gracefully

### 2. **Player Search & Auction**

- [ ] **Exact player search**
  - Search for exact player name → should find and show auction section
- [ ] **Partial player search**
  - Search for partial name → should show multiple matches
- [ ] **Non-existent player**
  - Search for player not in list → should show "not found" message
- [ ] **Case insensitive search**
  - Search with different capitalization → should still work
- [ ] **Search with accents/special characters**
  - Test with accented names → should normalize and find

### 3. **Random Player Selection**

- [ ] **Extract random player**
  - Click "Estrai e inizia asta" → should show random player and start auction
- [ ] **Random when list empty**
  - When no players left → should show appropriate message

### 4. **Bid Calculation Logic**

- [ ] **Normal bid (+1)**
  - Current offer: 20, Max bid: 30 → should suggest 21
- [ ] **Easter egg (36 credits)**
  - Current offer: 30, Max bid: 40 → should suggest 36
  - Current offer: 34, Max bid: 38 → should suggest 36
- [ ] **Player over limit**
  - Current offer: 25, Max bid: 25 → should mark as "lost"
- [ ] **Invalid offer input**
  - Enter non-number → should show error
  - Enter negative number → should show error

### 5. **Player Acquisition**

- [ ] **Win player under budget**
  - Acquire player for less than max bid → should work
- [ ] **Win player over budget**
  - Try to acquire when insufficient credits → should prevent
- [ ] **Win player already owned**
  - Try to acquire same player twice → should prevent
- [ ] **Credit redistribution**
  - Win player for less than max bid → check if credits redistributed to other players

### 6. **Player Management**

- [ ] **Player marked as lost**
  - Mark player as "andato" → should remove from remaining list
- [ ] **Undo last purchase**
  - Buy player, then undo → should restore budget and remove from purchased list
- [ ] **Show remaining list**
  - Click emergency button → should show/hide remaining players

### 7. **Budget & Counters**

- [ ] **Budget updates**
  - After each purchase → budget should decrease correctly
- [ ] **Counter updates**
  - After player removal → role counters should update
  - After purchase → "remaining players" should decrease
- [ ] **Sum of bids**
  - Should reflect current maximum bids (including redistributed credits)

### 8. **Data Export**

- [ ] **CSV export**
  - Export purchases → should download CSV file with correct data
- [ ] **Re-obfuscation**
  - Generate new obfuscated string → should create valid string

### 9. **List Reset**

- [ ] **Reset functionality**
  - Reset list → should restore original player list
  - All counters should reset to initial values

---

## 🧪 Manual Test Scenarios

### Scenario 1: Complete Auction Flow

```text
1. Unlock app with passphrase
2. Search for "Lautaro" 
3. Start auction with current offer 35
4. Calculate bid (should suggest 36 due to easter egg)
5. Mark as won for 36 credits
6. Verify budget decreased and player removed from list
7. Check if credits were redistributed
```

### Scenario 2: Budget Management

```text
1. Start with 500 credits
2. Buy expensive players until near budget limit
3. Try to buy player that would exceed budget
4. Verify prevention and error message
5. Test undo functionality
```

### Scenario 3: Edge Cases

```text
1. Search for player with special characters
2. Try to acquire same player twice
3. Test with empty search
4. Test random selection when list is empty
5. Test bid calculation at exact limits
```

---

## 🔧 Browser Console Testing

Open Developer Tools Console and run:

```javascript
// Test data access
console.log("Original players:", ORIGINAL?.length);
console.log("Current roster:", roster?.length);
console.log("Purchases:", purchases);

// Test utility functions
console.log("Normalize test:", norm("Nicolò Barella") === norm("nicolo barella"));

// Test search
console.log("Search test:", findCandidates("lautaro"));

// Test counters
updateCounters();
```

---

## 🐛 Common Issues to Check

### Performance

- [ ] App loads quickly
- [ ] Search is responsive
- [ ] Animations are smooth
- [ ] No memory leaks during extended use

### UI/UX

- [ ] All buttons are clickable and responsive
- [ ] Text is readable on different screen sizes
- [ ] Colors and styling look good
- [ ] Mobile responsiveness (if applicable)

### Data Integrity

- [ ] Player data survives page refresh (until reset)
- [ ] Credit calculations are always accurate
- [ ] No players can be "lost" accidentally
- [ ] Purchased list maintains correct order

---

## 🚨 Error Testing

### Invalid Data

- [ ] Malformed player data
- [ ] Missing player properties
- [ ] Invalid credit amounts

### Network Issues

- [ ] App works offline
- [ ] No external dependencies fail

### Browser Compatibility

- [ ] Works in Chrome, Firefox, Safari
- [ ] JavaScript features are supported
- [ ] Crypto API availability

---

## 📊 Test Results Template

```text
✅ PASSED: [Feature description]
❌ FAILED: [Feature description] - [Issue details]
⚠️  PARTIAL: [Feature description] - [Notes]
```

### Example Test Run

```text
✅ PASSED: Unlock with correct passphrase
✅ PASSED: Search exact player name
✅ PASSED: Easter egg bid calculation (36 credits)
✅ PASSED: Credit redistribution after purchase
❌ FAILED: Mobile layout on small screens - buttons too small
⚠️  PARTIAL: CSV export works but date format could be improved
```

---

## 🎯 Automated Testing (Optional)

If you want to set up automated tests, consider testing:

- Core functions: `findCandidates()`, `addPurchase()`, `redistributeCredits()`
- Bid calculation logic
- Data persistence
- Search normalization

Would you like me to create a simple automated test suite as well?
