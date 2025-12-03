import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateChatRoomIds() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swapchat';
    await mongoose.connect(MONGODB_URI);
    console.log('✓ MongoDB connected');

    const allChats = await Chat.find({}).lean({ getters: true });
    console.log(`Found ${allChats.length} chat messages to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const chat of allChats) {
      try {
        const senderId = chat.senderId;
        const receiverId = chat.receiverId;
        
        if (!senderId || !receiverId) {
          console.log(`Skipping chat ${chat._id} - missing sender or receiver`);
          skipped++;
          continue;
        }

        const plainChatRoomId = [senderId, receiverId].sort().join('_');
        
        if (chat.chatRoomId === plainChatRoomId) {
          skipped++;
          continue;
        }

        await Chat.updateOne(
          { _id: chat._id },
          { $set: { chatRoomId: plainChatRoomId } }
        );
        
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`Progress: ${updated} messages updated, ${skipped} skipped`);
        }
      } catch (error) {
        console.error(`Error updating chat ${chat._id}:`, error.message);
      }
    }

    console.log('\n✓ Migration completed!');
    console.log(`  Updated: ${updated} messages`);
    console.log(`  Skipped: ${skipped} messages (already correct or invalid)`);
    console.log(`  Total: ${allChats.length} messages`);

    await mongoose.disconnect();
    console.log('✓ MongoDB disconnected');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateChatRoomIds();
