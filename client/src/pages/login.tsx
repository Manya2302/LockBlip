import { Link } from "wouter";
import AuthLayout from "@/components/AuthLayout";
import LoginForm from "@/components/LoginForm";

interface LoginProps {
  onAuthenticated: (token: string, user: any) => void;
}

export default function Login({ onAuthenticated }: LoginProps) {
  return (
    <AuthLayout>
      <LoginForm onSuccess={onAuthenticated} />
      
      <div className="mt-4 text-center text-sm">
        <span className="text-muted-foreground">Don't have an account? </span>
        <Link href="/register" className="text-primary hover:underline font-medium" data-testid="link-register">
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
}
