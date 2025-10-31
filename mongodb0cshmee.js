import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { calculateHash } from './server/lib/blockchain.js';
import { encryptField } from './server/lib/encryption.js';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment. Aborting.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { dbName: new URL(uri).pathname.replace('/', '') || undefined });
  const db = mongoose.connection.db;

  console.log('Connected. Ensuring collections and indexes...');

  // Ensure collections exist
  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);

  if (!names.includes('blocks')) {
    await db.createCollection('blocks');
    console.log('Created collection: blocks');
  }
  if (!names.includes('users')) {
    await db.createCollection('users');
    console.log('Created collection: users');
  }
  if (!names.includes('otps')) {
    await db.createCollection('otps');
    console.log('Created collection: otps');
  }
  if (!names.includes('ipauthorizations')) {
    await db.createCollection('ipauthorizations');
    console.log('Created collection: ipauthorizations');
  }

  // Indexes for blocks
  try {
    await db.collection('blocks').createIndex({ hash: 1 }, { unique: true });
    await db.collection('blocks').createIndex({ index: 1 });
    console.log('Ensured indexes on blocks');
  } catch (err) {
    console.warn('Error creating block indexes (maybe already exist):', err.message);
  }

  // Create genesis block if none
  const blockCount = await db.collection('blocks').countDocuments();
  if (blockCount === 0) {
    const timestamp = new Date().toISOString();
    const hash = calculateHash(0, timestamp, 'system', 'all', 'Genesis Block', '0');
    const genesis = {
      index: 0,
      timestamp,
      from: encryptField('system'),
      to: encryptField('all'),
      payload: encryptField('Genesis Block'),
      prevHash: '0',
      hash,
      createdAt: new Date()
    };
    await db.collection('blocks').insertOne(genesis);
    console.log('Inserted genesis block');
  } else {
    console.log('Blocks collection already has documents:', blockCount);
  }

  // Create a sample admin user if none
  const userCount = await db.collection('users').countDocuments();
  if (userCount === 0) {
    const passwordPlain = 'ChangeMe123!';
    const hashed = await bcrypt.hash(passwordPlain, 12);
    const admin = {
      username: 'admin',
      email: encryptField('admin@example.com'),
      phone: encryptField('+10000000000'),
      fullName: encryptField('Admin User'),
      dateOfBirth: encryptField('1990-01-01'),
      password: hashed,
      publicKey: '',
      privateKey: encryptField(''),
      authorizedIPs: [],
      isVerified: true,
      createdAt: new Date()
    };
    await db.collection('users').insertOne(admin);
    console.log('Inserted sample admin user (username: admin, password: ChangeMe123!)');
  } else {
    console.log('Users collection already has documents:', userCount);
  }

  // Create a test OTP for admin@example.com with long expiry
  const otpEmail = 'admin@example.com';
  const otpValue = '999999';
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await db.collection('otps').insertOne({
    email: encryptField(otpEmail),
    otp: otpValue,
    expiresAt,
    verified: false,
    createdAt: new Date()
  });
  console.log(`Inserted test OTP for ${otpEmail} (value: ${otpValue}, expires in 1 hour)`);

  // Print counts
  const counts = {
    blocks: await db.collection('blocks').countDocuments(),
    users: await db.collection('users').countDocuments(),
    otps: await db.collection('otps').countDocuments(),
    ipauthorizations: await db.collection('ipauthorizations').countDocuments()
  };
  console.log('Collection counts:', counts);

  await mongoose.disconnect();
  console.log('Done. Disconnected.');
}

main().catch(err => {
  console.error('Error running mongodb0cshmee.js:', err);
  process.exit(1);
});
