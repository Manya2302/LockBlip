import mongoose from 'mongoose';
import { decryptField } from '../lib/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

async function decryptChatFields() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swapchat';
    await mongoose.connect(MONGODB_URI);
    console.log('✓ MongoDB connected');

    const chatCollection = mongoose.connection.collection('chats');
    const allChats = await chatCollection.find({}).toArray();
    console.log(`Found ${allChats.length} chat messages to migrate`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const chat of allChats) {
      try {
        const needsUpdate = 
          (chat.senderId && chat.senderId.startsWith('U2FsdGVkX1')) ||
          (chat.receiverId && chat.receiverId.startsWith('U2FsdGVkX1')) ||
          (chat.encryptedMessage && chat.encryptedMessage.startsWith('U2FsdGVkX1'));
        
        if (!needsUpdate) {
          skipped++;
          continue;
        }

        const updates = {};
        
        if (chat.senderId && chat.senderId.startsWith('U2FsdGVkX1')) {
          updates.senderId = decryptField(chat.senderId);
          console.log(`  Decrypting senderId: ${chat.senderId.substring(0, 20)}... → ${updates.senderId}`);
        }
        
        if (chat.receiverId && chat.receiverId.startsWith('U2FsdGVkX1')) {
          updates.receiverId = decryptField(chat.receiverId);
          console.log(`  Decrypting receiverId: ${chat.receiverId.substring(0, 20)}... → ${updates.receiverId}`);
        }
        
        if (chat.encryptedMessage && chat.encryptedMessage.startsWith('U2FsdGVkX1')) {
          updates.encryptedMessage = decryptField(chat.encryptedMessage);
          console.log(`  Decrypting message: ${chat.encryptedMessage.substring(0, 20)}...`);
        }

        if (Object.keys(updates).length > 0) {
          await chatCollection.updateOne(
            { _id: chat._id },
            { $set: updates }
          );
          updated++;
          
          if (updated % 10 === 0) {
            console.log(`Progress: ${updated} messages updated, ${skipped} skipped, ${errors} errors`);
          }
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error updating chat ${chat._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n✓ Migration completed!');
    console.log(`  Updated: ${updated} messages`);
    console.log(`  Skipped: ${skipped} messages (already decrypted)`);
    console.log(`  Errors: ${errors} messages`);
    console.log(`  Total: ${allChats.length} messages`);

    await mongoose.disconnect();
    console.log('✓ MongoDB disconnected');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

decryptChatFields();
