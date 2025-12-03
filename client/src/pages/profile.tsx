import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Save, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ProfileManagementProps {
  onBack: () => void;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone: string;
  fullName: string;
  dateOfBirth: string;
  description: string;
  profileImage: string;
  createdAt: string;
}

export default function ProfileManagement({ onBack }: ProfileManagementProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    description: '',
    profileImage: '',
  });

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/users/profile'],
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth,
        description: profile.description || '',
        profileImage: profile.profileImage || '',
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await apiRequest('PUT', '/api/users/profile', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/profile'] });
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const compressImage = (file: File, maxWidth: number = 400, quality: number = 0.7): Promise<string> => {
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
        const compressed = await compressImage(file, 400, 0.7);
        setFormData(prev => ({ ...prev, profileImage: compressed }));
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to process image. Please try another one.",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#0a0f1e] via-[#0d1423] to-[#0a0f1e]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-swapgreen border-t-transparent mx-auto mb-4" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#0a0f1e] via-[#0d1423] to-[#0a0f1e]">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Failed to load profile</p>
          <Button
            onClick={onBack}
            className="bg-swapgreen hover:bg-swapgreen/90 text-black"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const joinedDate = profile.createdAt ? format(new Date(profile.createdAt), 'MMMM dd, yyyy') : 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1423] to-[#0a0f1e]">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-swapgreen hover:text-swapgreen/80"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </Button>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-swapgreen hover:bg-swapgreen/90 text-white"
              data-testid="button-edit-profile"
            >
              Edit Profile
            </Button>
          )}
        </div>

        <Card className="bg-midnight-dark border-gray-800">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Profile Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-swapgreen">
                  <AvatarImage src={formData.profileImage || profile.profileImage} alt={profile.username} />
                  <AvatarFallback className="bg-midnight-light text-white text-3xl">
                    <User className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label
                    htmlFor="profile-image"
                    className="absolute bottom-0 right-0 bg-swapgreen hover:bg-swapgreen/90 text-black rounded-full p-2 cursor-pointer"
                  >
                    <Camera className="h-5 w-5" />
                    <input
                      id="profile-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      data-testid="input-profile-image"
                    />
                  </label>
                )}
              </div>
              <h2 className="text-xl font-semibold text-white" data-testid="text-username">
                @{profile.username}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-gray-400">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  disabled={!isEditing}
                  className="bg-midnight-light border-gray-700 text-white disabled:opacity-70"
                  data-testid="input-fullname"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-400">
                  Username
                </Label>
                <Input
                  id="username"
                  value={profile.username}
                  disabled
                  className="bg-midnight-light border-gray-700 text-white disabled:opacity-70"
                  data-testid="input-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-400">
                  Email
                </Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-midnight-light border-gray-700 text-white disabled:opacity-70"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-400">
                  Mobile Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!isEditing}
                  className="bg-midnight-light border-gray-700 text-white disabled:opacity-70"
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="text-gray-400">
                  Date of Birth
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  disabled={!isEditing}
                  className="bg-midnight-light border-gray-700 text-white disabled:opacity-70"
                  data-testid="input-dob"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinedDate" className="text-gray-400">
                  Joined Date
                </Label>
                <Input
                  id="joinedDate"
                  value={joinedDate}
                  disabled
                  className="bg-midnight-light border-gray-700 text-white disabled:opacity-70"
                  data-testid="text-joined-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-400">
                About
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                disabled={!isEditing}
                placeholder="Tell others about yourself..."
                className="bg-midnight-light border-gray-700 text-white disabled:opacity-70 min-h-[100px]"
                data-testid="textarea-description"
              />
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      fullName: profile.fullName,
                      phone: profile.phone,
                      dateOfBirth: profile.dateOfBirth,
                      description: profile.description || '',
                      profileImage: profile.profileImage || '',
                    });
                  }}
                  className="border-gray-700 text-white hover:bg-midnight-light"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="bg-swapgreen hover:bg-swapgreen/90 text-black"
                  data-testid="button-save"
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
