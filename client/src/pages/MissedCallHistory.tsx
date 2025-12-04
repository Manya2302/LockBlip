import { useEffect, useState } from "react";
import { Phone, Video, ArrowLeft, PhoneMissed, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

interface MissedCall {
  _id: string;
  callerId: string;
  receiverId: string;
  callType: 'voice' | 'video';
  isSeen: boolean;
  timestamp: string;
}

interface MissedCallHistoryProps {
  token: string | null;
  onBack: () => void;
  onOpenChat?: (contactName: string) => void;
}

export default function MissedCallHistory({ token, onBack, onOpenChat }: MissedCallHistoryProps) {
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMissedCalls = async () => {
      if (!token) return;
      
      setIsLoading(true);
      try {
        const response = await fetch('/api/missed-calls', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setMissedCalls(data.missedCalls);
        }
      } catch (error) {
        console.error('Error fetching missed calls:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMissedCalls();
  }, [token]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCallClick = (callerId: string) => {
    if (onOpenChat) {
      onOpenChat(callerId);
    }
  };

  const markAllAsSeen = async () => {
    if (!token) return;
    
    try {
      await fetch('/api/missed-calls/mark-all-seen', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      setMissedCalls(prev => prev.map(call => ({ ...call, isSeen: true })));
    } catch (error) {
      console.error('Error marking all as seen:', error);
    }
  };

  const unseenCount = missedCalls.filter(c => !c.isSeen).length;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-shrink-0 h-16 border-b border-border flex items-center justify-between px-4 bg-card/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <PhoneMissed className="h-5 w-5 text-destructive" />
            <h2 className="font-semibold text-lg">Missed Calls</h2>
          </div>
        </div>
        {unseenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsSeen}
            className="text-primary text-sm"
          >
            Mark all as seen
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : missedCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <PhoneMissed className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No missed calls</p>
            <p className="text-sm">Your missed call history will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {missedCalls.map((call) => (
              <div
                key={call._id}
                className={`flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                  !call.isSeen ? 'bg-primary/5' : ''
                }`}
                onClick={() => handleCallClick(call.callerId)}
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {getInitials(call.callerId)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${!call.isSeen ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {call.callerId}
                    </span>
                    {!call.isSeen && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0"></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {call.callType === 'video' ? (
                        <Video className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Phone className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className="text-destructive">
                        Missed {call.callType} call
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimestamp(call.timestamp)}</span>
                  </div>
                  {call.callType === 'video' ? (
                    <Video className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
