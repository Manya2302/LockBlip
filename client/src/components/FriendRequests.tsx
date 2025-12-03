import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Check, X, Clock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FriendRequestsProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

interface RequestDetails {
  _id: string;
  sender: string;
  receiver: string;
  status: string;
  createdAt: string;
  senderDetails?: {
    username: string;
    fullName: string;
    profileImage: string;
  };
  receiverDetails?: {
    username: string;
    fullName: string;
    profileImage: string;
  };
}

export default function FriendRequests({ open, onClose, username }: FriendRequestsProps) {
  const { toast } = useToast();

  const { data: requests, refetch } = useQuery<{ received: RequestDetails[], sent: RequestDetails[] }>({
    queryKey: ['/api/connections/friend-requests', username],
    enabled: open && !!username,
  });

  const acceptMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return await apiRequest('POST', '/api/connections/accept-request', {
        connectionId
      });
    },
    onSuccess: () => {
      toast({
        title: "Friend request accepted",
      });
      refetch();
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

  const ignoreMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return await apiRequest('POST', '/api/connections/ignore-request', {
        connectionId
      });
    },
    onSuccess: () => {
      toast({
        title: "Friend request ignored",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to ignore request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-midnight-dark border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Friend Requests</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received" data-testid="tab-received-requests">
              Received ({requests?.received.length || 0})
            </TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent-requests">
              Sent ({requests?.sent.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            <ScrollArea className="h-[400px] pr-4">
              {requests?.received.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-midnight-light flex items-center justify-center">
                      <User className="h-8 w-8 text-gray-500" />
                    </div>
                    <p className="text-gray-400 font-medium">No pending friend requests</p>
                    <p className="text-sm text-gray-500">When someone sends you a request, it will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  {requests?.received.map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-midnight-light to-midnight-dark border border-gray-700 hover:border-swapgreen/50 transition-all"
                      data-testid={`request-received-${request.senderDetails?.username}`}
                    >
                      <Avatar className="h-14 w-14 border-2 border-swapgreen ring-2 ring-swapgreen/20">
                        <AvatarImage src={request.senderDetails?.profileImage} alt={request.senderDetails?.username} />
                        <AvatarFallback className="bg-midnight-dark text-white text-lg">
                          <User className="h-7 w-7" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-base truncate">
                          @{request.senderDetails?.username || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-300 truncate">
                          {request.senderDetails?.fullName || 'No name'}
                        </p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => acceptMutation.mutate(request._id)}
                          disabled={acceptMutation.isPending}
                          className="h-10 px-5 bg-white hover:bg-gray-100 text-swapgreen border-2 border-swapgreen font-bold"
                          data-testid={`button-accept-${request.senderDetails?.username}`}
                        >
                          <Check className="h-4 w-4 mr-1 text-swapgreen" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => ignoreMutation.mutate(request._id)}
                          disabled={ignoreMutation.isPending}
                          className="h-10 px-5 bg-white hover:bg-gray-100 border-2 border-red-500 text-red-500 font-bold"
                          data-testid={`button-ignore-${request.senderDetails?.username}`}
                        >
                          <X className="h-4 w-4 mr-1 text-red-500" />
                          Ignore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sent">
            <ScrollArea className="h-[400px] pr-4">
              {requests?.sent.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-midnight-light flex items-center justify-center">
                      <Clock className="h-8 w-8 text-gray-500" />
                    </div>
                    <p className="text-gray-400 font-medium">No sent friend requests</p>
                    <p className="text-sm text-gray-500">Requests you send will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  {requests?.sent.map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-midnight-light to-midnight-dark border border-gray-700"
                      data-testid={`request-sent-${request.receiverDetails?.username}`}
                    >
                      <Avatar className="h-14 w-14 border-2 border-yellow-500 ring-2 ring-yellow-500/20">
                        <AvatarImage src={request.receiverDetails?.profileImage} alt={request.receiverDetails?.username} />
                        <AvatarFallback className="bg-midnight-dark text-white text-lg">
                          <User className="h-7 w-7" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-base truncate">
                          @{request.receiverDetails?.username || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-300 truncate">
                          {request.receiverDetails?.fullName || 'No name'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/30 shrink-0">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">Pending</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
