import { Shield, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BlockchainStatusProps {
  blockCount: number;
  isValidating?: boolean;
  isValid?: boolean;
  className?: string;
}

export default function BlockchainStatus({
  blockCount,
  isValidating = false,
  isValid = true,
  className,
}: BlockchainStatusProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="blockchain-status">
      <Badge variant="outline" className="font-mono text-xs gap-1.5 bg-card/50 backdrop-blur-xl">
        {isValidating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isValid ? (
          <Shield className="h-3 w-3 text-primary" />
        ) : (
          <Shield className="h-3 w-3 text-destructive" />
        )}
        <span>Block #{blockCount}</span>
        {isValid && !isValidating && (
          <Check className="h-3 w-3 text-primary" data-testid="status-validated" />
        )}
      </Badge>
    </div>
  );
}
