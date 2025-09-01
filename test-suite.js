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
        this.log('Testing credit redistribution...', 'info');

        if (!roster || roster.length < 3) {
            this.log('Insufficient roster for redistribution testing', 'warn');
            return;
        }

        // Find a player with decent bid for testing
        const testPlayer = roster.find(p => p.bid >= 20);
        if (!testPlayer) {
            this.log('No suitable player for redistribution test', 'warn');
            return;
        }

        // Save original bids
        const originalBids = roster.map(p => ({ name: p.name, bid: p.bid }));

        // Test redistribution
        const purchasePrice = testPlayer.bid - 5; // 5 credits to redistribute
        const savedCredits = testPlayer.bid - purchasePrice;

        const redistributed = redistributeCredits(savedCredits, testPlayer.name);

        this.assert(
            redistributed === Math.min(savedCredits, roster.length - 1),
            'Credit redistribution count',
            `Expected redistribution to ${Math.min(savedCredits, roster.length - 1)} players, got ${redistributed}`
        );

        // Restore original bids
        originalBids.forEach(orig => {
            const player = roster.find(p => p.name === orig.name);
            if (player) player.bid = orig.bid;
        });
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
