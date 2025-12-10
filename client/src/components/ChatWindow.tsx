import { useRef, useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import MessageBubble from "./MessageBubble";
import MessageContextMenu from "./MessageContextMenu";
import ChatInput from "./ChatInput";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, Phone, Video, Ghost, Lock } from "lucide-react";
import EmptyState from "./EmptyState";
import emptyChat from '@assets/generated_images/Empty_chat_state_illustration_c6fb06b5.png';
import { GhostModeButton } from "./ghost/GhostModeButton";
import GhostPinJoinForm from "./GhostPinJoinForm";
import { AISummaryCard, AISummarizeButton } from "./chat/AISummaryCard";
import { LiveLocationTracker } from "./chat/LiveLocationShare";

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isSender: boolean;
  blockNumber?: number;
  status?: 'sent' | 'delivered' | 'seen';
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'poll';
  mediaUrl?: string;
  metadata?: any;
}

interface MissedCallCounts {
  voice: number;
  video: number;
}

interface ChatWindowProps {
  contactName?: string;
  contactId?: string;
  messages: Message[];
  blockCount: number;
  initialUnreadCount?: number;
  onSendMessage: (message: string) => void;
  onSendFile?: (file: File, type: 'document' | 'image' | 'video' | 'audio') => void;
  onSendLocation?: (location: { latitude: number; longitude: number }) => void;
  onSendContact?: (contact: { name: string; phone: string; email?: string }) => void;
  onSendPoll?: (poll: { question: string; options: string[] }) => void;
  onToggleSidebar?: () => void;
  onLoadOlderMessages?: () => void;
  hasMore?: boolean;
  isLoadingMessages?: boolean;
  onCopyEncrypted?: (messageId: string) => void;
  onCopyLink?: (messageId: string) => void;
  contacts?: { id: string; name: string; fullName?: string; profileImage?: string }[];
  onForwardMessages?: (messageIds: string[], recipients: string[]) => void;
  onDeleteForMe?: (messageId: string) => void;
  onDeleteForBoth?: (messageId: string) => void;
  onStartVideoCall?: () => void;
  onStartAudioCall?: () => void;
  missedCallCounts?: MissedCallCounts;
  onGhostModeActivate?: (partnerId: string, deviceType: string, disclaimerAgreed: boolean) => Promise<{ pin: string; sessionId: string } | null>;
  onGhostModeJoin?: (pin: string, deviceType: string) => Promise<boolean>;
  onGhostModeCheckStatus?: (partnerId: string) => Promise<any>;
  onGhostModeDirectEnter?: (partnerId: string, deviceType: string) => Promise<boolean>;
  onEnterGhostMode?: () => void;
}

// Helper to get initial unread count that was captured before messages were marked as seen

export default function ChatWindow({
  contactName,
  contactId,
  messages,
  blockCount,
  initialUnreadCount = 0,
  onSendMessage,
  onSendFile,
  onSendLocation,
  onSendContact,
  onSendPoll,
  onToggleSidebar,
  onLoadOlderMessages,
  hasMore = false,
  isLoadingMessages = false,
  onCopyEncrypted,
  onCopyLink,
  onForwardMessages,
  contacts = [],
  onDeleteForMe,
  onDeleteForBoth,
  onStartVideoCall,
  onStartAudioCall,
  missedCallCounts = { voice: 0, video: 0 },
  onGhostModeActivate,
  onGhostModeJoin,
  onGhostModeCheckStatus,
  onGhostModeDirectEnter,
  onEnterGhostMode,
}: ChatWindowProps) {
  const [, setLocation] = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; messageId?: string; deleteForBoth: boolean }>({ show: false, messageId: undefined, deleteForBoth: true });
  const [forwardModal, setForwardModal] = useState<{ show: boolean; messageIds: string[] }>({ show: false, messageIds: [] });
  const [forwardRecipients, setForwardRecipients] = useState<Set<string>>(new Set());
  const [ghostStatus, setGhostStatus] = useState<{
    hasSession: boolean;
    sessionId: string | null;
    ghostEnabled: boolean;
    canEnterDirectly: boolean;
    needsPin: boolean;
  } | null>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const ghostCheckDoneRef = useRef<string | null>(null);
  const [showAISummary, setShowAISummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<{
    id: string;
    text: string;
    messageCount: number;
    keywords: string[];
    createdAt: string;
  } | null>(null);
  const [liveLocationSession, setLiveLocationSession] = useState<{ sessionId: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const count = messages.filter(msg => !msg.isSender && msg.status !== 'seen').length;
    setUnreadCount(count);
  }, [messages]);

  useEffect(() => {
    const checkGhostStatus = async () => {
      if (!contactName || ghostCheckDoneRef.current === contactName) return;
      
      try {
        const response = await fetch(`/api/ghost/session-status/${contactName}`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const status = await response.json();
          setGhostStatus(status);
          ghostCheckDoneRef.current = contactName;
          
          if (status.ghostEnabled && status.canEnterDirectly && status.sessionId) {
            console.log('👻 Auto-redirecting to Ghost Mode...');
            setLocation(`/ghost/${status.sessionId}`);
          }
        }
      } catch (err) {
        console.error('Failed to check ghost status:', err);
      }
    };
    
    checkGhostStatus();
  }, [contactName, setLocation]);

  const handleGhostJoin = useCallback(async (pin: string): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
    try {
      const response = await fetch('/api/ghost/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin, deviceType: 'desktop' }),
      });
      
      const data = await response.json();
      
      if (data.success && data.sessionId) {
        setLocation(`/ghost/${data.sessionId}`);
        return { success: true, sessionId: data.sessionId };
      }
      
      return { success: false, error: data.error || 'Invalid PIN' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to join' };
    }
  }, [setLocation]);

  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, messageId });
  };

  const closeContextMenu = () => setContextMenu(null);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCopyEncrypted = (messageId: string) => {
    if (onCopyEncrypted) onCopyEncrypted(messageId);
    closeContextMenu();
  };

  const handleCopyLink = (messageId: string) => {
    if (onCopyLink) onCopyLink(messageId);
    closeContextMenu();
  };

  const handleForward = (messageId: string) => {
    // Open forward modal with the message(s) to forward
    const toForward = selectedIds.size > 0 ? Array.from(selectedIds) : [messageId];
    setForwardModal({ show: true, messageIds: toForward });
    setForwardRecipients(new Set());
    closeContextMenu();
  };

  const handleDelete = (messageId: string) => {
    // open a modal asking whether to delete for both or just for me
    // decide whether delete-for-both is allowed (only allowed if the current user is the sender)
    const msg = messages.find(m => m.id === messageId);
    const canDeleteForBoth = !!msg && msg.isSender === true;
    setDeleteModal({ show: true, messageId, deleteForBoth: canDeleteForBoth });
    closeContextMenu();
  };

  const confirmDelete = async () => {
    const { messageId, deleteForBoth } = deleteModal;
    // determine whether delete-for-both is actually allowed for this request
    let canDeleteForBoth = false;
    if (messageId) {
      const msg = messages.find(m => m.id === messageId);
      canDeleteForBoth = !!msg && msg.isSender === true;
    } else if (selectedIds.size > 0) {
      // only allow delete-for-both for batch if ALL selected messages were sent by current user
      const ids = Array.from(selectedIds);
      canDeleteForBoth = ids.every(id => {
        const m = messages.find(mm => mm.id === id);
        return !!m && m.isSender === true;
      });
    }
    try {
      if (messageId) {
        if (deleteForBoth && canDeleteForBoth) {
          if (onDeleteForBoth) await onDeleteForBoth(messageId);
        } else {
          if (onDeleteForMe) await onDeleteForMe(messageId);
        }
      } else if (selectedIds.size > 0) {
        const ids = Array.from(selectedIds);
        if (deleteForBoth && canDeleteForBoth) {
          for (const id of ids) {
            if (onDeleteForBoth) await onDeleteForBoth(id);
          }
        } else {
          for (const id of ids) {
            if (onDeleteForMe) await onDeleteForMe(id);
          }
        }
      }
    } catch (err) {
      console.error('Delete action failed', err);
      alert('Delete failed');
    } finally {
      setSelectedIds(new Set());
      setDeleteModal({ show: false, messageId: undefined, deleteForBoth: true });
    }
  };
  
  const handleScroll = () => {
    if (!messagesContainerRef.current || !onLoadOlderMessages || !hasMore || isLoadingMessages) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    if (scrollTop < 100) {
      onLoadOlderMessages();
    }
  };

  const initials = contactName
    ? contactName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  if (!contactName) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 h-16 border-b border-border flex items-center px-4 bg-card/30 backdrop-blur-xl">
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleSidebar}
            className="mr-2 md:hidden"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Select a chat to start messaging</span>
        </div>
        <EmptyState
          image={emptyChat}
          title="No conversation selected"
          description="Choose a contact from the sidebar to start messaging with blockchain security"
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="chat-window">
      <div className="flex-shrink-0 h-16 border-b border-border flex items-center justify-between px-4 bg-card/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleSidebar}
            className="mr-2 md:hidden"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-sm" data-testid="text-contact-name">{contactName}</h2>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              onClick={onStartAudioCall}
              className="text-primary hover:text-primary hover:bg-primary/10"
              title="Voice call"
            >
              <Phone className="h-5 w-5" />
            </Button>
            {missedCallCounts.voice > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                {missedCallCounts.voice}
              </span>
            )}
          </div>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              onClick={onStartVideoCall}
              className="text-primary hover:text-primary hover:bg-primary/10"
              title="Video call"
            >
              <Video className="h-5 w-5" />
            </Button>
            {missedCallCounts.video > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                {missedCallCounts.video}
              </span>
            )}
          </div>
          {contactName && onGhostModeActivate && onGhostModeJoin && (
            <GhostModeButton
              partnerId={contactName}
              partnerName={contactName}
              onActivate={onGhostModeActivate}
              onJoin={onGhostModeJoin}
              onCheckStatus={onGhostModeCheckStatus}
              onDirectEnter={onGhostModeDirectEnter}
              onEnterGhostMode={onEnterGhostMode}
              onSendMessage={onSendMessage}
            />
          )}
        </div>
      </div>

      {/* Ghost Mode pending banner - partner needs to enter PIN */}
      {ghostStatus?.needsPin && (
        <div className="bg-gradient-to-r from-purple-900/80 to-pink-900/80 px-4 py-3 flex items-center justify-between border-b border-purple-500/30">
          <div className="flex items-center gap-3">
            <Ghost className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-sm text-white font-medium">Ghost Mode Invitation Pending</p>
              <p className="text-xs text-purple-300">{contactName} has invited you to a secret chat</p>
            </div>
          </div>
          <Button
            onClick={() => setShowJoinForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm"
          >
            <Lock className="w-4 h-4 mr-2" />
            Enter PIN
          </Button>
        </div>
      )}

      {/* Selection toolbar (left-top) when messages are selected */}
      {selectedIds.size > 0 && (
        <div className="absolute top-4 left-4 z-40 bg-white/90 dark:bg-card rounded-md shadow px-3 py-2 flex items-center gap-2">
          <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm" onClick={() => setForwardModal({ show: true, messageIds: Array.from(selectedIds) })}>Forward {selectedIds.size}</button>
          <button className="bg-red-500 text-white px-3 py-1 rounded text-sm" onClick={() => setDeleteModal({ show: true, messageId: undefined, deleteForBoth: true })}>Delete {selectedIds.size}</button>
          <button className="px-3 py-1 text-sm" onClick={() => setSelectedIds(new Set())}>Cancel</button>
        </div>
      )}

      {/* Ghost PIN Join Form Dialog */}
      <GhostPinJoinForm
        isOpen={showJoinForm}
        onClose={() => setShowJoinForm(false)}
        onJoin={handleGhostJoin}
        partnerName={contactName || ''}
      />

      <div className="flex-1 overflow-y-auto p-4" ref={messagesContainerRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <EmptyState
            image={emptyChat}
            title="Start the conversation"
            description="Send your first encrypted message on the blockchain"
          />
        ) : (
          <>
            {isLoadingMessages && hasMore && (
              <div className="text-center py-2">
                <span className="text-xs text-muted-foreground">Loading older messages...</span>
              </div>
            )}
            {messages.map((message, index) => {
              const isFirstUnread = 
                !message.isSender && 
                message.status !== 'seen' && 
                (index === 0 || messages[index - 1].status === 'seen' || messages[index - 1].isSender);
              
              return (
                <div key={message.id}>
                  {isFirstUnread && (
                    <div className="flex items-center gap-2 my-4" data-testid="new-messages-separator">
                      <div className="flex-1 h-px bg-primary/30"></div>
                      <span className="text-xs font-medium text-primary px-2">New Messages</span>
                      <div className="flex-1 h-px bg-primary/30"></div>
                    </div>
                  )}
                  <MessageBubble {...message} onContextMenu={handleContextMenu} isSelected={selectedIds.has(message.id)} onToggleSelect={toggleSelect} />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onCopyEncrypted={() => handleCopyEncrypted(contextMenu.messageId)}
          onCopyLink={() => handleCopyLink(contextMenu.messageId)}
          onForward={() => handleForward(contextMenu.messageId)}
          onDelete={() => handleDelete(contextMenu.messageId)}
          onSelect={() => toggleSelect(contextMenu.messageId)}
          onClose={closeContextMenu}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModal({ show: false, messageId: undefined, deleteForBoth: true })} />
          <div className="bg-white dark:bg-card rounded-lg shadow-lg p-6 z-10 w-[320px]">
            <h3 className="text-lg font-medium mb-4">Do you want to delete this message?</h3>
            <label className="flex items-center gap-2 mb-4">
              {/* disable checkbox if user is not allowed to delete for both */}
              <input
                type="checkbox"
                checked={deleteModal.deleteForBoth && (() => {
                  // compute whether allowed for the currently-open delete modal
                  const mid = deleteModal.messageId;
                  if (mid) {
                    const m = messages.find(mm => mm.id === mid);
                    return !!m && m.isSender === true && deleteModal.deleteForBoth;
                  }
                  if (selectedIds.size > 0) {
                    const ids = Array.from(selectedIds);
                    const allSender = ids.every(id => {
                      const m = messages.find(mm => mm.id === id);
                      return !!m && m.isSender === true;
                    });
                    return allSender && deleteModal.deleteForBoth;
                  }
                  return false;
                })()}
                onChange={(e) => setDeleteModal(dm => ({ ...dm, deleteForBoth: e.target.checked }))}
                className="w-4 h-4"
                disabled={(() => {
                  const mid = deleteModal.messageId;
                  if (mid) {
                    const m = messages.find(mm => mm.id === mid);
                    return !(!!m && m.isSender === true);
                  }
                  if (selectedIds.size > 0) {
                    const ids = Array.from(selectedIds);
                    return !ids.every(id => {
                      const m = messages.find(mm => mm.id === id);
                      return !!m && m.isSender === true;
                    });
                  }
                  return true;
                })()}
              />
              <span className="text-sm">Also delete for {contactName}</span>
            </label>
            {(() => {
              const mid = deleteModal.messageId;
              let allowed = true;
              if (mid) {
                const m = messages.find(mm => mm.id === mid);
                allowed = !!m && m.isSender === true;
              } else if (selectedIds.size > 0) {
                const ids = Array.from(selectedIds);
                allowed = ids.every(id => {
                  const m = messages.find(mm => mm.id === id);
                  return !!m && m.isSender === true;
                });
              }
              if (!allowed) {
                return <div className="text-xs text-muted-foreground">Only the sender can delete messages for everyone.</div>;
              }
              return null;
            })()}
            <div className="flex justify-end gap-3">
              <button className="px-3 py-1 text-sm" onClick={() => setDeleteModal({ show: false, messageId: undefined, deleteForBoth: true })}>Cancel</button>
              <button className="px-3 py-1 bg-red-500 text-white rounded text-sm" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Forward modal: pick one or more contacts to forward selected messages to */}
      {forwardModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setForwardModal({ show: false, messageIds: [] })} />
          <div className="bg-white dark:bg-card rounded-lg shadow-lg p-4 z-10 w-[360px] max-h-[70vh] overflow-auto">
            <h3 className="text-lg font-medium mb-3">Forward to...</h3>
            <div className="text-sm text-muted-foreground mb-3">Select one or more contacts</div>
            <div className="space-y-2 mb-4">
              {contacts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No contacts available</div>
              ) : (
                contacts.map(c => {
                  const selected = forwardRecipients.has(c.name);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 p-2 rounded transition-colors ${selected ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          setForwardRecipients(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.name); else next.delete(c.name);
                            return next;
                          });
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center text-sm text-gray-700 dark:text-gray-200">{(c.name||'').slice(0,2).toUpperCase()}</div>
                        <div>
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{c.fullName || c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.name}</div>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-3 py-1 text-sm" onClick={() => setForwardModal({ show: false, messageIds: [] })}>Cancel</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={async () => {
                const recipients = Array.from(forwardRecipients);
                if (recipients.length === 0) return alert('Please select at least one contact');
                try {
                  if (onForwardMessages) await onForwardMessages(forwardModal.messageIds, recipients);
                  setForwardModal({ show: false, messageIds: [] });
                  setSelectedIds(new Set());
                } catch (err) {
                  console.error('Forward failed', err);
                  alert('Forward failed');
                }
              }}>Forward</button>
            </div>
          </div>
        </div>
      )}

      <ChatInput 
        onSendMessage={onSendMessage} 
        onSendFile={onSendFile}
        onSendLocation={onSendLocation}
        onSendContact={onSendContact}
        onSendPoll={onSendPoll}
        targetUsername={contactName}
        onLiveLocationStarted={(session) => setLiveLocationSession(session)}
      />
      
      {contactName && showAISummary && generatedSummary && (
        <div className="fixed bottom-28 right-4 z-40 max-w-sm">
          <AISummaryCard 
            contactUsername={contactName} 
            initialSummary={generatedSummary}
            onDismiss={() => {
              setShowAISummary(false);
              setGeneratedSummary(null);
            }}
          />
        </div>
      )}
      
      {contactName && (
        <AISummarizeButton
          contactUsername={contactName}
          unreadCount={Math.max(initialUnreadCount, unreadCount)}
          onSummaryGenerated={(summary) => {
            setGeneratedSummary(summary);
            setShowAISummary(true);
          }}
        />
      )}
      
      {liveLocationSession && (
        <LiveLocationTracker
          sessionId={liveLocationSession.sessionId}
          onStop={() => setLiveLocationSession(null)}
        />
      )}
    </div>
  );
}
