import { useState } from 'react';
import AppSidebar from '../AppSidebar';

const sampleContacts = [
  {
    id: '1',
    name: 'Alice Chen',
    lastMessage: 'The blockchain is synced!',
    timestamp: '2m',
    unreadCount: 3,
    isOnline: true,
  },
  {
    id: '2',
    name: 'Bob Smith',
    lastMessage: 'Thanks for the message',
    timestamp: '1h',
    isOnline: false,
  },
  {
    id: '3',
    name: 'Carol Johnson',
    lastMessage: 'See you tomorrow',
    timestamp: '3h',
    isOnline: true,
  },
];

export default function AppSidebarExample() {
  const [activeId, setActiveId] = useState('1');

  return (
    <div className="h-screen">
      <AppSidebar
        contacts={sampleContacts}
        activeContactId={activeId}
        onSelectContact={(id) => setActiveId(id)}
        onViewLedger={() => console.log('View ledger')}
      />
    </div>
  );
}
