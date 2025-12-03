import CryptoJS from 'crypto-js';

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_MASTER_KEY || 'default-dev-key-min-32-chars-long';
  return key;
}

export function encryptField(value) {
  if (!value) return value;
  const key = getEncryptionKey();
  const encrypted = CryptoJS.AES.encrypt(value, key).toString();
  return encrypted;
}

export function decryptField(value) {
  if (!value) return value;
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(value, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return value;
  }
}
