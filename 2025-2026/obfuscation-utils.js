// Utility functions for obfuscating and deobfuscating player lists
// Use these functions to convert between cleartext and obfuscated formats

// Crypto utility functions
async function sha256Bytes(str) {
    const enc = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-256", enc);
    return new Uint8Array(hash);
}

function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

function bytesToB64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
}

function obfuscate(plain, key) {
    const out = new Uint8Array(plain.length);
    for (let i = 0; i < plain.length; i++) {
        out[i] = (plain[i] + key[i % key.length]) % 256;
    }
    return out;
}

function deobfuscate(obf, key) {
    const out = new Uint8Array(obf.length);
    for (let i = 0; i < obf.length; i++) {
        out[i] = (obf[i] - key[i % key.length] + 256) % 256;
    }
    return out;
}

// Main obfuscation function
async function obfuscatePlayerList(playerList, passphrase) {
    try {
        const key = await sha256Bytes(passphrase);
        const text = JSON.stringify(playerList);
        const plain = new TextEncoder().encode(text);
        const obf = obfuscate(plain, key);
        const b64 = bytesToB64(obf);
        return b64;
    } catch (error) {
        console.error("Error obfuscating player list:", error);
        throw error;
    }
}

// Main deobfuscation function
async function deobfuscatePlayerList(obfuscatedB64, passphrase) {
    try {
        const key = await sha256Bytes(passphrase);
        const obf = b64ToBytes(obfuscatedB64);
        const plain = deobfuscate(obf, key);
        const text = new TextDecoder().decode(plain);
        const parsed = JSON.parse(text);
        return parsed;
    } catch (error) {
        console.error("Error deobfuscating player list:", error);
        throw error;
    }
}

// Example usage functions
async function generateObfuscatedString(playerList, passphrase) {
    console.log("🔒 Generating obfuscated string...");
    console.log("Player list length:", playerList.length);
    console.log("Passphrase:", passphrase ? "***" : "NOT PROVIDED");

    const obfuscated = await obfuscatePlayerList(playerList, passphrase);

    console.log("✅ Obfuscated string generated!");
    console.log("Length:", obfuscated.length);
    console.log("\n📋 Copy this string to your players.js file (OBF constant):");
    console.log('const OBF = "' + obfuscated + '";');

    return obfuscated;
}

async function testDeobfuscation(obfuscatedB64, passphrase) {
    console.log("🔓 Testing deobfuscation...");

    try {
        const playerList = await deobfuscatePlayerList(obfuscatedB64, passphrase);
        console.log("✅ Deobfuscation successful!");
        console.log("Players found:", playerList.length);
        console.log("First few players:", playerList.slice(0, 3));
        return playerList;
    } catch (error) {
        console.log("❌ Deobfuscation failed:", error.message);
        throw error;
    }
}

// Browser console helpers
if (typeof window !== 'undefined') {
    // Make functions available in browser console
    window.obfuscatePlayerList = obfuscatePlayerList;
    window.deobfuscatePlayerList = deobfuscatePlayerList;
    window.generateObfuscatedString = generateObfuscatedString;
    window.testDeobfuscation = testDeobfuscation;

    console.log("🛠️  Obfuscation utilities loaded!");
    console.log("Available functions:");
    console.log("- obfuscatePlayerList(playerList, passphrase)");
    console.log("- deobfuscatePlayerList(obfuscatedB64, passphrase)");
    console.log("- generateObfuscatedString(playerList, passphrase)");
    console.log("- testDeobfuscation(obfuscatedB64, passphrase)");
}

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        obfuscatePlayerList,
        deobfuscatePlayerList,
        generateObfuscatedString,
        testDeobfuscation,
        sha256Bytes,
        b64ToBytes,
        bytesToB64,
        obfuscate,
        deobfuscate
    };
}
