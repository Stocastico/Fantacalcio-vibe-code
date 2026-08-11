const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, memoryBackend } = require('../assets/js/core/storage.js');

test('salva e rilegge lo stato', () => {
    const store = createStore('k', { version: 1, backend: memoryBackend() });
    assert.ok(store.available);
    assert.ok(store.save({ a: 1 }));
    assert.deepEqual(store.load(), { a: 1 });
});

test('uno stato di una versione diversa viene ignorato', () => {
    const backend = memoryBackend();
    createStore('k', { version: 1, backend }).save({ a: 1 });
    assert.equal(createStore('k', { version: 2, backend }).load(), null);
});

test('JSON corrotto non fa esplodere il caricamento', () => {
    const backend = memoryBackend();
    backend.setItem('k', 'questo non è json');
    assert.equal(createStore('k', { version: 1, backend }).load(), null);
});

test('chiave assente restituisce null', () => {
    assert.equal(createStore('mai-scritta', { version: 1, backend: memoryBackend() }).load(), null);
});

test('clear cancella davvero', () => {
    const store = createStore('k', { version: 1, backend: memoryBackend() });
    store.save({ a: 1 });
    store.clear();
    assert.equal(store.load(), null);
});

test('senza backend tutto degrada senza errori', () => {
    const store = createStore('k', { version: 1, backend: null });
    assert.equal(store.available, false);
    assert.equal(store.save({ a: 1 }), false);
    assert.equal(store.load(), null);
    assert.equal(store.clear(), false);
});

test('un backend che rifiuta le scritture non blocca l app', () => {
    const rotto = {
        getItem: () => null,
        setItem: () => { throw new Error('quota superata'); },
        removeItem: () => { },
    };
    const store = createStore('k', { version: 1, backend: rotto });
    assert.equal(store.save({ a: 1 }), false);
});
