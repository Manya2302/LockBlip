import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, X, Eye, User, Image as ImageIcon, Users, ChevronDown, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Story {
  id: string;
  userId: string;
  username: string;
  profileImage: string;
  content: string;
  mediaType: string;
  backgroundColor: string;
  image?: string;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  viewers: Array<{
    username: string;
    viewedAt: string;
  }>;
  isOwnStory: boolean;
  visibilityType?: string;
  closeFriendsOnly?: boolean;
  isCloseFriendStory?: boolean;
}

interface GroupedStories {
  [userId: string]: Story[];
}

interface Contact {
  id: string;
  name: string;
  fullName?: string;
  profileImage?: string;
}

interface GroupedViewer {
  id: string;
  username: string;
  profileImage: string;
  viewCount: number;
  timestamps: string[];
}

export default function Stories() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [storyContent, setStoryContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [storyImage, setStoryImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'text' | 'image'>('text');
  const [currentStoryGroup, setCurrentStoryGroup] = useState<Story[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  
  const [visibilityType, setVisibilityType] = useState<'everyone' | 'hide_from' | 'only_selected'>('everyone');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);
  const [expandedViewers, setExpandedViewers] = useState<Set<string>>(new Set());
  const [groupedViewers, setGroupedViewers] = useState<GroupedViewer[]>([]);
  const [totalViewCount, setTotalViewCount] = useState(0);

  const { data: stories = {}, refetch } = useQuery<GroupedStories>({
    queryKey: ['/api/stories'],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/users/contacts'],
  });

  const { data: closeFriendsData } = useQuery<{ closeFriends: string[] }>({
    queryKey: ['/api/users/close-friends'],
  });

  const createStoryMutation = useMutation({
    mutationFn: async (data: { 
      content: string; 
      backgroundColor: string; 
      mediaType: string; 
      image?: string;
      visibilityType: string;
      allowedViewers?: string[];
      hiddenFromViewers?: string[];
      closeFriendsOnly: boolean;
    }) => {
      console.log('Creating story with data:', data);
      try {
        const response = await apiRequest('POST', '/api/stories', data);
        console.log('Response status:', response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Story created response:', result);
        return result;
      } catch (error) {
        console.error('Mutation error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Story created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/stories'] });
      setIsCreateOpen(false);
      resetCreateForm();
      toast({
        title: "Story Posted",
        description: "Your story has been posted and will expire in 24 hours.",
      });
    },
    onError: (error: any) => {
      console.error('Failed to create story:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to post story. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markViewedMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const response = await apiRequest('POST', `/api/stories/${storyId}/view`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/stories'] });
      if (data.viewCount !== undefined) {
        setTotalViewCount(data.viewCount);
      }
    },
  });

  const resetCreateForm = () => {
    setStoryContent('');
    setStoryImage(null);
    setMediaType('text');
    setVisibilityType('everyone');
    setSelectedContacts([]);
    setCloseFriendsOnly(false);
    setBackgroundColor('#1a1a1a');
  };

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 800, 0.7);
        setStoryImage(compressed);
        setMediaType('image');
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to process image. Please try another one.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCreateStory = () => {
    if (mediaType === 'text' && !storyContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter some content for your story.",
        variant: "destructive",
      });
      return;
    }

    if (mediaType === 'image' && !storyImage) {
      toast({
        title: "Error",
        description: "Please upload an image for your story.",
        variant: "destructive",
      });
      return;
    }

    const allowedViewers = visibilityType === 'only_selected' ? selectedContacts : undefined;
    const hiddenFromViewers = visibilityType === 'hide_from' ? selectedContacts : undefined;

    createStoryMutation.mutate({
      content: storyContent || 'Image story',
      backgroundColor,
      mediaType,
      image: storyImage || undefined,
      visibilityType,
      allowedViewers,
      hiddenFromViewers,
      closeFriendsOnly,
    });
  };

  const fetchGroupedViewers = async (storyId: string) => {
    try {
      const response = await apiRequest('GET', `/api/stories/${storyId}/viewers`, {});
      if (response.ok) {
        const data = await response.json();
        setGroupedViewers(data.viewers || []);
        setTotalViewCount(data.totalViewCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch grouped viewers:', error);
    }
  };

  const handleViewStory = (userStories: Story[]) => {
    setCurrentStoryGroup(userStories);
    setCurrentStoryIndex(0);
    setIsViewOpen(true);
    setGroupedViewers([]);
    setExpandedViewers(new Set());
    
    if (!userStories[0].isOwnStory) {
      markViewedMutation.mutate(userStories[0].id);
    } else {
      fetchGroupedViewers(userStories[0].id);
    }
  };

  const handleNextStory = () => {
    if (currentStoryIndex < currentStoryGroup.length - 1) {
      const nextIndex = currentStoryIndex + 1;
      setCurrentStoryIndex(nextIndex);
      setGroupedViewers([]);
      setExpandedViewers(new Set());
      
      if (!currentStoryGroup[nextIndex].isOwnStory) {
        markViewedMutation.mutate(currentStoryGroup[nextIndex].id);
      } else {
        fetchGroupedViewers(currentStoryGroup[nextIndex].id);
      }
    } else {
      setIsViewOpen(false);
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      const prevIndex = currentStoryIndex - 1;
      setCurrentStoryIndex(prevIndex);
      setGroupedViewers([]);
      setExpandedViewers(new Set());
      
      if (currentStoryGroup[prevIndex].isOwnStory) {
        fetchGroupedViewers(currentStoryGroup[prevIndex].id);
      }
    }
  };

  const toggleViewerExpanded = (viewerId: string) => {
    setExpandedViewers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(viewerId)) {
        newSet.delete(viewerId);
      } else {
        newSet.add(viewerId);
      }
      return newSet;
    });
  };

  const toggleContactSelection = (contactName: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactName) 
        ? prev.filter(c => c !== contactName)
        : [...prev, contactName]
    );
  };

  const currentStory = currentStoryGroup[currentStoryIndex];
  const userStories = Object.entries(stories);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const closeFriends = closeFriendsData?.closeFriends || [];

  const colors = [
    '#1a1a1a', '#1e3a8a', '#7c2d12', '#831843', '#064e3b',
    '#713f12', '#4c1d95', '#14532d', '#991b1b', '#1e40af'
  ];

  const getTextColor = (bgColor: string) => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  };

  return (
    <>
      <div className="flex space-x-4 p-4 overflow-x-auto bg-midnight-dark border-b border-gray-800">
        <div
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center space-y-1 cursor-pointer group"
          data-testid="button-create-story"
        >
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-dashed border-swapgreen">
              <AvatarFallback className="bg-midnight-light text-swapgreen">
                <Plus className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs text-gray-400 group-hover:text-swapgreen">Your Story</span>
        </div>

        {userStories.map(([userId, userStories]) => {
          const latestStory = userStories[0];
          const hasMultiple = userStories.length > 1;
          const hasCloseFriendStory = userStories.some(s => s.isCloseFriendStory || s.closeFriendsOnly);
          
          const getRingClass = () => {
            if (latestStory.isOwnStory) return 'border-2 border-swapgreen';
            if (hasCloseFriendStory) return 'ring-2 ring-green-500';
            return 'ring-2 ring-chain-blue';
          };
          
          return (
            <div
              key={userId}
              onClick={() => handleViewStory(userStories)}
              className="flex flex-col items-center space-y-1 cursor-pointer group"
              data-testid={`story-${latestStory.username}`}
            >
              <div className="relative">
                <Avatar className={`h-16 w-16 ${getRingClass()}`}>
                  <AvatarImage src={latestStory.profileImage} alt={latestStory.username} />
                  <AvatarFallback className="bg-midnight-light text-white">
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                {hasCloseFriendStory && (
                  <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full h-5 w-5 flex items-center justify-center">
                    <Star className="h-3 w-3" />
                  </div>
                )}
                {hasMultiple && (
                  <div className="absolute -bottom-1 -right-1 bg-chain-blue text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {userStories.length}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 group-hover:text-white max-w-[64px] truncate">
                {latestStory.isOwnStory ? 'You' : latestStory.username}
              </span>
            </div>
          );
        })}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="bg-midnight-dark border-gray-800 text-white h-[85vh] max-h-[700px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-2xl">Create Story</DialogTitle>
            <DialogDescription className="text-gray-400">
              Share a text or image story that will be visible for 24 hours
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={mediaType === 'text' ? 'default' : 'outline'}
                  onClick={() => {
                    setMediaType('text');
                    setStoryImage(null);
                  }}
                  className={mediaType === 'text' ? 'bg-swapgreen text-black' : 'border-gray-700 text-white'}
                  data-testid="button-text-story"
                >
                  Text
                </Button>
                <Button
                  variant={mediaType === 'image' ? 'default' : 'outline'}
                  onClick={() => setMediaType('image')}
                  className={mediaType === 'image' ? 'bg-swapgreen text-black' : 'border-gray-700 text-white'}
                  data-testid="button-image-story"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Image
                </Button>
              </div>

              {mediaType === 'text' ? (
                <>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Background Color</label>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setBackgroundColor(color)}
                          className={`h-10 w-10 rounded-full border-2 ${
                            backgroundColor === color ? 'border-swapgreen scale-110' : 'border-gray-700'
                          } transition-transform`}
                          style={{ backgroundColor: color }}
                          data-testid={`color-${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Content</label>
                    <Textarea
                      value={storyContent}
                      onChange={(e) => setStoryContent(e.target.value)}
                      placeholder="What's on your mind?"
                      className="bg-midnight-light border-gray-700 text-white min-h-[100px]"
                      maxLength={300}
                      data-testid="textarea-story-content"
                    />
                    <p className="text-xs text-gray-500 mt-1">{storyContent.length}/300</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Preview</label>
                    <div 
                      className="rounded-lg p-4 flex items-center justify-center text-center min-h-[100px]"
                      style={{ backgroundColor }}
                    >
                      <p 
                        className="text-base break-words max-w-full px-2 font-medium"
                        style={{ color: getTextColor(backgroundColor) }}
                      >
                        {storyContent || "Your story preview..."}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Upload Image</label>
                  <div className="flex flex-col items-center space-y-4">
                    {storyImage ? (
                      <div className="relative w-full">
                        <img 
                          src={storyImage} 
                          alt="Story preview" 
                          className="w-full max-h-48 object-cover rounded-lg"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => setStoryImage(null)}
                          className="absolute top-2 right-2"
                          data-testid="button-remove-image"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label
                        htmlFor="story-image"
                        className="w-full h-32 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-swapgreen transition-colors"
                      >
                        <ImageIcon className="h-10 w-10 text-gray-400 mb-2" />
                        <span className="text-gray-400">Click to upload image</span>
                        <input
                          id="story-image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          data-testid="input-story-image"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-700 pt-4">
                <label className="text-sm text-gray-400 mb-3 block flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Story Privacy Settings
                </label>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-midnight-light rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-green-400" />
                      <Label htmlFor="close-friends-toggle" className="text-white cursor-pointer">
                        Close Friends Only
                      </Label>
                    </div>
                    <Switch
                      id="close-friends-toggle"
                      checked={closeFriendsOnly}
                      onCheckedChange={setCloseFriendsOnly}
                      data-testid="switch-close-friends"
                    />
                  </div>
                  
                  {closeFriendsOnly && (
                    <p className="text-xs text-green-400 px-2">
                      Only your close friends ({closeFriends.length}) will see this story
                    </p>
                  )}

                  {!closeFriendsOnly && (
                    <>
                      <div>
                        <Label className="text-gray-400 text-sm mb-2 block">Who can see this story?</Label>
                        <Select value={visibilityType} onValueChange={(val: any) => { setVisibilityType(val); setSelectedContacts([]); }}>
                          <SelectTrigger className="bg-midnight-light border-gray-700 text-white">
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                          <SelectContent className="bg-midnight-dark border-gray-700">
                            <SelectItem value="everyone" className="text-white">Show to Everyone</SelectItem>
                            <SelectItem value="hide_from" className="text-white">Hide From...</SelectItem>
                            <SelectItem value="only_selected" className="text-white">Only Selected Contacts</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(visibilityType === 'hide_from' || visibilityType === 'only_selected') && (
                        <div>
                          <Label className="text-gray-400 text-sm mb-2 block">
                            {visibilityType === 'hide_from' ? 'Hide from these contacts:' : 'Show only to these contacts:'}
                          </Label>
                          <div className="max-h-40 overflow-y-auto bg-midnight-light rounded-lg p-2 space-y-1">
                            {contacts.map((contact) => (
                              <div
                                key={contact.id}
                                className="flex items-center gap-2 p-2 hover:bg-gray-700/50 rounded cursor-pointer"
                                onClick={() => toggleContactSelection(contact.name)}
                              >
                                <Checkbox 
                                  checked={selectedContacts.includes(contact.name)}
                                  className="border-gray-600"
                                />
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={contact.profileImage} />
                                  <AvatarFallback className="bg-gray-700 text-xs">
                                    {contact.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-white">{contact.name}</span>
                              </div>
                            ))}
                            {contacts.length === 0 && (
                              <p className="text-gray-500 text-sm text-center py-2">No contacts found</p>
                            )}
                          </div>
                          {selectedContacts.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {selectedContacts.length} contact(s) selected
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-800 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
              className="border-gray-700 text-white hover:bg-midnight-light"
              data-testid="button-cancel-story"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStory}
              disabled={createStoryMutation.isPending || (mediaType === 'text' && !storyContent.trim()) || (mediaType === 'image' && !storyImage)}
              className="bg-swapgreen hover:bg-swapgreen/90 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-post-story"
            >
              {createStoryMutation.isPending ? 'Posting...' : 'Post Story'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-transparent border-0 max-w-md p-0 overflow-hidden" aria-describedby="story-viewer-description">
          <DialogDescription id="story-viewer-description" className="sr-only">
            Story viewer - View stories from your contacts
          </DialogDescription>
          {currentStory && (
            <div className="relative h-[600px]">
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-10 w-10 border-2 border-white">
                      <AvatarImage src={currentStory.profileImage} alt={currentStory.username} />
                      <AvatarFallback className="bg-midnight-light text-white">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-white font-medium text-sm">{currentStory.username}</p>
                        {currentStory.closeFriendsOnly && (
                          <Star className="h-3 w-3 text-green-400" />
                        )}
                      </div>
                      <p className="text-gray-300 text-xs">
                        {format(new Date(currentStory.createdAt), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {currentStory.isOwnStory && (
                      <button
                        onClick={() => setShowViewers(!showViewers)}
                        className="bg-black/30 hover:bg-black/50 rounded-full px-3 py-2 text-white flex items-center gap-1"
                        data-testid="button-show-viewers"
                      >
                        <Eye className="h-5 w-5" />
                        <span className="text-sm">{totalViewCount || currentStory.viewCount}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setIsViewOpen(false)}
                      className="bg-black/30 hover:bg-black/50 rounded-full p-2 text-white"
                      data-testid="button-close-story"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="flex space-x-1 mt-2">
                  {currentStoryGroup.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-0.5 flex-1 rounded-full ${
                        idx === currentStoryIndex ? 'bg-white' : idx < currentStoryIndex ? 'bg-gray-400' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {currentStory.mediaType === 'image' && currentStory.image ? (
                <div
                  onClick={handleNextStory}
                  className="absolute inset-0 cursor-pointer"
                >
                  <img 
                    src={currentStory.image} 
                    alt="Story"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  onClick={handleNextStory}
                  className="absolute inset-0 flex items-center justify-center p-8 cursor-pointer"
                  style={{ backgroundColor: currentStory.backgroundColor }}
                >
                  <p 
                    className="text-xl text-center break-words max-w-full font-medium"
                    style={{ color: getTextColor(currentStory.backgroundColor) }}
                  >
                    {currentStory.content}
                  </p>
                </div>
              )}

              {currentStoryIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevStory();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 rounded-full p-2 text-white z-20"
                  data-testid="button-prev-story"
                >
                  ‹
                </button>
              )}

              {showViewers && currentStory.isOwnStory && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-4 max-h-64 overflow-y-auto">
                  <h3 className="text-white font-medium mb-3">Viewers ({totalViewCount || currentStory.viewCount})</h3>
                  {groupedViewers.length > 0 ? (
                    <div className="space-y-2">
                      {groupedViewers.map((viewer) => (
                        <Collapsible 
                          key={viewer.id}
                          open={expandedViewers.has(viewer.id)}
                          onOpenChange={() => toggleViewerExpanded(viewer.id)}
                        >
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between py-2 px-2 hover:bg-gray-800/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={viewer.profileImage} />
                                  <AvatarFallback className="bg-gray-700 text-xs">
                                    {viewer.username.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-white text-sm">
                                  {viewer.username} {viewer.viewCount > 1 && <span className="text-gray-400">({viewer.viewCount})</span>}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-xs">
                                  {format(new Date(viewer.timestamps[0]), 'h:mm a')}
                                </span>
                                {viewer.viewCount > 1 && (
                                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedViewers.has(viewer.id) ? 'rotate-180' : ''}`} />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          {viewer.viewCount > 1 && (
                            <CollapsibleContent>
                              <div className="pl-12 space-y-1 pb-2">
                                {viewer.timestamps.map((ts, idx) => (
                                  <div key={idx} className="text-xs text-gray-500">
                                    View {idx + 1}: {format(new Date(ts), 'MMM d, h:mm a')}
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          )}
                        </Collapsible>
                      ))}
                    </div>
                  ) : (
                    currentStory.viewers.map((viewer, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                        <span className="text-white text-sm">{viewer.username}</span>
                        <span className="text-gray-400 text-xs">
                          {format(new Date(viewer.viewedAt), 'h:mm a')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
