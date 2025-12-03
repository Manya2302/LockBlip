import MessageBubble from '../MessageBubble';

export default function MessageBubbleExample() {
  return (
    <div className="p-6 space-y-2 bg-background max-w-2xl">
      <MessageBubble
        content="Hey! How does blockchain messaging work?"
        timestamp="10:30 AM"
        isSender={false}
        blockNumber={42}
        isEncrypted={true}
      />
      <MessageBubble
        content="Each message becomes a block in the chain, cryptographically linked to the previous one. It's tamper-proof!"
        timestamp="10:31 AM"
        isSender={true}
        blockNumber={43}
        isDelivered={true}
        isRead={true}
      />
      <MessageBubble
        content="That's amazing! So nobody can modify past messages?"
        timestamp="10:32 AM"
        isSender={false}
        blockNumber={44}
      />
    </div>
  );
}
