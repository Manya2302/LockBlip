import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoginForm from "./LoginForm";
import RegistrationForm from "./RegistrationForm";
import heroImage from '@assets/generated_images/Blockchain_network_hero_image_243b3dd4.png';
import lockblipLogo from "@assets/Untitled design_1761899121550.png";

interface AuthPageProps {
  onAuthenticated: (token: string, user: any) => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [activeTab, setActiveTab] = useState("login");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(rgba(11, 16, 32, 0.85), rgba(27, 31, 58, 0.85)), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      <Card className="w-full max-w-md relative z-10 border-primary/20 bg-card/80 backdrop-blur-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <img src={lockblipLogo} alt="LockBlip" className="h-16 w-16 object-contain rounded-2xl shadow-lg" />
          </div>
          <CardTitle className="text-3xl font-bold">LockBlip</CardTitle>
          <CardDescription>
            Blockchain-powered secure messaging with end-to-end encryption
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <LoginForm onSuccess={onAuthenticated} />
            </TabsContent>
            
            <TabsContent value="register">
              <RegistrationForm onSuccess={onAuthenticated} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
