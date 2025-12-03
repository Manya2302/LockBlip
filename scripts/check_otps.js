import dotenv from 'dotenv';
import mongoose from 'mongoose';
import OTP from '../server/models/OTP.js';
import { decryptField } from '../server/lib/encryption.js';

dotenv.config();

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swapchat';
  await mongoose.connect(MONGODB_URI, { dbName: undefined });

  const targetEmail = process.argv[2] || 'parikhgaming@gmail.com';
  console.log(`Checking OTP records for: ${targetEmail}`);

  // Fetch recent OTP documents (limit to 100 to be safe)
  const docs = await OTP.find({}).sort({ createdAt: -1 }).limit(100).lean();

  const matching = docs.filter(d => {
    try {
      const dec = decryptField(d.email);
      return dec && dec.toString().trim().toLowerCase() === targetEmail.trim().toLowerCase();
    } catch (e) {
      return false;
    }
  });

  console.log(`Total OTP docs scanned: ${docs.length}`);
  console.log(`Matching OTP docs for ${targetEmail}: ${matching.length}`);

  if (matching.length === 0) {
    console.log('No matching OTP records found.');
  } else {
    for (const d of matching) {
      console.log('---');
      console.log(`id: ${d._id}`);
      console.log(`verified: ${d.verified}`);
      console.log(`createdAt: ${d.createdAt}`);
      console.log(`expiresAt: ${d.expiresAt}`);
      // Intentionally do NOT print the otp value
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error checking OTPs:', err);
  process.exit(1);
});
