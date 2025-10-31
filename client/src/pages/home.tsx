import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { io, Socket } from "socket.io-client";
import AppSidebar from "@/components/AppSidebar";
import ChatWindow from "@/components/ChatWindow";
import LedgerViewer from "@/components/LedgerViewer";
import Stories from "@/components/Stories";
import ProfileManagement from "@/pages/profile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import naclUtil from "tweetnacl-util";
import nacl from "tweetnacl";

interface HomeProps {
  onLogout: () => void;
}

interface Contact {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  isOnline?: boolean;
  lastMessageTime?: string;
  fullName?: string;
  phone?: string;
  profileImage?: string;
  description?: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isSender: boolean;
  encryptedPayload?: string;
  blockNumber?: number;
  status?: 'sent' | 'delivered' | 'seen';
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'poll';
  mediaUrl?: string;
  metadata?: any;
}

interface Block {
  index: number;
  hash: string;
  prevHash: string;
  timestamp: string;
  from: string;
  to: string;
  payload: string;
}

export default function Home({ onLogout }: HomeProps) {
  const [activeView, setActiveView] = useState<"chat" | "ledger" | "profile">("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeContactId, setActiveContactId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const tempMessageMapRef = useRef<Map<string, { timestamp: number, content: string }>>(new Map());
  const activeContactNameRef = useRef<string | undefined>();

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const previousUserIdRef = useRef<string>(user.id);
  
  useEffect(() => {
    const handleStorageChange = () => {
      const newUser = JSON.parse(localStorage.getItem('user') || '{}');
      const newToken = localStorage.getItem('token');
      
      if (newUser.id !== previousUserIdRef.current) {
        console.log('🔄 User changed! Resetting application state...');
        console.log('Previous user ID:', previousUserIdRef.current);
        console.log('New user ID:', newUser.id);
        
        previousUserIdRef.current = newUser.id;
        
        setMessages([]);
        setActiveContactId(undefined);
        setCurrentPage(1);
        setHasMore(false);
        setOnlineUsers(new Set());
        tempMessageMapRef.current.clear();
        
        if (socketRef.current) {
          console.log('Disconnecting old socket...');
          socketRef.current.disconnect();
          socketRef.current.removeAllListeners();
          socketRef.current = null;
        }
        
        queryClient.invalidateQueries();
        console.log('✅ All queries invalidated - fresh data will be fetched for new user');
      }
      
      setUser(newUser);
      setToken(newToken);
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentToken = localStorage.getItem('token');
      
      if (currentUser.id !== previousUserIdRef.current) {
        console.log('🔄 User changed detected via polling! Resetting application state...');
        console.log('Previous user ID:', previousUserIdRef.current);
        console.log('New user ID:', currentUser.id);
        
        previousUserIdRef.current = currentUser.id;
        
        setMessages([]);
        setActiveContactId(undefined);
        setCurrentPage(1);
        setHasMore(false);
        setOnlineUsers(new Set());
        tempMessageMapRef.current.clear();
        
        if (socketRef.current) {
          console.log('Disconnecting old socket...');
          socketRef.current.disconnect();
          socketRef.current.removeAllListeners();
          socketRef.current = null;
        }
        
        queryClient.invalidateQueries();
        console.log('✅ All queries invalidated - fresh data will be fetched for new user');
        
        setUser(currentUser);
        setToken(currentToken);
      } else if (JSON.stringify(currentUser) !== JSON.stringify(user) || currentToken !== token) {
        setUser(currentUser);
        setToken(currentToken);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user, token]);

  interface UserProfile {
    profileImage?: string;
  }

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['/api/users/profile'],
    enabled: !!token,
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ['/api/users/contacts'],
    enabled: !!token,
  });

  const { data: blockchain = [], refetch: refetchBlockchain } = useQuery<Block[]>({
    queryKey: ['/api/blockchain/ledger'],
    enabled: !!token,
  });

  useEffect(() => {
    if (!token) return;

    const socket = io({
      auth: { token },
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on('connected', (data) => {
      console.log('Connected to chat:', data);
    });

    socket.on('receive-message', async (data) => {
      const { from, block, messageId, messageType = 'text', mediaUrl, metadata, encryptedMessage, chatPublicKey, chatPrivateKey } = data;
      
      try {
        const decryptedContent = await decryptMessageWithChatKeys(encryptedMessage, chatPublicKey, chatPrivateKey);
        const newMessage: Message = {
          id: messageId,
          content: decryptedContent,
          timestamp: new Date(block.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSender: false,
          blockNumber: block.index,
          status: 'delivered',
          messageType,
          metadata,
          mediaUrl,
        };

        setMessages((prev) => [...prev, newMessage]);
        refetchBlockchain();
        
        const senderContact = contacts.find(c => c.name === from);
        if (activeContactId === senderContact?.id && activeView === 'chat') {
          socket.emit('message-seen', { messageId, from });
          try {
            refetchContacts();
            console.log('🔁 Refetched contacts after marking single message seen');
          } catch (err) {
            console.warn('Failed to refetch contacts after marking single message seen', err);
          }
        }
      } catch (error) {
        console.error('Failed to decrypt message:', error);
      }
    });

    socket.on('message-sent', (data) => {
      console.log('Message sent confirmation:', data);
      
      const tempEntry = Array.from(tempMessageMapRef.current.entries())
        .find(([_, val]) => Math.abs(val.timestamp - new Date(data.timestamp).getTime()) < 2000);
      
      if (tempEntry) {
        const [tempId] = tempEntry;
        tempMessageMapRef.current.delete(tempId);
        
        setMessages((prev) => prev.map(msg => 
          msg.id === tempId ? { ...msg, id: data.messageId, blockNumber: data.blockNumber, status: 'sent' } : msg
        ));
      } else {
        setMessages((prev) => prev.map(msg => 
          msg.id === data.messageId ? { ...msg, status: 'sent', blockNumber: data.blockNumber } : msg
        ));
      }
      
      refetchBlockchain();
    });
    
    socket.on('message-delivered', (data) => {
      console.log('Message delivered:', data);
      setMessages((prev) => prev.map(msg => 
        msg.id === data.messageId ? { ...msg, status: 'delivered' } : msg
      ));
    });
    
    socket.on('message-status-update', (data) => {
      console.log('Message status updated:', data);
      setMessages((prev) => prev.map(msg => 
        msg.id === data.messageId ? { ...msg, status: data.status } : msg
      ));
    });
    
    socket.on('message-deleted', (data) => {
      console.log('Message deleted via socket:', data);
      const { messageId } = data;
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });
    
    socket.on('messages-seen-bulk', (data) => {
      console.log('Messages seen in bulk:', data);
      const { from } = data;
      setMessages((prev) => prev.map(msg => {
        if (msg.isSender && msg.status !== 'seen' && from === activeContactNameRef.current) {
          return { ...msg, status: 'seen' };
        }
        return msg;
      }));
    });

    return () => {
      console.log('Disconnecting socket for user:', user.username);
      socket.disconnect();
      socket.removeAllListeners();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!activeContactId) {
        setMessages([]);
        setCurrentPage(1);
        setHasMore(false);
        activeContactNameRef.current = undefined;
        return;
      }

      const activeContact = contacts.find((c) => c.id === activeContactId);
      if (!activeContact) return;

      activeContactNameRef.current = activeContact.name;
      setIsLoadingMessages(true);
      
      try {
        const response = await fetch(`/api/chats/messages/${activeContact.name}?page=1&limit=50`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        
        const data = await response.json();
        const decryptedMessages: Message[] = [];
        
        for (const msg of data.messages) {
          try {
            console.log('📨 Processing message from database:');
            console.log('  Message ID:', msg._id);
            console.log('  SenderId from DB:', msg.senderId);
            console.log('  ReceiverId from DB:', msg.receiverId);
            console.log('  Current username:', user.username);
            console.log('  Is sender?:', msg.senderId === user.username);
            console.log('  Chat public key exists:', !!msg.chatPublicKey);
            console.log('  Chat private key exists:', !!msg.chatPrivateKey);
            
            let decryptedContent;
            if (!msg.chatPublicKey || !msg.chatPrivateKey) {
              decryptedContent = "[Old message - please send a new message]";
              console.log('  ⚠️ Old message format detected - skipping decryption');
            } else {
              decryptedContent = await decryptMessageWithChatKeys(
                msg.encryptedMessage,
                msg.chatPublicKey,
                msg.chatPrivateKey
              );
              console.log('  Decrypted content:', decryptedContent.substring(0, 50) + '...');
            }
            
            const isSender = msg.senderId === user.username;
            console.log('  Message will be positioned:', isSender ? 'RIGHT (sent)' : 'LEFT (received)');
            
            decryptedMessages.push({
              id: msg._id,
              content: decryptedContent,
              encryptedPayload: msg.encryptedMessage,
              timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              isSender,
              blockNumber: msg.blockIndex,
              status: msg.status,
              messageType: msg.messageType,
              mediaUrl: msg.mediaUrl,
              metadata: msg.metadata,
            });
          } catch (error) {
            console.error('Failed to decrypt message:', error);
          }
        }
        
        setMessages(decryptedMessages);
        setCurrentPage(1);
        setHasMore(data.pagination.hasMore);
        
        if (socketRef.current && decryptedMessages.length > 0) {
          console.log('📬 Emitting messages-seen-bulk for contact:', activeContact.name);
          console.log('📬 Total messages loaded:', decryptedMessages.length);
          socketRef.current.emit('messages-seen-bulk', { username: activeContact.name });
          // Refresh contacts so unread counts update immediately after marking seen
          try {
            refetchContacts();
            console.log('🔁 Refetched contacts after marking messages seen');
          } catch (err) {
            console.warn('Failed to refetch contacts after marking messages seen', err);
          }
        } else {
          console.log('⚠️ Not emitting messages-seen-bulk:', {
            hasSocket: !!socketRef.current,
            messageCount: decryptedMessages.length
          });
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [activeContactId]);

  const decryptMessageWithChatKeys = async (encryptedMessage: string, chatPublicKey: string, chatPrivateKey: string): Promise<string> => {
    try {
      console.log('🔓 Decrypting message with chat keys...');
      console.log('  Chat private key exists:', !!chatPrivateKey);
      console.log('  Encrypted message exists:', !!encryptedMessage);
      
      if (!chatPrivateKey || !encryptedMessage) {
        console.error('❌ Missing required decryption keys or message');
        return "[Encrypted Message - No Keys]";
      }
      
      const chatPayload = JSON.parse(encryptedMessage);
      const nonce = naclUtil.decodeBase64(chatPayload.nonce);
      const ciphertext = naclUtil.decodeBase64(chatPayload.ciphertext);
      const privateKeyUint8 = naclUtil.decodeBase64(chatPrivateKey);
      const sharedSecret = privateKeyUint8.slice(0, nacl.secretbox.keyLength);
      
      console.log('✅ Decoded chat encryption layer');
      
      const decrypted = nacl.secretbox.open(ciphertext, nonce, sharedSecret);
      
      if (!decrypted) {
        console.error('❌ Decryption failed');
        return "[Encrypted Message - Decryption Failed]";
      }
      
      const decryptedText = naclUtil.encodeUTF8(decrypted);
      console.log('✅ Successfully decrypted message');
      return decryptedText;
    } catch (error) {
      console.error('❌ Decryption error:', error);
      return "[Encrypted Message - Error]";
    }
  };

  const encryptMessage = async (content: string, recipientPublicKeyBase64: string): Promise<string> => {
    try {
      console.log('🔐 Encryption: recipient publicKey:', recipientPublicKeyBase64?.substring(0, 20) + '...');
      console.log('🔐 Encryption: sender privateKey exists:', !!user.privateKey);
      console.log('🔐 Encryption: sender publicKey exists:', !!user.publicKey);
      
      const recipientPublicKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
      console.log('✅ Decoded recipient public key');
      
      const senderPrivateKey = naclUtil.decodeBase64(user.privateKey);
      console.log('✅ Decoded sender private key');
      
      const senderPublicKey = naclUtil.decodeBase64(user.publicKey);
      console.log('✅ Decoded sender public key');

      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      console.log('✅ Generated nonce');
      
      const messageUint8 = naclUtil.decodeUTF8(content);
      console.log('✅ Encoded message to UTF8');
      
      const encrypted = nacl.box(messageUint8, nonce, recipientPublicKey, senderPrivateKey);
      console.log('✅ Message encrypted');

      const payload = {
        nonce: naclUtil.encodeBase64(nonce),
        ciphertext: naclUtil.encodeBase64(encrypted),
        senderPublicKey: naclUtil.encodeBase64(senderPublicKey),
      };
      console.log('✅ Payload created');

      const finalPayload = btoa(JSON.stringify(payload));
      console.log('✅ Payload encoded to base64');
      return finalPayload;
    } catch (error) {
      console.error('❌ Encryption error:', error);
      throw error;
    }
  };
  
  const loadOlderMessages = async () => {
    if (!activeContactId || !hasMore || isLoadingMessages) return;
    
    const activeContact = contacts.find((c) => c.id === activeContactId);
    if (!activeContact) return;
    
    setIsLoadingMessages(true);
    const nextPage = currentPage + 1;
    
    try {
      const response = await fetch(`/api/chats/messages/${activeContact.name}?page=${nextPage}&limit=50`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      const decryptedMessages: Message[] = [];
      
      for (const msg of data.messages) {
        try {
          let decryptedContent;
          if (!msg.chatPublicKey || !msg.chatPrivateKey) {
            decryptedContent = "[Old message - please send a new message]";
          } else {
            decryptedContent = await decryptMessageWithChatKeys(
              msg.encryptedMessage,
              msg.chatPublicKey,
              msg.chatPrivateKey
            );
          }
          decryptedMessages.push({
            id: msg._id,
            content: decryptedContent,
            timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isSender: msg.senderId === user.username,
            blockNumber: msg.blockIndex,
            status: msg.status,
            messageType: msg.messageType,
            mediaUrl: msg.mediaUrl,
            metadata: msg.metadata,
          });
        } catch (error) {
          console.error('Failed to decrypt message:', error);
        }
      }
      
      setMessages((prev) => [...decryptedMessages, ...prev]);
      setCurrentPage(nextPage);
      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendAttachment = async (
    content: string,
    messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'poll',
    mediaUrl?: string,
    metadata?: any
  ) => {
    if (!activeContactId || !socketRef.current) {
      console.log('❌ Cannot send: missing activeContactId or socket');
      return;
    }

    const activeContact = contacts.find((c) => c.id === activeContactId);
    if (!activeContact) {
      console.log('❌ Cannot send: active contact not found');
      return;
    }

    try {
      const now = Date.now();
      const tempId = `temp-${now}`;
      
      tempMessageMapRef.current.set(tempId, { timestamp: now, content });
      
      socketRef.current.emit('send-message', {
        to: activeContact.name,
        message: content,
        messageType,
        mediaUrl,
        metadata,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          content,
          timestamp: new Date(now).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSender: true,
          status: 'sent',
          messageType,
          mediaUrl,
          metadata,
        },
      ]);
    } catch (error) {
      console.error('Error sending attachment:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeContactId || !socketRef.current) {
      console.log('❌ Cannot send: missing activeContactId or socket');
      return;
    }

    const activeContact = contacts.find((c) => c.id === activeContactId);
    if (!activeContact) {
      console.log('❌ Cannot send: active contact not found');
      return;
    }

    console.log('📤 Sending message to:', activeContact.name);
    console.log('📤 Contact ID (publicKey):', activeContact.id);
    console.log('📤 Message content:', content);

    try {
      console.log('📤 Sending message...');
      
      const now = Date.now();
      const tempId = `temp-${now}`;
      
      tempMessageMapRef.current.set(tempId, { timestamp: now, content });
      
      console.log('📡 Emitting send-message event to:', activeContact.name);
      socketRef.current.emit('send-message', {
        to: activeContact.name,
        message: content,
      });

      const newMessage: Message = {
        id: tempId,
        content,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isSender: true,
        status: 'sent',
        messageType: 'text',
      };
      
      console.log('💬 Adding optimistic message to UI:', tempId);
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error('❌ Failed to send message. Error details:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  };

  const activeContact = contacts.find((c) => c.id === activeContactId);

  if (activeView === "profile") {
    return <ProfileManagement onBack={() => setActiveView("chat")} />;
  }

  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`${
            isSidebarOpen ? "w-80" : "w-0"
          } h-full flex-shrink-0 transition-all duration-300 overflow-hidden md:w-80`}
        >
          <AppSidebar
            contacts={contacts}
            activeContactId={activeContactId}
            onSelectContact={(id) => {
              setActiveContactId(id);
              setActiveView("chat");
              setIsSidebarOpen(false);
            }}
            onViewLedger={() => {
              setActiveView("ledger");
              setIsSidebarOpen(false);
            }}
            onLogout={onLogout}
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          {activeView === "chat" && (
            <div className="flex-shrink-0 flex items-center justify-between bg-midnight-dark border-b border-gray-800 px-4 py-2">
              <Stories />
              <button
                onClick={() => setActiveView("profile")}
                className="ml-auto"
                data-testid="button-profile"
              >
                <Avatar className="h-10 w-10 border-2 border-swapgreen cursor-pointer hover:border-swapgreen/80 transition-colors">
                  <AvatarImage src={profile?.profileImage} alt={user.username} />
                  <AvatarFallback className="bg-midnight-light text-white">
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          )}
          {activeView === "chat" ? (
            <ChatWindow
              contactName={activeContact?.name}
              messages={activeContactId === activeContact?.id ? messages : []}
              blockCount={blockchain.length - 1}
              onSendMessage={handleSendMessage}
              onCopyEncrypted={(messageId: string) => {
                const msg = messages.find(m => m.id === messageId);
                if (!msg) return;
                const enc = (msg as any).encryptedPayload || msg.content;
                navigator.clipboard.writeText(enc).then(() => console.log('Encrypted copied'));
              }}
              onCopyLink={(messageId: string) => {
                const msg = messages.find(m => m.id === messageId);
                if (!msg) return;
                const link = `${window.location.origin}/block/${msg.blockNumber}#msg-${messageId}`;
                navigator.clipboard.writeText(link).then(() => console.log('Message link copied'));
              }}
              // Forward messages to selected recipients
              onForwardMessages={async (messageIds: string[], recipients: string[]) => {
                if (!recipients || recipients.length === 0 || !socketRef.current) return;
                for (const recipient of recipients) {
                  for (const id of messageIds) {
                    const msg = messages.find(m => m.id === id);
                    if (!msg) continue;
                    if (msg.messageType && msg.messageType !== 'text' && msg.mediaUrl) {
                      socketRef.current.emit('send-message', {
                        to: recipient,
                        message: msg.content,
                        messageType: msg.messageType,
                        mediaUrl: msg.mediaUrl,
                        metadata: msg.metadata,
                      });
                    } else {
                      socketRef.current.emit('send-message', { to: recipient, message: msg.content });
                    }
                  }
                }
                alert('Forwarded messages');
              }}
              onDeleteForMe={async (messageId: string) => {
                try {
                  const res = await fetch(`/api/chats/messages/${messageId}/delete-me`, { method: 'POST', credentials: 'include' });
                  if (!res.ok) throw new Error('Delete failed');
                  setMessages(prev => prev.filter(m => m.id !== messageId));
                } catch (err) {
                  console.error('Failed to delete for me', err);
                  alert('Delete failed');
                }
              }}
              contacts={contacts}
              onDeleteForBoth={async (messageId: string) => {
                try {
                  const res = await fetch(`/api/chats/messages/${messageId}/delete-both`, { method: 'POST', credentials: 'include' });
                  if (!res.ok) throw new Error('Delete failed');
                  // notify other user via socket
                  if (socketRef.current && activeContactNameRef.current) {
                    socketRef.current.emit('delete-message-for-both', { messageId, to: activeContactNameRef.current });
                  }
                  setMessages(prev => prev.filter(m => m.id !== messageId));
                } catch (err) {
                  console.error('Failed to delete for both', err);
                  alert('Delete failed');
                }
              }}
              onSendFile={async (file, type) => {
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('fileType', type);

                  const response = await fetch('/api/uploads/file', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                  });

                  if (!response.ok) throw new Error('Upload failed');

                  const data = await response.json();
                  const messageContent = `📎 ${data.fileName || file.name}`;
                  
                  await handleSendAttachment(
                    messageContent,
                    type as any,
                    data.fileUrl,
                    { fileName: data.fileName, fileSize: data.fileSize }
                  );
                } catch (error) {
                  console.error('File upload error:', error);
                  alert('Failed to upload file. Please try again.');
                }
              }}
              onSendLocation={async (location) => {
                try {
                  const response = await fetch('/api/uploads/location', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(location),
                  });

                  if (!response.ok) throw new Error('Location share failed');

                  const data = await response.json();
                  const messageContent = `📍 Location: ${data.location.address}`;
                  
                  await handleSendAttachment(
                    messageContent,
                    'location',
                    undefined,
                    data.location
                  );
                } catch (error) {
                  console.error('Location share error:', error);
                  alert('Failed to share location. Please try again.');
                }
              }}
              onSendContact={async (contact) => {
                try {
                  const response = await fetch('/api/uploads/contact', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(contact),
                  });

                  if (!response.ok) throw new Error('Contact share failed');

                  const data = await response.json();
                  const messageContent = `👤 Contact: ${data.contact.name}`;
                  
                  await handleSendAttachment(
                    messageContent,
                    'contact',
                    undefined,
                    data.contact
                  );
                } catch (error) {
                  console.error('Contact share error:', error);
                  alert('Failed to share contact. Please try again.');
                }
              }}
              onSendPoll={async (poll) => {
                try {
                  const response = await fetch('/api/uploads/poll', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(poll),
                  });

                  if (!response.ok) throw new Error('Poll creation failed');

                  const data = await response.json();
                  const messageContent = `📊 Poll: ${data.poll.question}`;
                  
                  await handleSendAttachment(
                    messageContent,
                    'poll',
                    undefined,
                    data.poll
                  );
                } catch (error) {
                  console.error('Poll creation error:', error);
                  alert('Failed to create poll. Please try again.');
                }
              }}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              onLoadOlderMessages={loadOlderMessages}
              hasMore={hasMore}
              isLoadingMessages={isLoadingMessages}
            />
          ) : (
            <LedgerViewer blocks={blockchain} isValid={true} />
          )}
        </div>
      </div>
    </div>
  );
}
