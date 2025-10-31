import { useState } from "react";
import { GoogleLogin } from '@react-oauth/google';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, Key, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

interface RegistrationFormProps {
  onSuccess: (token: string, user: any) => void;
}

export default function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    phone: "",
    dateOfBirth: "",
    username: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });

  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const checkUsername = async () => {
    try {
      const response = await apiRequest('POST', '/api/auth/check-username', { username: formData.username });
      const data = await response.json();
      return data.available;
    } catch (err: any) {
      throw new Error(err.message || "Failed to check username");
    }
  };

  const sendOTP = async () => {
    setIsLoading(true);
    setError("");
    try {
      await apiRequest('POST', '/api/auth/send-otp', {
        email: formData.email,
        fullName: formData.fullName,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
      });
      setSuccess("OTP sent to your email!");
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async () => {
    setIsLoading(true);
    setError("");
    try {
      await apiRequest('POST', '/api/auth/verify-otp', {
        email: formData.email,
        otp: formData.otp,
      });
      setSuccess("Email verified!");
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const createAccount = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const usernameAvailable = await checkUsername();
      if (!usernameAvailable) {
        setError("Username already taken");
        setIsLoading(false);
        return;
      }

      setSuccess("Generating encryption keys...");
      const keyPair = nacl.box.keyPair();
      const publicKey = naclUtil.encodeBase64(keyPair.publicKey);
      const privateKey = naclUtil.encodeBase64(keyPair.secretKey);
      
      setKeys({ publicKey, privateKey });

      const response = await apiRequest('POST', '/api/auth/register', {
        username: formData.username,
        password: formData.password,
        email: formData.email,
        fullName: formData.fullName,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        publicKey,
        privateKey,
      });

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('privateKey', privateKey);
      localStorage.setItem('user', JSON.stringify({ ...data.user, privateKey }));
      window.dispatchEvent(new Event('user-logged-in'));
      onSuccess(data.token, { ...data.user, privateKey });
    } catch (err: any) {
      setSuccess("");
      const errorMessage = err.message || "Registration failed";
      if (errorMessage.includes("Email not verified")) {
        setError("Email verification expired. Please start registration again.");
        setTimeout(() => setStep(1), 3000);
      } else if (errorMessage.includes("errors")) {
        setError("Invalid registration data. Please check all fields.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.fullName || !formData.phone || !formData.dateOfBirth) {
      setError("Please fill all fields");
      return;
    }
    sendOTP();
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.otp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }
    verifyOTP();
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || formData.username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    createAccount();
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
      console.error('Google signup error:', error);
      setError(error.message || 'Failed to authenticate with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google authentication failed');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`h-2 w-2 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
      </div>

      {error && (
        <Alert variant="destructive" data-testid="alert-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-primary/50 bg-primary/10" data-testid="alert-success">
          <Check className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">{success}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="your.email@example.com"
              required
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              placeholder="John Doe"
              required
              data-testid="input-fullName"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 234 567 8900"
              required
              data-testid="input-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => updateField('dateOfBirth', e.target.value)}
              required
              data-testid="input-dateOfBirth"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-send-otp">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Verification Code
              </>
            )}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="flex justify-center" data-testid="google-register-button">
            {isGoogleLoading ? (
              <Button disabled className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing up with Google...
              </Button>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                size="large"
                width="400"
                text="signup_with"
              />
            )}
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2Submit} className="space-y-4">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">
              We've sent a 6-digit code to <strong>{formData.email}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              id="otp"
              type="text"
              value={formData.otp}
              onChange={(e) => updateField('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              required
              className="text-center text-2xl tracking-widest"
              data-testid="input-otp"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-verify-otp">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStep(1)}
            data-testid="button-back"
          >
            Back
          </Button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleStep3Submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => updateField('username', e.target.value)}
              placeholder="username"
              required
              data-testid="input-username"
            />
            <p className="text-xs text-muted-foreground">
              3-20 characters, letters, numbers, and underscores only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="••••••••"
              required
              data-testid="input-password"
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              placeholder="••••••••"
              required
              data-testid="input-confirmPassword"
            />
          </div>

          <div className="bg-primary/10 border border-primary/50 rounded-md p-3 text-sm space-y-2">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Key className="h-4 w-4" />
              <span>Encryption Keys - Important</span>
            </div>
            <p className="text-muted-foreground">
              Your encryption keys will be generated automatically and stored securely on this device only. 
              To access your messages from another device, you'll need to register a new account or back up your keys.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-create-account">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
