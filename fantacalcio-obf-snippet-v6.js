// Fantacalcio obfuscated roster (autopilota)
// Passphrase canonica: "dammi un Braulio" (ma puoi normalizzare spazi come vuoi nel decoder)
// Questo è un ESM (module). Funziona anche via window.FantaOBF se non usi moduli.

export const OBF = "BueD+8FfsC3ZOorcIq9LSmWQDRmNoq2d16LwFFPBCl8U0IPHmG93hsGGpegbbhb+QuNVXJVVbVon1zopU88KTc2Yg+/JVm1F1pVw9ti6PUllkBsZb6izmSnR8PBTB1dpEI6br7AUdy0Bgaid8IFZCHuQT1iImGNy18IvNKH2S2we4MKvjBS9egt9ZrXYkP4IItBKWz1tcm0ylEnmn/ZVYs2mg9TBZr90wURm7SW4Qf46kCUZR1WjoRmKCPVlEhR4zdrC+sUUhS3vh7feHm4I/nLdTVw9bWN815TwJpr5Cjfcnt652xS5bAx9ZrXYnD1OaeFKGUdVs6chzfD+U9kKKc3OyvGCLHw7HES/nSStSUEiqAM7ipyoWuGKQDOd+go3zbCDuYJUtG/BUnWsM3hX/m7PTlw9bWOOFtQzNpq3FB8d283ygixtT8FEZt0fsP4WOOsNcj2hoqUaigjmi/ZYbQyOja/SYbdwwVJmv9h4/j5p0gMxU7Bts9fWLzGWtyIf7dHN+cFguoEAOnCdKLtIQSKoAzs9X2OaHszw/mLHZSkmjs/uzVdtRcFlp88luUVKYecDIz2lsKQaigjmdLcUHw3Vxa+aJ3uIy5Nm6Re5Qf46kCdpfKe1nSjR8PBTB1dpEI6br6MUdy0Bgaid8H4TWSzpA2V8oKZa74oUKaP8XXAa2oO5gmS6dwQ6fp35bgj+YtdFGVVlc7Xh4/AykgJNH+WOse7TU7d0AjpwnSi7SEEiqAM6PV9jmh7M8P5jxWUpJo7P7s1XbUXBZa/jH8A9TnnPTxlHVbOnIc3w/lPYCinNzsrxgix8QxxEv50krUlBIqgDOY2YtJseyTwtn/4KKc3e0PnFFIUt4jpwnRi1QP46nxZ0R65jphbVM+ZrtypeF9DC+9pbbTfBirPnG24W/kOQDRl9nKVa75kBQV0QCmsM2cavmhSUdwh7ZqfYvktIZZAbGV5VbVoX0TLma8YYetfng/vBX7At2TqQ3CvAPU5vji5YjacE5SPNSOZdt1psF9GDx4IzbTfBeq3f2IYUEX2aXBmJlK6d16LwCKr3SWkMjo2v0mG3cMFSZrzYeP4+adIDMU9ovmQwijwlnvoKN8270fLOVqwtyzq26iKx/hYirwMjPZWqnNeiAvSuwWMfGc3O8oIsbV4CebHcGa89/iyQU2aHmGNy16nw8FP3UWHNppPC3R7GLQ15seDYhv42YdFEWIKhqlrhikAznfoKN82tg7mCVLRvwVJ1rTN4V/5uz05cPW1jhCreQzGTBAopzd7Q+cUUhS3gOnCdGLVA/jqmXlQ=";

// Helpers (browser, WebCrypto)
export async function sha256Bytes(str) {
  const enc = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return new Uint8Array(hash);
}
export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function deobfuscate(obfBytes, keyBytes) {
  const out = new Uint8Array(obfBytes.length);
  for (let i=0;i<obfBytes.length;i++) out[i] = (obfBytes[i] - keyBytes[i % keyBytes.length] + 256) % 256;
  return out;
}

// Decoder: normalizza la passphrase (trim + comprime spazi multipli) e restituisce l'array dei giocatori
export async function unlockRoster(passphrase) {
  const pw = (passphrase || "").normalize("NFC").replace(/\s+/g, " ").trim();
  const key = await sha256Bytes(pw);
  const obf = b64ToBytes(OBF);
  const plain = deobfuscate(obf, key);
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text);
}

// UMD-style fallback per uso globale senza import
if (typeof window !== "undefined") {
  window.FantaOBF = { OBF, sha256Bytes, b64ToBytes, deobfuscate, unlockRoster };
}
