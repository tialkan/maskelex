// packages/core-engine/src/vault/crypto.ts
// Kasanın parolalı şifreli dışa/içe aktarımı: PBKDF2-SHA256 (600.000 tur) + AES-256-GCM, ek doğrulanmış veri ile.
// Yalnız Web Crypto kullanılır; anahtar dışa aktarılamaz (extractable=false).

import type { EncryptedVaultFile, MaskelexError } from '../types/contracts';

const AAD = new TextEncoder().encode('maskelex-kasa-v1');
const MIN_ITERATIONS = 600_000;
const err = (message: string): MaskelexError => ({ code: 'E_CRYPTO', message });

const toB64 = (u: Uint8Array): string => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: 'encrypt' | 'decrypt'): ReturnType<typeof crypto.subtle.deriveKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

/** serialized: kasanın JSON baytları. Çağrıdan sonra sıfırlanır. */
export async function encryptVault(serialized: Uint8Array<ArrayBuffer>, passphrase: string): Promise<EncryptedVaultFile> {
  if (passphrase.length < 12) throw err('Parola en az 12 karakter olmalı.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, MIN_ITERATIONS, 'encrypt');
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, serialized));
  serialized.fill(0);
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: MIN_ITERATIONS, salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ct) };
}

export async function decryptVault(file: EncryptedVaultFile, passphrase: string): Promise<Uint8Array> {
  if (file.v !== 1 || file.kdf !== 'PBKDF2-SHA256') throw err('Desteklenmeyen kasa dosyası.');
  if (!Number.isInteger(file.iterations) || file.iterations < MIN_ITERATIONS) throw err('Kasa dosyası güvenlik koşullarını sağlamıyor.');
  const key = await deriveKey(passphrase, fromB64(file.salt), file.iterations, 'decrypt');
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv), additionalData: AAD }, key, fromB64(file.ciphertext)));
  } catch {
    throw err('Parola hatalı ya da dosya bozuk.');
  }
}
