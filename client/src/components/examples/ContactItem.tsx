import { useState } from 'react';
import ContactItem from '../ContactItem';

export default function ContactItemExample() {
  const [active, setActive] = useState('alice');

  return (
    <div className="p-4 bg-sidebar space-y-2 max-w-sm">
      <ContactItem
        name="Alice Chen"
        lastMessage="The blockchain is synced!"
        timestamp="2m"
        unreadCount={3}
        isOnline={true}
        isActive={active === 'alice'}
        onClick={() => setActive('alice')}
      />
      <ContactItem
        name="Bob Smith"
        lastMessage="Thanks for the encrypted message"
        timestamp="1h"
        isOnline={false}
        isActive={active === 'bob'}
        onClick={() => setActive('bob')}
      />
      <ContactItem
        name="Carol Johnson"
        isOnline={true}
        isActive={active === 'carol'}
        onClick={() => setActive('carol')}
      />
    </div>
  );
}
