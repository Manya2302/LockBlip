import { Link } from "wouter";
import AuthLayout from "@/components/AuthLayout";
import RegistrationForm from "@/components/RegistrationForm";

interface RegisterProps {
  onAuthenticated: (token: string, user: any) => void;
}

export default function Register({ onAuthenticated }: RegisterProps) {
  return (
    <AuthLayout 
      title="Create Account" 
      description="Join LockBlip for secure blockchain-powered messaging"
    >
      <RegistrationForm onSuccess={onAuthenticated} />
      
      <div className="mt-4 text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
