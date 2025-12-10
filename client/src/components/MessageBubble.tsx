import { Lock, Check, CheckCheck, Image as ImageIcon, Video, Mic, File, MapPin, User, BarChart3, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isSender: boolean;
  id: string;
  blockNumber?: number;
  isEncrypted?: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'poll' | 'live_location';
  mediaUrl?: string;
  metadata?: any;
  liveLocationStatus?: 'active' | 'expired' | 'stopped' | null;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}
export default function MessageBubble({
  id,
  content,
  timestamp,
  isSender,
  blockNumber,
  isEncrypted = true,
  status = 'sent',
  messageType = 'text',
  mediaUrl,
  metadata,
  liveLocationStatus,
  onContextMenu,
  isSelected,
  onToggleSelect,
}: MessageBubbleProps) {
  const [, setLocation] = useLocation();
  const renderMediaContent = () => {
    if (!mediaUrl && !metadata) return null;
    
    switch (messageType) {
      case 'image':
        return (
          <img 
            src={mediaUrl} 
            alt="Shared image" 
            className="max-w-xs rounded-lg mb-2"
            data-testid="media-image"
          />
        );
      case 'video':
        return (
          <video 
            src={mediaUrl} 
            controls 
            className="max-w-xs rounded-lg mb-2"
            data-testid="media-video"
          />
        );
      case 'audio':
        return (
          <audio 
            src={mediaUrl} 
            controls 
            className="mb-2 w-full"
            data-testid="media-audio"
          />
        );
      case 'document':
        return (
          <a 
            href={mediaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline mb-2 bg-gray-700/50 px-3 py-2 rounded-lg"
            data-testid="media-document"
          >
            <File className="h-5 w-5" />
            <span>Document</span>
          </a>
        );
      case 'location':
        if (metadata) {
          const { latitude, longitude } = metadata;
          return (
            <a 
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline mb-2 bg-gray-700/50 px-3 py-2 rounded-lg"
              data-testid="media-location"
            >
              <MapPin className="h-5 w-5 text-green-500" />
              <span>View Location</span>
            </a>
          );
        }
        return null;
      case 'contact':
        if (metadata) {
          const { name, phone, email } = metadata;
          return (
            <div className="bg-gray-700/50 px-3 py-2 rounded-lg mb-2" data-testid="media-contact">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-cyan-500" />
                <span className="font-semibold">{name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <div>{phone}</div>
                {email && <div>{email}</div>}
              </div>
            </div>
          );
        }
        return null;
      case 'poll':
        if (metadata) {
          const { question, options, votes = {} } = metadata;
          return (
            <div className="bg-gray-700/50 px-3 py-2 rounded-lg mb-2 min-w-[200px]" data-testid="media-poll">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-yellow-500" />
                <span className="font-semibold text-sm">{question}</span>
              </div>
              <div className="space-y-1">
                {options.map((option: string, idx: number) => (
                  <div key={idx} className="text-xs bg-gray-800/50 px-2 py-1 rounded">
                    {option} {votes[idx] ? `(${votes[idx]})` : ''}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null;
      case 'live_location':
        if (metadata) {
          const { sessionId, sharerName, expiryAt } = metadata;
          const isActive = liveLocationStatus === 'active';
          const expiryDate = new Date(expiryAt);
          const isExpired = expiryDate < new Date() || liveLocationStatus === 'expired' || liveLocationStatus === 'stopped';
          
          return (
            <div 
              className={`bg-gradient-to-r ${isExpired ? 'from-gray-700/50 to-gray-600/50' : 'from-green-900/50 to-green-800/50'} px-4 py-3 rounded-lg mb-2 min-w-[220px] cursor-pointer hover:opacity-90 transition-opacity border ${isExpired ? 'border-gray-600' : 'border-green-500/50'}`}
              onClick={() => !isExpired && setLocation(`/live/${sessionId}`)}
              data-testid="media-live-location"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <Radio className={`h-5 w-5 ${isExpired ? 'text-gray-400' : 'text-green-400'}`} />
                  {isActive && !isExpired && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
                <span className={`font-semibold text-sm ${isExpired ? 'text-gray-400' : 'text-green-300'}`}>
                  Live Location
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                {sharerName} {isExpired ? 'shared' : 'is sharing'} live location
              </p>
              {isExpired ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Location sharing ended</span>
                </div>
              ) : (
                <button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/live/${sessionId}`);
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  Open Live View
                </button>
              )}
            </div>
          );
        }
        return null;
      default:
        return null;
    }
  };
  
  const getMediaIcon = () => {
    switch (messageType) {
      case 'image': return <ImageIcon className="h-3 w-3 text-muted-foreground" />;
      case 'video': return <Video className="h-3 w-3 text-muted-foreground" />;
      case 'audio': return <Mic className="h-3 w-3 text-muted-foreground" />;
      case 'document': return <File className="h-3 w-3 text-muted-foreground" />;
      case 'location': return <MapPin className="h-3 w-3 text-green-500" />;
      case 'contact': return <User className="h-3 w-3 text-cyan-500" />;
      case 'poll': return <BarChart3 className="h-3 w-3 text-yellow-500" />;
      case 'live_location': return <Radio className="h-3 w-3 text-green-400" />;
      default: return null;
    }
  };
  return (
    <div
      className={cn(
        "flex w-full mb-3",
        isSender ? "justify-end" : "justify-start"
      )}
      data-testid={`message-${isSender ? 'sent' : 'received'}`}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, String(id))}
    >
      <div
        className={cn(
          "max-w-md rounded-2xl p-4 backdrop-blur-xl relative",
          isSender
            ? "bg-primary/10 border border-primary/20"
            : "bg-card border border-card-border",
          isSelected ? 'ring-2 ring-primary' : ''
        )}
      >
        {/* Selection indicator: show a round checkbox to the right of the bubble when selected (Telegram-like) */}
        <div
          style={{ right: -18 }}
          className={`absolute top-1/2 -translate-y-1/2 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-transparent border border-gray-600'}`}
          onClick={() => onToggleSelect && onToggleSelect(String(id))}
          role="button"
          aria-pressed={!!isSelected}
        >
          {isSelected ? (
            <span className="text-xs font-semibold">✓</span>
          ) : (
            <span className="w-3 h-3 rounded-full border border-gray-400 block" />
          )}
        </div>
        {renderMediaContent()}
        <div className="flex items-start gap-2 mb-1">
          <div className="flex items-center gap-1.5">
            {isEncrypted && (
              <Lock className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" data-testid="icon-encrypted" />
            )}
            {messageType !== 'text' && getMediaIcon()}
          </div>
          <p className="text-sm leading-relaxed break-words">{content}</p>
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{timestamp}</span>
            {blockNumber !== undefined && (
              <button
                onClick={() => console.log(`View block #${blockNumber}`)}
                className="text-xs font-mono text-accent hover:text-accent-foreground transition-colors"
                data-testid={`link-block-${blockNumber}`}
              >
                #{blockNumber}
              </button>
            )}
          </div>
          {isSender && (
            <div className="flex-shrink-0">
              {status === 'seen' ? (
                <CheckCheck className="h-3.5 w-3.5 text-blue-500" data-testid="icon-seen" />
              ) : status === 'delivered' ? (
                <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" data-testid="icon-delivered" />
              ) : (
                <Check className="h-3.5 w-3.5 text-muted-foreground" data-testid="icon-sent" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
