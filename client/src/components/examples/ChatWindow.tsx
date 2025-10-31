import { useState } from 'react';
import ChatWindow from '../ChatWindow';

export default function ChatWindowExample() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      content: 'Hey! How are you?',
      timestamp: '10:30 AM',
      isSender: false,
      blockNumber: 42,
    },
    {
      id: '2',
      content: "I'm great! Just testing the blockchain messaging system.",
      timestamp: '10:31 AM',
      isSender: true,
      blockNumber: 43,
      isDelivered: true,
      isRead: true,
    },
  ]);

  return (
    <div className="h-screen bg-background">
      <ChatWindow
        contactName="Alice Chen"
        messages={messages}
        blockCount={43}
        onSendMessage={(msg) => {
          const newMessage = {
            id: String(messages.length + 1),
            content: msg,
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            isSender: true,
            blockNumber: 43 + messages.length,
            isDelivered: true,
            isRead: false,
          };
          setMessages([...messages, newMessage]);
        }}
      />
    </div>
  );
}
