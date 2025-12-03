import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface BlockItemProps {
  index: number;
  hash: string;
  prevHash: string;
  timestamp: string;
  from: string;
  to: string;
  payload?: string;
}

export default function BlockItem({
  index,
  hash,
  prevHash,
  timestamp,
  from,
  to,
  payload,
}: BlockItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div className="relative" data-testid={`block-item-${index}`}>
      {index > 0 && (
        <div className="absolute left-4 -top-3 h-3 w-px bg-primary/30" />
      )}
      
      <Card className="p-4 hover-elevate cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-mono font-bold text-primary">
              {index}
            </span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Block #{index}</span>
                {index > 0 && <Link2 className="h-3 w-3 text-primary" />}
              </div>
              <span className="text-xs text-muted-foreground">{timestamp}</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Hash:</span>
                <code className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                  {truncateHash(hash)}
                </code>
              </div>
              
              {isExpanded && (
                <div className="space-y-2 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Prev Hash:</span>
                    <code className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                      {prevHash === "0" ? "Genesis" : truncateHash(prevHash)}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">From:</span>
                    <span className="text-xs font-medium">{from}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">To:</span>
                    <span className="text-xs font-medium">{to}</span>
                  </div>
                  {payload && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground block mb-1">Payload:</span>
                      <p className="text-xs bg-muted/50 p-2 rounded">{payload}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <button
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-expand-${index}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </Card>
      
      {index < 999 && (
        <div className="absolute left-4 bottom-0 h-3 w-px bg-primary/30" />
      )}
    </div>
  );
}
