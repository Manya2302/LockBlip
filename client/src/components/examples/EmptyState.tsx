import EmptyState from '../EmptyState';
import emptyChat from '@assets/generated_images/Empty_chat_state_illustration_c6fb06b5.png';

export default function EmptyStateExample() {
  return (
    <div className="bg-background h-96">
      <EmptyState
        image={emptyChat}
        title="No messages yet"
        description="Start a conversation with end-to-end encrypted blockchain messaging"
      />
    </div>
  );
}
