import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContactItemProps {
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  isActive?: boolean;
  isOnline?: boolean;
  onClick?: () => void;
}

export default function ContactItem({
  name,
  lastMessage,
  timestamp,
  unreadCount = 0,
  isActive = false,
  isOnline = false,
  onClick,
}: ContactItemProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-md transition-colors hover-elevate active-elevate-2",
        isActive && "bg-sidebar-accent"
      )}
      data-testid={`contact-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <div className="absolute bottom-0 right-0 h-3 w-3 bg-primary rounded-full border-2 border-sidebar" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-medium text-sm truncate">{name}</span>
          {timestamp && (
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {timestamp}
            </span>
          )}
        </div>
        {lastMessage && (
          <p className="text-xs text-muted-foreground truncate">
            {lastMessage}
          </p>
        )}
      </div>
      {unreadCount > 0 && (
        <Badge
          variant="default"
          className="ml-auto flex-shrink-0 h-5 min-w-5 px-1.5 text-xs"
          data-testid={`badge-unread-${unreadCount}`}
        >
          {unreadCount}
        </Badge>
      )}
    </button>
  );
}
