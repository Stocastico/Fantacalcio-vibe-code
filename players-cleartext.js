// Example player list structure
// This is a template - replace with your actual player data
// Each player should have: name, role (P/D/C/A), and bid (maximum offer)

const PLAYERS_LIST = [
    { "name": "Donnarumma", "role": "P", "bid": 25 },
    { "name": "Maignan", "role": "P", "bid": 20 },
    { "name": "Vicario", "role": "P", "bid": 15 },

    { "name": "Theo Hernandez", "role": "D", "bid": 35 },
    { "name": "Dimarco", "role": "D", "bid": 30 },
    { "name": "Bastoni", "role": "D", "bid": 28 },
    { "name": "Di Lorenzo", "role": "D", "bid": 25 },
    { "name": "Calafiori", "role": "D", "bid": 22 },

    { "name": "Barella", "role": "C", "bid": 40 },
    { "name": "Tonali", "role": "C", "bid": 35 },
    { "name": "Koopmeiners", "role": "C", "bid": 32 },
    { "name": "Pellegrini", "role": "C", "bid": 28 },
    { "name": "Zaccagni", "role": "C", "bid": 25 },
    { "name": "Frattesi", "role": "C", "bid": 23 },

    { "name": "Lautaro Martinez", "role": "A", "bid": 45 },
    { "name": "Osimhen", "role": "A", "bid": 42 },
    { "name": "Vlahovic", "role": "A", "bid": 40 },
    { "name": "Chiesa", "role": "A", "bid": 35 },
    { "name": "Kvaratskhelia", "role": "A", "bid": 33 },
    { "name": "Leao", "role": "A", "bid": 30 }
];

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PLAYERS_LIST;
}
