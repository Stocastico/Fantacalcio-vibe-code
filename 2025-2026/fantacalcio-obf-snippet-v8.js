// Fantacalcio obfuscated roster (autopilota, v8) – ruoli Listone Gazzetta
// Passphrase canonica: "dammi un Braulio" (il decoder normalizza spazi)

export const OBF = "BueD+8FfsC3ZOorcIq9LSmWQDRmNoq2d16LwFFPBCl8U0IPHmG93hsGGpegbbhb+QuNVXJVVbVon1zopU88KTc2Yg+/JVm1F1pVw9ti6PUllkBsZb6izmSnR8PBTB1dpEI6br7AUdy0Bgaid8IFZCHuQT1iImGNy18IvNKH2S2we4MKvjBS9egt9ZrXYkP4IItBKWz1tcm0ylEnmn/ZVYs2mg9TBZr90wURm7SW4Qf46kCUZR1WjoRmKCPVlEhR4zdrC+sUUhS3vh7feHm4I/nLdTVw9bWN815TwJpr5Cjfcnd652xS5bAx9ZrXYnD1OaeFKGUdVs6chzfD+U9kKKc3OyvGCLHw7HES/nSStSUEiqAM7ipyoWuGKQDOd+go3zbCDuYJUtG/BUnWrM3hX/m7PTlw9bWOOFtQzNpq3FB8d283ygixtT8FEZt0fsP4WOOsNcj2hoqUaigjmi/ZYbQyOja/SYbdwwVJmv9h4/j5p0gMxU7Bts9fWLzGWtyIf7dHN+cFguoEAOnCdKLtIQSKoAzs9X2OaHszw/mLGZSkmjs/uzVdtRcFlp88luUVKYecDIz2lsKQaigjmdLcUHw3Vxa+aJoCIy5Nm6Re5Qf46kCxmiqOunR7WMzaktxQfHdvN8oIsbU7BRGbdH7D+FjKmXiOWVa+ZIs3w/lPbTW8S4dT8zhR3LRGHsODYhv4fIpoDWYSXY3LnmkvwrLdWXhjRg8eCQqx+AISt3th4/k5v2kYZVVWEWuGKMC2VtyIu5OmNCIJgrHgEOn6dA7dERXTPU3B8oWNk19o9MJa3Ih/ujo2vwluvLdlJfPjix/5KYdtGGVVVg6oa2zEtkgNRaxSOja/SYbdwwVJmvth4/j5p0gMxTGi+ZDCKPCWe+go3za7C+cRTuYUIOnCdKLtIQSKoAzo9X2OaHszw/mLIZSkmjs/uzVdtRcFhsOQZbgj+ct1NXD1tY3vXlPAmmvkKN9yc3rnbFLlsDH1mtdiYPVF0z1NmO4CiqikrezKWDwopzd7Q+cUUhS3gOnCdGLVA/jqnEXRHrmOmFtUz5mu3PGUg3sL6gh5tfQ6EqZ3wbh3+LJBDYH9Ve23l5fo/UwNJahCOm6+2XqxzDo6tPz1uCP5y3U1cPW1jedeU8Caa+Qo33qHeudsUuWwMfWa12J8/PW3PRFp8VW1aJ9c6KVPPCj7NmIPvyVZtRdFKwacxbko9bdMDMT2Cs6sk1DcymrcUHx3bzfKCLG1MwURm3R+w/hYxoV4jllWvmSLN8P5T70lgDs3I+8kUdy0Rh7Dg2Ib+HSKaA1mEl2Ny5ptLIQ==";

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
export async function unlockRoster(passphrase) {
  const pw = (passphrase || "").normalize("NFC").replace(/\s+/g, " ").trim();
  const key = await sha256Bytes(pw);
  const obf = b64ToBytes(OBF);
  const plain = deobfuscate(obf, key);
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text);
}
if (typeof window !== "undefined") {
  window.FantaOBF = { OBF, sha256Bytes, b64ToBytes, deobfuscate, unlockRoster };
}
