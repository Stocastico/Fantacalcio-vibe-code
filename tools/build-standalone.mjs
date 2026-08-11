#!/usr/bin/env node
/**
 * Genera le versioni single-file delle due pagine.
 *
 * Perché esiste: nella stagione 2025/26 i file "standalone" erano copie fatte a
 * mano, e ogni correzione andava riportata due volte. Puntualmente si
 * disallineavano. Ora si generano, così esiste una sola copia del codice vero.
 *
 *   npm run build
 *
 * Da rilanciare ogni volta che tocchi HTML, CSS, JS o la lista giocatori.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
    { src: 'index.html', out: 'index-standalone.html' },
    { src: 'market-auction.html', out: 'market-auction-standalone.html' },
];

/** I link fra le due pagine devono puntare alle rispettive versioni standalone. */
const RENAME = new Map(TARGETS.map(t => [t.src, t.out]));

const LINK_RE = /[ \t]*<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>[ \t]*\r?\n?/gi;
const SCRIPT_RE = /[ \t]*<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>[ \t]*\r?\n?/gi;
const STRIP_RE = /[ \t]*<!--\s*standalone:strip:start\s*-->[\s\S]*?<!--\s*standalone:strip:end\s*-->[ \t]*\r?\n?/gi;

const BANNER = `<!--
    ⚠️  FILE GENERATO — non modificarlo a mano.
    Sorgenti: index.html / market-auction.html + assets/
    Rigenera con: npm run build
-->
`;

/** Come String.replace ma con un sostituto asincrono (dobbiamo leggere file). */
async function replaceAsync(input, regex, replacer) {
    const matches = [...input.matchAll(regex)];
    const replacements = await Promise.all(matches.map(m => replacer(m)));
    let out = '';
    let last = 0;
    matches.forEach((m, i) => {
        out += input.slice(last, m.index) + replacements[i];
        last = m.index + m[0].length;
    });
    return out + input.slice(last);
}

async function readAsset(relPath, usedBy) {
    try {
        return await readFile(resolve(root, relPath), 'utf8');
    } catch (err) {
        throw new Error(`${usedBy}: non trovo l'asset "${relPath}" (${err.code || err.message})`);
    }
}

async function build({ src, out }) {
    let html = await readFile(resolve(root, src), 'utf8');

    html = html.replace(STRIP_RE, '');

    html = await replaceAsync(html, LINK_RE, async (m) => {
        const css = await readAsset(m[1], src);
        return `    <style>\n${indent(css.trimEnd(), 8)}\n    </style>\n`;
    });

    html = await replaceAsync(html, SCRIPT_RE, async (m) => {
        const js = await readAsset(m[1], src);
        // Un "</script>" dentro una stringa chiuderebbe il tag e romperebbe la pagina.
        if (/<\/script/i.test(js)) {
            throw new Error(`${m[1]} contiene "</script>": non è inlinabile così com'è.`);
        }
        return `    <script>\n${indent(js.trimEnd(), 8)}\n    </script>\n`;
    });

    for (const [from, to] of RENAME) {
        html = html.replaceAll(`href="${from}"`, `href="${to}"`);
    }

    html = html.replace(/^<!doctype html>\r?\n/i, (m) => m + BANNER);

    await writeFile(resolve(root, out), html, 'utf8');
    return { out, bytes: Buffer.byteLength(html, 'utf8') };
}

function indent(textBlock, spaces) {
    const pad = ' '.repeat(spaces);
    return textBlock.split('\n').map(line => (line.trim() ? pad + line : line)).join('\n');
}

const results = [];
for (const target of TARGETS) {
    results.push(await build(target));
}
for (const r of results) {
    console.log(`✅ ${r.out} (${(r.bytes / 1024).toFixed(1)} kB)`);
}
