import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Shield } from "lucide-react";
import BlockItem from "./BlockItem";
import BlockchainStatus from "./BlockchainStatus";

interface Block {
  index: number;
  hash: string;
  prevHash: string;
  timestamp: string;
  from: string;
  to: string;
  payload?: string;
}

interface LedgerViewerProps {
  blocks: Block[];
  isValid?: boolean;
}

export default function LedgerViewer({ blocks, isValid = true }: LedgerViewerProps) {
  const handleExport = () => {
    console.log("Exporting blockchain...");
    const dataStr = JSON.stringify(blocks, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockchain-${Date.now()}.json`;
    link.click();
  };

  return (
    <div className="h-full flex flex-col">
      <Card className="border-0 shadow-none flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Blockchain Ledger
              </CardTitle>
              <CardDescription className="mt-1">
                Immutable message history
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <BlockchainStatus
                blockCount={blocks.length - 1}
                isValid={isValid}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                data-testid="button-export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="space-y-0">
            {blocks.map((block) => (
              <BlockItem key={block.index} {...block} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
