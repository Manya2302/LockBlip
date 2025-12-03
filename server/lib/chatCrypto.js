import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import ChatKeyPair from '../models/ChatKeyPair.js';

export function generateChatKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
  };
}

export async function getChatKeys(chatRoomId) {
  let chatKeys = await ChatKeyPair.findOne({ chatRoomId });
  
  if (!chatKeys) {
    const newKeys = generateChatKeyPair();
    chatKeys = await ChatKeyPair.create({
      chatRoomId,
      publicKey: newKeys.publicKey,
      privateKey: newKeys.privateKey,
    });
  }
  
  return {
    publicKey: chatKeys.publicKey,
    privateKey: chatKeys.privateKey,
  };
}

export function deriveSharedSecret(chatPrivateKey) {
  const privateKeyUint8 = naclUtil.decodeBase64(chatPrivateKey);
  return privateKeyUint8.slice(0, nacl.secretbox.keyLength);
}

export function encryptWithChatKey(message, chatPublicKey, chatPrivateKey) {
  try {
    const sharedSecret = deriveSharedSecret(chatPrivateKey);
    const messageUint8 = naclUtil.decodeUTF8(message);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    
    const encrypted = nacl.secretbox(messageUint8, nonce, sharedSecret);
    
    return JSON.stringify({
      nonce: naclUtil.encodeBase64(nonce),
      ciphertext: naclUtil.encodeBase64(encrypted),
    });
  } catch (error) {
    console.error('Chat encryption error:', error);
    throw error;
  }
}

export function decryptWithChatKey(encryptedPayload, chatPublicKey, chatPrivateKey) {
  try {
    const sharedSecret = deriveSharedSecret(chatPrivateKey);
    const payload = JSON.parse(encryptedPayload);
    const nonce = naclUtil.decodeBase64(payload.nonce);
    const ciphertext = naclUtil.decodeBase64(payload.ciphertext);
    
    const decrypted = nacl.secretbox.open(ciphertext, nonce, sharedSecret);
    
    if (!decrypted) {
      throw new Error('Decryption failed');
    }
    
    return naclUtil.encodeUTF8(decrypted);
  } catch (error) {
    console.error('Chat decryption error:', error);
    throw error;
  }
}

export function serverEncrypt(data) {
  const key = process.env.ENCRYPTION_MASTER_KEY || 'default-dev-key-min-32-chars-long';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return JSON.stringify({
    iv: iv.toString('base64'),
    data: encrypted,
  });
}

export function serverDecrypt(encryptedPayload) {
  const key = process.env.ENCRYPTION_MASTER_KEY || 'default-dev-key-min-32-chars-long';
  const payload = JSON.parse(encryptedPayload);
  const iv = Buffer.from(payload.iv, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
  
  let decrypted = decipher.update(payload.data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function calculateMessageHash(chatRoomId, senderId, receiverId, messageType, encryptedMessage, timestamp, previousHash) {
  const data = `${chatRoomId}${senderId}${receiverId}${messageType}${encryptedMessage}${timestamp}${previousHash}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function getPreviousMessageHash(chatRoomId) {
  const Chat = (await import('../models/Chat.js')).default;
  const lastMessage = await Chat.findOne({ chatRoomId }).sort({ timestamp: -1, _id: -1 });
  return lastMessage?.hash || '0';
}

export async function encryptMessageWithChatKeys(message, chatRoomId) {
  const chatKeys = await getChatKeys(chatRoomId);
  
  const chatEncrypted = encryptWithChatKey(message, chatKeys.publicKey, chatKeys.privateKey);
  
  const serverEncrypted = serverEncrypt(chatEncrypted);
  
  return {
    encryptedMessage: serverEncrypted,
    chatPublicKey: chatKeys.publicKey,
    chatPrivateKey: chatKeys.privateKey,
  };
}

export async function decryptMessageWithChatKeys(encryptedMessage, chatPublicKey, chatPrivateKey) {
  const chatEncrypted = serverDecrypt(encryptedMessage);
  
  const originalMessage = decryptWithChatKey(chatEncrypted, chatPublicKey, chatPrivateKey);
  
  return originalMessage;
}
