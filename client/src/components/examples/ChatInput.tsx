import { useState } from 'react';
import ChatInput from '../ChatInput';

export default function ChatInputExample() {
  const [messages, setMessages] = useState<string[]>([]);

  return (
    <div className="bg-background h-64 flex flex-col">
      <div className="flex-1 p-4 overflow-auto">
        {messages.map((msg, idx) => (
          <div key={idx} className="mb-2 text-sm">
            {msg}
          </div>
        ))}
      </div>
      <ChatInput
        onSendMessage={(msg) => {
          console.log('Sending:', msg);
          setMessages([...messages, msg]);
        }}
      />
    </div>
  );
}
