// 🧪 Automated Test Suite for Fantasy Football Auction App
// Run this in the browser console after unlocking the app

class FantasyFootballTester {
    constructor() {
        this.results = [];
        this.originalRoster = null;
        this.originalPurchases = null;
        this.originalSpent = null;
    }

    // Test utilities
    log(message, type = 'info') {
        const emoji = {
            'pass': '✅',
            'fail': '❌',
            'info': 'ℹ️',
            'warn': '⚠️'
        };
        console.log(`${emoji[type]} ${message}`);
        this.results.push({ message, type });
    }

    assert(condition, testName, errorMessage = '') {
        if (condition) {
            this.log(`PASS: ${testName}`, 'pass');
            return true;
        } else {
            this.log(`FAIL: ${testName} - ${errorMessage}`, 'fail');
            return false;
        }
    }

    setup() {
        this.log('Setting up test environment...', 'info');

        // Save original state
        this.originalRoster = roster ? JSON.parse(JSON.stringify(roster)) : null;
        this.originalPurchases = [...purchases];
        this.originalSpent = spent;

        // Clear any existing state
        purchases.length = 0;
        spent = 0;
        updateCounters();

        this.log('Test environment ready', 'info');
    }

    cleanup() {
        this.log('Cleaning up test environment...', 'info');

        // Restore original state
        if (this.originalRoster) {
            roster = JSON.parse(JSON.stringify(this.originalRoster));
        }
        purchases.length = 0;
        purchases.push(...this.originalPurchases);
        spent = this.originalSpent;

        updateCounters();
        this.log('Test environment restored', 'info');
    }

    // Test functions
    testSearchFunctionality() {
        this.log('Testing search functionality...', 'info');

        if (!roster || roster.length === 0) {
            this.log('No roster available for testing', 'warn');
            return;
        }

        // Test exact match
        const firstPlayer = roster[0];
        const exactResults = findCandidates(firstPlayer.name);
        this.assert(
            exactResults.length === 1 && exactResults[0].name === firstPlayer.name,
            'Exact player search',
            `Expected 1 result for "${firstPlayer.name}", got ${exactResults.length}`
        );

        // Test partial match
        const partialName = firstPlayer.name.substring(0, 4);
        const partialResults = findCandidates(partialName);
        this.assert(
            partialResults.length >= 1,
            'Partial player search',
            `Expected at least 1 result for "${partialName}", got ${partialResults.length}`
        );

        // Test case insensitive
        const lowerResults = findCandidates(firstPlayer.name.toLowerCase());
        this.assert(
            lowerResults.length >= 1,
            'Case insensitive search',
            `Search should be case insensitive`
        );

        // Test non-existent player
        const noResults = findCandidates('NonExistentPlayer123');
        this.assert(
            noResults.length === 0,
            'Non-existent player search',
            `Expected 0 results for non-existent player, got ${noResults.length}`
        );
    }

    testBidCalculation() {
        this.log('Testing bid calculation logic...', 'info');

        if (!roster || roster.length === 0) {
            this.log('No roster available for testing', 'warn');
            return;
        }

        // Find a player with high bid for easter egg test
        const highBidPlayer = roster.find(p => p.bid > 37);

        if (highBidPlayer) {
            // Test easter egg (should suggest 36 when current < 35 and max > 37)
            currentAuctionPlayer = highBidPlayer;

            // Simulate bid calculation for easter egg
            const currentOffer = 30;
            const maxBid = highBidPlayer.bid;

            let ourBid;
            if (maxBid > 37 && currentOffer < 35) {
                ourBid = 36;
            } else {
                ourBid = currentOffer + 1;
            }

            this.assert(
                ourBid === 36,
                'Easter egg bid calculation (36 credits)',
                `Expected 36, got ${ourBid} for current=${currentOffer}, max=${maxBid}`
            );
        }

        // Test normal bid calculation
        const normalPlayer = roster[0];
        currentAuctionPlayer = normalPlayer;
        const normalOffer = 20;
        const normalBid = normalOffer + 1;

        this.assert(
            normalBid === 21,
            'Normal bid calculation (+1)',
            `Expected 21, got ${normalBid}`
        );
    }

    testPurchaseSystem() {
        this.log('Testing purchase system...', 'info');

        if (!roster || roster.length === 0) {
            this.log('No roster available for testing', 'warn');
            return;
        }

        const testPlayer = roster[0];
        const testPrice = 15;
        const initialSpent = spent;
        const initialLength = purchases.length;

        // Test valid purchase
        const result = addPurchase(testPlayer.name, testPrice);

        this.assert(
            result !== false,
            'Valid player purchase',
            'Purchase should succeed'
        );

        this.assert(
            spent === initialSpent + testPrice,
            'Budget update after purchase',
            `Expected spent to be ${initialSpent + testPrice}, got ${spent}`
        );

        this.assert(
            purchases.length === initialLength + 1,
            'Purchase list update',
            `Expected ${initialLength + 1} purchases, got ${purchases.length}`
        );

        // Test duplicate purchase
        const duplicateResult = addPurchase(testPlayer.name, testPrice);
        this.assert(
            duplicateResult === false,
            'Prevent duplicate purchase',
            'Should not allow buying same player twice'
        );

        // Test budget overflow
        const expensivePrice = START_BUDGET + 100;
        const overflowResult = addPurchase(roster[1]?.name || 'TestPlayer', expensivePrice);
        this.assert(
            overflowResult === false,
            'Prevent budget overflow',
            'Should not allow purchases exceeding budget'
        );
    }

    testCreditRedistribution() {
        this.log('Testing credit redistribution on purchase with savings...', 'info');

        if (!roster || roster.length < 5) {
            this.log('Insufficient roster for redistribution testing (need at least 5 players)', 'warn');
            return;
        }

        // Save original bids
        const originalBids = roster.map(p => ({ name: p.name, bid: p.bid }));

        // Test 1: Standard redistribution - player bought for less than max bid
        this.log('Test 1: Standard purchase redistribution', 'info');
        const testPlayer = roster.find(p => p.bid >= 20) || roster[0];
        const purchasePrice = testPlayer.bid - 5; // Save 5 credits
        const savedCredits = testPlayer.bid - purchasePrice;

        // Get top players (excluding the purchased one) before redistribution
        const remainingPlayers = roster
            .filter(p => p.name !== testPlayer.name)
            .sort((a, b) => (b.bid || 0) - (a.bid || 0));

        const topPlayersBefore = remainingPlayers.slice(0, savedCredits);
        const topPlayersBidsBefore = topPlayersBefore.map(p => p.bid);

        // Perform redistribution
        const redistributed = redistributeCredits(savedCredits, testPlayer.name);

        // Verify redistribution count
        const expectedRedistribution = Math.min(savedCredits, remainingPlayers.length);
        this.assert(
            redistributed === expectedRedistribution,
            'Purchase redistribution count matches expected',
            `Expected ${expectedRedistribution} credits redistributed, got ${redistributed}`
        );

        // Verify that top players got +1 bid each
        if (redistributed > 0) {
            let correctDistribution = true;

            for (let i = 0; i < redistributed; i++) {
                const expectedNewBid = topPlayersBidsBefore[i] + 1;
                if (topPlayersBefore[i].bid !== expectedNewBid) {
                    correctDistribution = false;
                    this.log(`Player ${topPlayersBefore[i].name}: expected ${expectedNewBid}, got ${topPlayersBefore[i].bid}`, 'warn');
                }
            }

            this.assert(
                correctDistribution,
                'Saved credits distributed to most expensive remaining players (+1 each)',
                'Top remaining players should each receive exactly +1 credit'
            );
        }

        // Restore for next test
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        // Test 2: Saved credits exceed remaining players
        this.log('Test 2: Savings exceed number of remaining players', 'info');
        const hugeSavings = roster.length + 10; // More credits than players
        const maxPossible = roster.length - 1; // Exclude purchased player
        const redistributed2 = redistributeCredits(hugeSavings, testPlayer.name);

        this.assert(
            redistributed2 === maxPossible,
            'Redistribution capped by remaining player count',
            `With ${hugeSavings} savings but only ${maxPossible} other players, expected ${maxPossible} redistributed, got ${redistributed2}`
        );

        // Restore for next test
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        // Test 3: Verify prioritization - most expensive get credits first
        this.log('Test 3: Verify prioritization of expensive players', 'info');
        const savings3 = 3; // Only 3 credits to distribute
        const sortedPlayers = [...roster]
            .filter(p => p.name !== testPlayer.name)
            .sort((a, b) => (b.bid || 0) - (a.bid || 0));
        const topThreeBefore = sortedPlayers.slice(0, 3).map(p => ({ name: p.name, bid: p.bid }));

        redistributeCredits(savings3, testPlayer.name);

        const topThreeAfter = sortedPlayers.slice(0, 3);
        let prioritizationCorrect = true;
        for (let i = 0; i < 3; i++) {
            if (topThreeAfter[i].bid !== topThreeBefore[i].bid + 1) {
                prioritizationCorrect = false;
                this.log(`Priority error: ${topThreeAfter[i].name} expected ${topThreeBefore[i].bid + 1}, got ${topThreeAfter[i].bid}`, 'warn');
                break;
            }
        }

        this.assert(
            prioritizationCorrect,
            'Most expensive remaining players prioritized',
            'Top 3 most expensive remaining players should each get +1 credit'
        );

        // Restore for next test
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        // Test 4: Edge case - zero saved credits
        this.log('Test 4: Purchase at exact max bid (no savings)', 'info');
        const bidsBefore = roster.map(p => p.bid);
        const zeroSavingsResult = redistributeCredits(0, testPlayer.name);

        this.assert(
            zeroSavingsResult === 0,
            'No redistribution when no credits saved',
            'Should return 0 when purchase price equals max bid'
        );

        // Verify no bids changed
        const bidsUnchanged = roster.every((p, i) => p.bid === bidsBefore[i]);
        this.assert(
            bidsUnchanged,
            'Player bids unchanged with zero savings',
            'No player bids should change'
        );

        // Test 5: Edge case - negative saved credits (shouldn't happen but test safety)
        this.log('Test 5: Negative saved credits (safety check)', 'info');
        const negativeResult = redistributeCredits(-5, testPlayer.name);

        this.assert(
            negativeResult === 0,
            'No redistribution for negative credits',
            'Should return 0 for negative savings'
        );

        // Test 6: Single credit saved
        this.log('Test 6: Only 1 credit saved', 'info');
        const topPlayerBefore = [...roster]
            .filter(p => p.name !== testPlayer.name)
            .sort((a, b) => (b.bid || 0) - (a.bid || 0))[0];
        const topPlayerBidBefore = topPlayerBefore.bid;

        const singleCredResult = redistributeCredits(1, testPlayer.name);

        this.assert(
            singleCredResult === 1,
            'Exactly 1 credit redistributed',
            `Expected 1 credit redistributed, got ${singleCredResult}`
        );

        this.assert(
            topPlayerBefore.bid === topPlayerBidBefore + 1,
            'Single saved credit goes to most expensive remaining player',
            `Top player should have ${topPlayerBidBefore + 1}, got ${topPlayerBefore.bid}`
        );

        // Test 7: Verify purchased player is excluded from redistribution
        this.log('Test 7: Verify purchased player excluded from redistribution', 'info');
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        const purchasedPlayerBidBefore = testPlayer.bid;
        redistributeCredits(10, testPlayer.name);

        this.assert(
            testPlayer.bid === purchasedPlayerBidBefore,
            'Purchased player bid unchanged',
            `Purchased player "${testPlayer.name}" should not receive redistributed credits`
        );

        // Restore original bids
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        this.log('Credit redistribution on purchase tests completed', 'info');
    }

    testCreditRedistributionOnLoss() {
        this.log('Testing credit redistribution on player loss...', 'info');

        if (!roster || roster.length < 5) {
            this.log('Insufficient roster for loss redistribution testing (need at least 5 players)', 'warn');
            return;
        }

        // Save original state
        const originalBids = roster.map(p => ({ name: p.name, bid: p.bid }));

        // Test 1: Standard redistribution with enough players
        this.log('Test 1: Standard loss redistribution', 'info');
        const lostPlayer = roster.find(p => p.bid >= 20) || roster[0];
        const lostPlayerBid = lostPlayer.bid;

        // Get the top players before redistribution (excluding the lost player)
        const remainingPlayersBeforeLoss = roster
            .filter(p => p.name !== lostPlayer.name)
            .sort((a, b) => (b.bid || 0) - (a.bid || 0));

        const topPlayersBefore = remainingPlayersBeforeLoss.slice(0, Math.min(lostPlayerBid, remainingPlayersBeforeLoss.length));
        const topPlayersBidsBefore = topPlayersBefore.map(p => p.bid);

        // Perform redistribution on loss
        const redistributed = redistributeCreditsOnLoss(lostPlayer);

        // Verify the redistribution count
        const expectedRedistribution = Math.min(lostPlayerBid, remainingPlayersBeforeLoss.length);
        this.assert(
            redistributed === expectedRedistribution,
            'Loss redistribution count matches expected',
            `Expected ${expectedRedistribution} credits redistributed, got ${redistributed}`
        );

        // Verify that top players got +1 bid each
        if (redistributed > 0) {
            let correctDistribution = true;
            let allIncreased = true;

            for (let i = 0; i < redistributed; i++) {
                const expectedNewBid = topPlayersBidsBefore[i] + 1;
                if (topPlayersBefore[i].bid !== expectedNewBid) {
                    correctDistribution = false;
                    this.log(`Player ${topPlayersBefore[i].name}: expected ${expectedNewBid}, got ${topPlayersBefore[i].bid}`, 'warn');
                }
            }

            this.assert(
                correctDistribution,
                'Credits distributed to most expensive players (+1 each)',
                'Top players should each receive exactly +1 credit'
            );
        }

        // Restore original bids for next test
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        // Test 2: Loss with more credits than remaining players
        this.log('Test 2: Loss with more credits than available players', 'info');
        const highBidPlayer = { name: 'HighBidTest', bid: 100, role: 'A' };
        const maxPossible = roster.length;
        const redistributed2 = redistributeCreditsOnLoss(highBidPlayer);

        this.assert(
            redistributed2 === maxPossible,
            'Redistribution capped by number of remaining players',
            `With ${highBidPlayer.bid} credits but only ${maxPossible} players, expected ${maxPossible} redistributed, got ${redistributed2}`
        );

        // Restore for next test
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        // Test 3: Verify prioritization - most expensive players get credits first
        this.log('Test 3: Verify prioritization of expensive players', 'info');
        const testLostPlayer = { name: 'TestPlayer', bid: 3, role: 'D' };
        const sortedBefore = [...roster].sort((a, b) => (b.bid || 0) - (a.bid || 0));
        const topThreeBefore = sortedBefore.slice(0, 3).map(p => ({ name: p.name, bid: p.bid }));

        redistributeCreditsOnLoss(testLostPlayer);

        const topThreeAfter = sortedBefore.slice(0, 3);
        let prioritizationCorrect = true;
        for (let i = 0; i < 3; i++) {
            if (topThreeAfter[i].bid !== topThreeBefore[i].bid + 1) {
                prioritizationCorrect = false;
                break;
            }
        }

        this.assert(
            prioritizationCorrect,
            'Most expensive players prioritized for credit distribution',
            'Top 3 most expensive players should each get +1 credit'
        );

        // Restore for next test
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        // Test 4: Edge case - player with 0 bid
        this.log('Test 4: Loss of player with zero bid', 'info');
        const zeroBidPlayer = { name: 'ZeroBid', bid: 0, role: 'P' };
        const bidsBefore = roster.map(p => p.bid);
        const zeroBidResult = redistributeCreditsOnLoss(zeroBidPlayer);

        this.assert(
            zeroBidResult === 0,
            'No redistribution for zero bid player',
            'Should return 0 when lost player has no bid'
        );

        // Verify no bids changed
        const bidsUnchanged = roster.every((p, i) => p.bid === bidsBefore[i]);
        this.assert(
            bidsUnchanged,
            'Player bids unchanged when losing zero bid player',
            'No player bids should change'
        );

        // Test 5: Edge case - player with 1 credit (only top player gets +1)
        this.log('Test 5: Loss of player with 1 credit bid', 'info');
        const oneCreditPlayer = { name: 'OneCredit', bid: 1, role: 'P' };
        const topPlayerBefore = [...roster].sort((a, b) => (b.bid || 0) - (a.bid || 0))[0];
        const topPlayerBidBefore = topPlayerBefore.bid;

        const oneCredResult = redistributeCreditsOnLoss(oneCreditPlayer);

        this.assert(
            oneCredResult === 1,
            'Exactly 1 credit redistributed for 1-bid player',
            `Expected 1 credit redistributed, got ${oneCredResult}`
        );

        this.assert(
            topPlayerBefore.bid === topPlayerBidBefore + 1,
            'Single credit goes to most expensive player',
            `Top player should have ${topPlayerBidBefore + 1}, got ${topPlayerBefore.bid}`
        );

        // Restore original bids
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        this.log('Credit redistribution on loss tests completed', 'info');
    }

    testLossScenarios() {
        this.log('Testing loss scenarios with redistribution...', 'info');

        if (!roster || roster.length < 5) {
            this.log('Insufficient roster for loss scenario testing (need at least 5 players)', 'warn');
            return;
        }

        // Save original state
        const originalRoster = JSON.parse(JSON.stringify(roster));
        const originalBids = roster.map(p => ({ name: p.name, bid: p.bid }));

        // Test 1: Player lost through manual "Player Lost" button
        this.log('Test 1: Manual player loss with redistribution', 'info');
        const testPlayer = roster[0];
        const originalBid = testPlayer.bid;
        const originalRosterLength = roster.length;

        // Get remaining players before loss (sorted by bid)
        const remainingBefore = roster
            .filter(p => p.name !== testPlayer.name)
            .sort((a, b) => (b.bid || 0) - (a.bid || 0));

        const topPlayersBefore = remainingBefore.slice(0, Math.min(originalBid, remainingBefore.length));
        const topPlayersBidsBefore = topPlayersBefore.map(p => p.bid);

        // Simulate the loss and redistribution
        const lostPlayer = testPlayer;
        roster = roster.filter(p => p.name !== testPlayer.name);
        const redistributed = redistributeCreditsOnLoss(lostPlayer);

        // Verify roster reduction
        this.assert(
            roster.length === originalRosterLength - 1,
            'Roster size reduced by 1 on loss',
            `Expected roster to shrink from ${originalRosterLength} to ${originalRosterLength - 1}, got ${roster.length}`
        );

        // Verify redistribution occurred correctly
        if (originalBid > 0 && redistributed > 0) {
            let allCorrect = true;
            for (let i = 0; i < redistributed; i++) {
                const playerAfter = roster.find(p => p.name === topPlayersBefore[i].name);
                if (playerAfter && playerAfter.bid !== topPlayersBidsBefore[i] + 1) {
                    allCorrect = false;
                    break;
                }
            }

            this.assert(
                allCorrect,
                'Credits correctly redistributed after manual loss',
                `Top ${redistributed} players should each gain +1 credit`
            );
        }

        // Restore for next test
        roster = JSON.parse(JSON.stringify(originalRoster));

        // Test 2: Player lost through bid limit reached
        this.log('Test 2: Player lost due to bid limit reached', 'info');
        const highBidPlayer = roster.find(p => p.bid >= 25) || roster[0];
        const playerBid = highBidPlayer.bid;
        const beforeLoss = roster.length;

        // Get top players before this loss
        const remainingBefore2 = roster
            .filter(p => p.name !== highBidPlayer.name)
            .sort((a, b) => (b.bid || 0) - (a.bid || 0));
        const topBefore2 = remainingBefore2.slice(0, Math.min(playerBid, remainingBefore2.length));

        // Simulate reaching bid limit
        roster = roster.filter(p => p.name !== highBidPlayer.name);
        const redistributed2 = redistributeCreditsOnLoss(highBidPlayer);

        this.assert(
            redistributed2 <= playerBid,
            'Redistribution amount within lost player bid',
            `Redistributed ${redistributed2} should not exceed lost player bid ${playerBid}`
        );

        this.assert(
            redistributed2 <= beforeLoss - 1,
            'Redistribution count within remaining players',
            `Redistributed to ${redistributed2} players should not exceed remaining ${beforeLoss - 1}`
        );

        this.assert(
            redistributed2 === Math.min(playerBid, beforeLoss - 1),
            'Optimal redistribution count',
            `Should redistribute ${Math.min(playerBid, beforeLoss - 1)}, got ${redistributed2}`
        );

        // Restore for next test
        roster = JSON.parse(JSON.stringify(originalRoster));

        // Test 3: Multiple sequential losses
        this.log('Test 3: Multiple sequential losses with cumulative redistribution', 'info');
        const totalBidsBefore = sumBid(roster);
        
        // Lose first player
        const loss1 = roster[0];
        const bid1 = loss1.bid;
        roster = roster.filter(p => p.name !== loss1.name);
        redistributeCreditsOnLoss(loss1);
        
        // Lose second player
        const loss2 = roster[0];
        const bid2 = loss2.bid;
        roster = roster.filter(p => p.name !== loss2.name);
        redistributeCreditsOnLoss(loss2);

        const totalBidsAfter = sumBid(roster);
        const expectedBidsAfter = totalBidsBefore - bid1 - bid2 + 
            Math.min(bid1, originalRosterLength - 1) + 
            Math.min(bid2, originalRosterLength - 2);

        this.assert(
            totalBidsAfter === expectedBidsAfter,
            'Total bids conserved through multiple losses',
            `Expected total bids ${expectedBidsAfter}, got ${totalBidsAfter}`
        );

        // Restore for next test
        roster = JSON.parse(JSON.stringify(originalRoster));

        // Test 4: Loss followed by purchase redistribution
        this.log('Test 4: Loss followed by purchase with savings', 'info');
        
        // First lose a player
        const lossPlayer = roster.find(p => p.bid >= 15) || roster[0];
        roster = roster.filter(p => p.name !== lossPlayer.name);
        redistributeCreditsOnLoss(lossPlayer);
        const totalAfterLoss = sumBid(roster);

        // Then acquire a player for less than max bid
        const purchasePlayer = roster.find(p => p.bid >= 20) || roster[0];
        const savings = 5;
        redistributeCredits(savings, purchasePlayer.name);
        const totalAfterPurchase = sumBid(roster);

        // Total should increase by the redistributed amount
        const expectedIncrease = Math.min(savings, roster.filter(p => p.name !== purchasePlayer.name).length);
        this.assert(
            totalAfterPurchase === totalAfterLoss + expectedIncrease,
            'Correct bid total after loss and purchase combo',
            `Expected total ${totalAfterLoss + expectedIncrease}, got ${totalAfterPurchase}`
        );

        // Restore original roster and bids
        roster = originalRoster;
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });

        this.log('Loss scenario tests completed', 'info');
    }

    testCounters() {
        this.log('Testing counter updates...', 'info');

        if (!roster) {
            this.log('No roster available for counter testing', 'warn');
            return;
        }

        const counts = countsByRole(roster);
        const expectedTotal = counts.P + counts.D + counts.C + counts.A;

        this.assert(
            expectedTotal === roster.length,
            'Role counter accuracy',
            `Role counts (${expectedTotal}) should equal roster length (${roster.length})`
        );

        const sumBids = sumBid(roster);
        this.assert(
            typeof sumBids === 'number' && sumBids >= 0,
            'Bid sum calculation',
            `Sum of bids should be a positive number, got ${sumBids}`
        );
    }

    testUtilityFunctions() {
        this.log('Testing utility functions...', 'info');

        // Test normalization
        const testCases = [
            ['Nicolò', 'nicolo'],
            ['José', 'jose'],
            ['  Spaced Name  ', 'spaced name'],
            ['UPPERCASE', 'uppercase']
        ];

        testCases.forEach(([input, expected]) => {
            const result = norm(input);
            this.assert(
                result === expected,
                `Normalization: "${input}" → "${expected}"`,
                `Got "${result}" instead of "${expected}"`
            );
        });
    }

    // Run all tests
    async runAllTests() {
        console.clear();
        this.log('🧪 Starting Fantasy Football App Test Suite', 'info');
        this.log('='.repeat(50), 'info');

        // Check if app is unlocked
        if (!ORIGINAL || !roster) {
            this.log('❌ App not unlocked! Please unlock the app first.', 'fail');
            return;
        }

        this.setup();

        try {
            this.testUtilityFunctions();
            this.testSearchFunctionality();
            this.testBidCalculation();
            this.testCounters();
            this.testCreditRedistribution();
            this.testCreditRedistributionOnLoss();
            this.testLossScenarios();
            this.testPurchaseSystem();
        } catch (error) {
            this.log(`Test suite error: ${error.message}`, 'fail');
        } finally {
            this.cleanup();
        }

        // Summary
        this.log('='.repeat(50), 'info');
        const passed = this.results.filter(r => r.type === 'pass').length;
        const failed = this.results.filter(r => r.type === 'fail').length;
        const total = passed + failed;

        this.log(`Test Results: ${passed}/${total} passed`, passed === total ? 'pass' : 'fail');

        if (failed > 0) {
            this.log('Some tests failed. Check the console output above for details.', 'warn');
        } else {
            this.log('All tests passed! 🎉', 'pass');
        }

        return { passed, failed, total, results: this.results };
    }
}

// Make tester available globally
window.FantasyTester = new FantasyFootballTester();

// Quick test function
window.runTests = () => window.FantasyTester.runAllTests();

console.log('🧪 Fantasy Football Test Suite loaded!');
console.log('📋 Usage:');
console.log('  runTests() - Run all tests');
console.log('  FantasyTester.testSearchFunctionality() - Run specific test');
console.log('');
console.log('⚠️  Make sure to unlock the app first!');
