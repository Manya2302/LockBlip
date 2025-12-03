import { useState } from "react";
import { GoogleLogin } from '@react-oauth/google';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, AlertCircle, Mail, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [ipAuthRequired, setIpAuthRequired] = useState(false);
  
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [isResetLoading, setIsResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setError("");
    setIpAuthRequired(false);

    try {
      const response = await apiRequest('POST', '/api/auth/login', {
        username,
        password,
      });

      const data = await response.json();
      
      console.log('✅ Login successful');
      console.log('User data from server:', data.user);
      console.log('PrivateKey exists in response:', !!data.user.privateKey);
      console.log('PublicKey exists in response:', !!data.user.publicKey);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('privateKey', data.user.privateKey);
      
      console.log('✅ Stored user data in localStorage');
      
      window.dispatchEvent(new Event('user-logged-in'));
      
      onSuccess(data.token, data.user);
    } catch (err: any) {
      const errorMessage = err.message || "";
      if (errorMessage.includes('IP_AUTHORIZATION_REQUIRED') || errorMessage.includes('New device detected')) {
        setIpAuthRequired(true);
        setError("New device detected. Check your email to authorize this device.");
      } else {
        setError(err.message || "Invalid credentials");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");

    try {
      const response = await apiRequest('POST', '/api/auth/forgot-password', {
        email: forgotEmail,
      });

      const data = await response.json();
      setForgotSuccess(data.message || "Password reset code sent to your email");
      setTimeout(() => {
        setShowForgotPassword(false);
        setShowResetPassword(true);
        setForgotSuccess("");
      }, 2000);
    } catch (err: any) {
      setForgotError(err.message || "Failed to send reset code");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotEmail || !forgotEmail.trim()) {
      setResetError("Email address is missing. Please start over.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters");
      return;
    }

    setIsResetLoading(true);
    setResetError("");
    setResetSuccess("");

    try {
      const response = await apiRequest('POST', '/api/auth/reset-password', {
        email: forgotEmail.trim(),
        otp: resetOtp,
        newPassword,
      });

      const data = await response.json();
      setResetSuccess(data.message || "Password reset successfully");
      setTimeout(() => {
        setShowResetPassword(false);
        setResetOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setForgotEmail("");
        setResetSuccess("");
      }, 2000);
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password");
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setIsGoogleLoading(true);
      setError("");
      const response = await apiRequest('POST', '/api/auth/google', {
        credential: credentialResponse.credential,
      });

      const data = await response.json();

      if (response.ok && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        localStorage.setItem('privateKey', data.user.privateKey);
        window.dispatchEvent(new Event('user-logged-in'));
        onSuccess(data.token, data.user);
      } else {
        setError(data.error || 'Failed to authenticate with Google');
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      const errorMessage = error.message || "";
      if (errorMessage.includes('IP_NOT_AUTHORIZED') || errorMessage.includes('New device detected')) {
        setIpAuthRequired(true);
        setError("New device detected. Check your email to authorize this device.");
      } else {
        setError('Failed to authenticate with Google');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google authentication failed');
  };

  return (
    <>
      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <Alert variant={ipAuthRequired ? "default" : "destructive"} data-testid="alert-error">
            {ipAuthRequired ? (
              <Mail className="h-4 w-4 text-primary" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className={ipAuthRequired ? "text-primary" : ""}>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="login-username">Username</Label>
          <Input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            placeholder="Enter your username"
            required
            disabled={isLoading}
            data-testid="input-login-username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Enter your password"
            required
            disabled={isLoading}
            data-testid="input-login-password"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
          data-testid="button-login"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </Button>

        {ipAuthRequired && (
          <div className="bg-primary/10 border border-primary/50 rounded-md p-4 text-sm">
            <p className="font-semibold text-primary mb-1">New Device Detected</p>
            <p className="text-muted-foreground">
              For security, we've sent an authorization link to your email. Click the link to authorize this device, then try logging in again.
            </p>
          </div>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-muted" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="flex justify-center" data-testid="google-login-button">
          {isGoogleLoading ? (
            <Button disabled className="w-full">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in with Google...
            </Button>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              size="large"
              width="400"
              text="signin_with"
            />
          )}
        </div>

        <div className="text-center mt-4">
          <Button
            type="button"
            variant="ghost"
            className="text-sm text-primary hover:underline p-0 h-auto"
            onClick={() => setShowForgotPassword(true)}
            data-testid="link-forgot-password"
          >
            Forgot password?
          </Button>
        </div>
      </form>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent data-testid="dialog-forgot-password">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Forgot Password
            </DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a code to reset your password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            {forgotError && (
              <Alert variant="destructive" data-testid="alert-forgot-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{forgotError}</AlertDescription>
              </Alert>
            )}

            {forgotSuccess && (
              <Alert data-testid="alert-forgot-success">
                <Mail className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">{forgotSuccess}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email Address</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isForgotLoading}
                data-testid="input-forgot-email"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isForgotLoading}
              data-testid="button-send-reset-code"
            >
              {isForgotLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Code"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent data-testid="dialog-reset-password">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to your email and your new password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
            {resetError && (
              <Alert variant="destructive" data-testid="alert-reset-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{resetError}</AlertDescription>
              </Alert>
            )}

            {resetSuccess && (
              <Alert data-testid="alert-reset-success">
                <Mail className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">{resetSuccess}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-otp">Verification Code</Label>
              <Input
                id="reset-otp"
                type="text"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
                disabled={isResetLoading}
                data-testid="input-reset-otp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                disabled={isResetLoading}
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                disabled={isResetLoading}
                data-testid="input-confirm-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isResetLoading}
              data-testid="button-reset-password"
            >
              {isResetLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
