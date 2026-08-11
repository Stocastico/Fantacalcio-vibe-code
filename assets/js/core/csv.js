/** Generazione ed export CSV. La parte di download esiste solo nel browser. */
;(function (global) {
    'use strict';

    /**
     * Righe -> testo CSV. Tutti i campi vengono quotati e le virgolette
     * raddoppiate, così nomi con virgole o accenti non rompono il file.
     * Il BOM lo aggiunge `download()`, serve a Excel per leggere gli accenti.
     */
    function toCSV(rows) {
        return rows
            .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\r\n');
    }

    /** Nome file con la data di oggi, es. acquisti_2026-08-11.csv */
    function stampedName(prefix) {
        return `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    /** Scarica il CSV. No-op fuori dal browser. */
    function download(filename, csvText) {
        if (typeof document === 'undefined') return false;
        const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }

    const api = { toCSV, stampedName, download };

    global.FC = global.FC || {};
    global.FC.csv = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
