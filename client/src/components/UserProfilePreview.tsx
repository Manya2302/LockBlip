import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, User, UserPlus, Check, X } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ConnectionStatus {
  status: 'none' | 'pending' | 'accepted' | 'ignored';
  isFriend: boolean;
  isSender: boolean;
  connectionId?: string;
}

interface UserProfilePreviewProps {
  user: {
    id: string;
    username: string;
    fullName: string;
    phone?: string;
    description: string;
    profileImage: string;
    publicKey: string;
    createdAt: string;
  } | null;
  open: boolean;
  onClose: () => void;
  onStartChat: (publicKey: string, username: string) => void;
}

export default function UserProfilePreview({ user, open, onClose, onStartChat }: UserProfilePreviewProps) {
  const { toast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: connectionStatus, refetch: refetchConnectionStatus } = useQuery<ConnectionStatus>({
    queryKey: ['/api/connections/connection-status', currentUser.username, user?.username],
    enabled: open && !!currentUser.username && !!user,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not found");
      return await apiRequest('POST', '/api/connections/send-request', {
        sender: currentUser.username,
        receiver: user.username,
      });
    },
    onSuccess: () => {
      if (!user) return;
      toast({
        title: "Friend request sent",
        description: `Request sent to @${user.username}`,
      });
      refetchConnectionStatus();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/connections/accept-request', {
        connectionId: connectionStatus?.connectionId,
      });
    },
    onSuccess: () => {
      if (!user) return;
      toast({
        title: "Friend request accepted",
        description: `You are now friends with @${user.username}`,
      });
      refetchConnectionStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/users/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/connections/friends'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const ignoreRequestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/connections/ignore-request', {
        connectionId: connectionStatus?.connectionId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Friend request ignored",
      });
      refetchConnectionStatus();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to ignore request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const joinedDate = user.createdAt ? format(new Date(user.createdAt), 'MMMM dd, yyyy') : 'N/A';

  const renderActionButton = () => {
    if (!connectionStatus) {
      return null;
    }

    if (connectionStatus.status === 'accepted' && connectionStatus.isFriend) {
      return (
        <Button
          onClick={() => {
            onStartChat(user.publicKey, user.username);
            onClose();
          }}
          className="w-full bg-white hover:bg-gray-100 text-swapgreen border-2 border-swapgreen font-semibold"
          data-testid={`button-start-chat-${user.username}`}
        >
          <MessageSquare className="h-4 w-4 mr-2 text-swapgreen" />
          Message
        </Button>
      );
    }

    if (connectionStatus.status === 'pending' && !connectionStatus.isSender) {
      return (
        <div className="space-y-2">
          <Button
            onClick={() => acceptRequestMutation.mutate()}
            disabled={acceptRequestMutation.isPending}
            className="w-full bg-white hover:bg-gray-100 text-swapgreen border-2 border-swapgreen font-semibold"
            data-testid={`button-accept-request-${user.username}`}
          >
            <Check className="h-4 w-4 mr-2 text-swapgreen" />
            Accept Request
          </Button>
          <Button
            onClick={() => ignoreRequestMutation.mutate()}
            disabled={ignoreRequestMutation.isPending}
            className="w-full bg-white hover:bg-gray-100 border-2 border-red-500 text-red-500 font-semibold"
            data-testid={`button-ignore-request-${user.username}`}
          >
            <X className="h-4 w-4 mr-2 text-red-500" />
            Ignore
          </Button>
        </div>
      );
    }

    if (connectionStatus.status === 'pending' && connectionStatus.isSender) {
      return (
        <Button
          disabled
          variant="outline"
          className="w-full"
          data-testid={`button-request-pending-${user.username}`}
        >
          Request Pending
        </Button>
      );
    }

    if (connectionStatus.status === 'ignored') {
      return (
        <Button
          disabled
          variant="outline"
          className="w-full"
          data-testid={`button-request-ignored-${user.username}`}
        >
          Request Ignored
        </Button>
      );
    }

    return (
      <Button
        onClick={() => sendRequestMutation.mutate()}
        disabled={sendRequestMutation.isPending}
        className="w-full bg-white hover:bg-gray-100 text-swapgreen border-2 border-swapgreen font-semibold"
        data-testid={`button-send-request-${user.username}`}
      >
        <UserPlus className="h-4 w-4 mr-2 text-swapgreen" />
        Send Friend Request
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-midnight-dark border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24 border-4 border-swapgreen">
              <AvatarImage src={user.profileImage} alt={user.username} />
              <AvatarFallback className="bg-midnight-light text-white text-2xl">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white" data-testid={`text-username-${user.username}`}>
                @{user.username}
              </h2>
              <p className="text-gray-400 mt-1" data-testid={`text-fullname-${user.username}`}>
                {user.fullName}
              </p>
            </div>
          </div>

          {user.description && (
            <div className="bg-midnight-light rounded-lg p-4">
              <p className="text-sm text-gray-300" data-testid={`text-description-${user.username}`}>
                {user.description}
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm">
            {user.phone && (
              <div className="flex justify-between">
                <span className="text-gray-400">Phone</span>
                <span className="text-white" data-testid={`text-phone-${user.username}`}>{user.phone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Joined</span>
              <span className="text-white" data-testid={`text-joined-${user.username}`}>{joinedDate}</span>
            </div>
            {connectionStatus?.isFriend && (
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="text-swapgreen flex items-center gap-1" data-testid={`text-friend-status-${user.username}`}>
                  <Check className="h-3 w-3" />
                  Friends
                </span>
              </div>
            )}
          </div>

          {renderActionButton()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
