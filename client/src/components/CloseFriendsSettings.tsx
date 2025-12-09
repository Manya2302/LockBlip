import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, User, Plus, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  fullName?: string;
  profileImage?: string;
}

interface CloseFriendsSettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function CloseFriendsSettings({ open, onClose }: CloseFriendsSettingsProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/users/contacts'],
  });

  const { data: closeFriendsData, isLoading } = useQuery<{ closeFriends: string[] }>({
    queryKey: ['/api/users/close-friends'],
    enabled: open,
  });

  const closeFriends = closeFriendsData?.closeFriends || [];

  const addCloseFriendMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest('POST', '/api/users/close-friends/add', { username });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add close friend');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/close-friends'] });
      toast({
        title: "Added",
        description: "User added to your close friends list.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add close friend.",
        variant: "destructive",
      });
    },
  });

  const removeCloseFriendMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest('POST', '/api/users/close-friends/remove', { username });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove close friend');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/close-friends'] });
      toast({
        title: "Removed",
        description: "User removed from your close friends list.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove close friend.",
        variant: "destructive",
      });
    },
  });

  const closeFriendContacts = contacts.filter(c => closeFriends.includes(c.name));
  const availableContacts = contacts.filter(c => !closeFriends.includes(c.name));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="bg-midnight-dark border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Star className="h-5 w-5 text-green-400" />
            Close Friends
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Only close friends can see stories shared with "Close Friends Only" enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">Your Close Friends ({closeFriends.length})</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAdding(!isAdding)}
                className="text-swapgreen hover:text-swapgreen/80"
              >
                {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {isAdding ? 'Cancel' : 'Add'}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <ScrollArea className="max-h-48">
                {closeFriendContacts.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">No close friends yet</p>
                    <p className="text-gray-600 text-xs mt-1">Add friends to share exclusive stories</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {closeFriendContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-2 bg-midnight-light rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={contact.profileImage} />
                            <AvatarFallback className="bg-gray-700 text-xs">
                              {contact.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm text-white">{contact.name}</p>
                            {contact.fullName && (
                              <p className="text-xs text-gray-400">{contact.fullName}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCloseFriendMutation.mutate(contact.name)}
                          disabled={removeCloseFriendMutation.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {isAdding && (
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Add Close Friends</h3>
              <ScrollArea className="max-h-48">
                {availableContacts.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">All your contacts are already close friends</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-2 hover:bg-midnight-light rounded-lg cursor-pointer transition-colors"
                        onClick={() => addCloseFriendMutation.mutate(contact.name)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={contact.profileImage} />
                            <AvatarFallback className="bg-gray-700 text-xs">
                              {contact.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm text-white">{contact.name}</p>
                            {contact.fullName && (
                              <p className="text-xs text-gray-400">{contact.fullName}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={addCloseFriendMutation.isPending}
                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-white hover:bg-midnight-light"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
