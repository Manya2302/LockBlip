import { Route, Switch, useLocation, Redirect } from "wouter";
import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

function Router() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const checkAuthStatus = () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      const shouldBeAuthenticated = !!(token && user);
      
      if (shouldBeAuthenticated !== isAuthenticated) {
        console.log('🔄 Authentication status changed:', shouldBeAuthenticated);
        setIsAuthenticated(shouldBeAuthenticated);
        
        if (shouldBeAuthenticated) {
          console.log('✅ User logged in - clearing old cache');
          queryClient.clear();
        }
      }
    };

    window.addEventListener('storage', checkAuthStatus);
    const interval = setInterval(checkAuthStatus, 500);

    return () => {
      window.removeEventListener('storage', checkAuthStatus);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const handleIPNotAuthorized = (event: any) => {
      const message = event.detail?.message || 'Your IP address has changed. Please log in again.';
      toast({
        title: "Authentication Required",
        description: message,
        variant: "destructive",
      });
      handleLogout();
    };

    window.addEventListener('ip-not-authorized', handleIPNotAuthorized);
    return () => window.removeEventListener('ip-not-authorized', handleIPNotAuthorized);
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setLocation("/");
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    console.log('🧹 Clearing all application state on logout...');
    queryClient.clear();
    console.log('✅ React Query cache cleared');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('privateKey');
    setIsAuthenticated(false);
    setLocation("/login");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const currentUser = localStorage.getItem('user');
  const userId = currentUser ? JSON.parse(currentUser).id : null;

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? (
          <Home key={userId} onLogout={handleLogout} />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      
      <Route path="/login">
        {isAuthenticated ? (
          <Redirect to="/" />
        ) : (
          <Login onAuthenticated={handleAuthenticated} />
        )}
      </Route>
      
      <Route path="/register">
        {isAuthenticated ? (
          <Redirect to="/" />
        ) : (
          <Register onAuthenticated={handleAuthenticated} />
        )}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
