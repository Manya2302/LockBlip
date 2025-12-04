import { useEffect, useState, useMemo } from "react";
import { Phone, Video, ArrowLeft, PhoneMissed, Clock, Calendar, User, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isToday, isYesterday, isThisWeek, isThisYear, parseISO } from "date-fns";

interface MissedCall {
  _id: string;
  callerId: string;
  receiverId: string;
  callType: 'voice' | 'video';
  isSeen: boolean;
  timestamp: string;
}

interface GroupedCalls {
  [date: string]: MissedCall[];
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

  const groupedCalls = useMemo(() => {
    const groups: GroupedCalls = {};
    
    missedCalls.forEach(call => {
      const date = new Date(call.timestamp);
      let dateKey: string;
      
      if (isToday(date)) {
        dateKey = 'Today';
      } else if (isYesterday(date)) {
        dateKey = 'Yesterday';
      } else if (isThisWeek(date)) {
        dateKey = format(date, 'EEEE');
      } else if (isThisYear(date)) {
        dateKey = format(date, 'MMMM d');
      } else {
        dateKey = format(date, 'MMMM d, yyyy');
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(call);
    });
    
    return groups;
  }, [missedCalls]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'h:mm a');
  };

  const formatFullTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy \'at\' h:mm a');
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
  const totalVoiceCalls = missedCalls.filter(c => c.callType === 'voice').length;
  const totalVideoCalls = missedCalls.filter(c => c.callType === 'video').length;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-shrink-0 border-b border-border bg-card/30 backdrop-blur-xl">
        <div className="h-16 flex items-center justify-between px-4">
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
              <h2 className="font-semibold text-lg">Missed Call History</h2>
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
        
        {missedCalls.length > 0 && (
          <div className="px-4 pb-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <PhoneCall className="h-4 w-4" />
              <span>Total: {missedCalls.length} missed calls</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>{totalVoiceCalls} voice</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Video className="h-3.5 w-3.5" />
                <span>{totalVideoCalls} video</span>
              </div>
            </div>
            {unseenCount > 0 && (
              <div className="ml-auto flex items-center gap-1.5 text-destructive font-medium">
                <span className="h-2 w-2 rounded-full bg-destructive"></span>
                <span>{unseenCount} unseen</span>
              </div>
            )}
          </div>
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
          <div className="py-2">
            {Object.entries(groupedCalls).map(([dateGroup, calls]) => (
              <div key={dateGroup} className="mb-4">
                <div className="px-4 py-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{dateGroup}</span>
                  <span className="text-xs font-normal">({calls.length} calls)</span>
                </div>
                <div className="divide-y divide-border/50">
                  {calls.map((call) => (
                    <div
                      key={call._id}
                      className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                        !call.isSeen ? 'bg-destructive/5 border-l-2 border-l-destructive' : ''
                      }`}
                      onClick={() => handleCallClick(call.callerId)}
                    >
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className={`font-semibold ${
                          !call.isSeen ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'
                        }`}>
                          {getInitials(call.callerId)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={`font-medium truncate ${!call.isSeen ? 'text-foreground' : 'text-muted-foreground'}`}>
                            @{call.callerId}
                          </span>
                          {!call.isSeen && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-destructive text-destructive-foreground">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {call.callType === 'video' ? (
                              <Video className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <Phone className="h-3.5 w-3.5 text-destructive" />
                            )}
                            <span className="text-destructive font-medium">
                              Missed {call.callType} call
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(call.timestamp)}</span>
                        </div>
                        <div className={`p-1.5 rounded-full ${
                          call.callType === 'video' ? 'bg-blue-500/10' : 'bg-green-500/10'
                        }`}>
                          {call.callType === 'video' ? (
                            <Video className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Phone className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
