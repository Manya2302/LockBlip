import crypto from 'crypto';
import Block from '../models/Blockchain.js';

export function calculateHash(index, timestamp, from, to, payload, prevHash) {
  const data = `${index}${timestamp}${from}${to}${payload}${prevHash}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function initializeBlockchain() {
  const existingBlocks = await Block.countDocuments();
  
  if (existingBlocks === 0) {
    const timestamp = new Date().toISOString();
    const hash = calculateHash(0, timestamp, 'system', 'all', 'Genesis Block', '0');
    
    const genesisBlock = new Block({
      index: 0,
      timestamp,
      from: 'system',
      to: 'all',
      payload: 'Genesis Block',
      prevHash: '0',
      hash,
    });
    
    await genesisBlock.save();
    console.log('Genesis block created');
  }
}

export async function getLatestBlock() {
  const block = await Block.findOne().sort({ index: -1 });
  return block;
}

export async function addMessageBlock(from, to, payload) {
  const prevBlock = await getLatestBlock();
  const index = prevBlock.index + 1;
  const timestamp = new Date().toISOString();
  const prevHash = prevBlock.hash;
  const hash = calculateHash(index, timestamp, from, to, payload, prevHash);

  const block = new Block({
    index,
    timestamp,
    from,
    to,
    payload,
    prevHash,
    hash,
  });

  await block.save();
  return block;
}

export async function getBlockchain() {
  return await Block.find().sort({ index: 1 });
}

export async function getUserBlockchain(username) {
  const blocks = await Block.find({
    $or: [
      { from: username },
      { to: username },
      { from: 'system' }
    ]
  }).sort({ index: 1 });
  
  return blocks;
}

export async function validateChain() {
  const chain = await getBlockchain();
  
  for (let i = 1; i < chain.length; i++) {
    const block = chain[i];
    const prev = chain[i - 1];
    
    if (block.prevHash !== prev.hash) {
      return { valid: false, error: `Block ${i} prevHash mismatch` };
    }
    
    const calculatedHash = calculateHash(
      block.index,
      block.timestamp,
      block.from,
      block.to,
      block.payload,
      block.prevHash
    );
    
    if (block.hash !== calculatedHash) {
      return { valid: false, error: `Block ${i} hash invalid` };
    }
  }
  
  return { valid: true };
}
