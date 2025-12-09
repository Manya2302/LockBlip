import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronUp, History, X, Loader2 } from "lucide-react";

interface Summary {
  id: string;
  text: string;
  messageCount: number;
  keywords: string[];
  createdAt: string;
}

interface AISummaryCardProps {
  contactUsername: string;
  onDismiss?: () => void;
}

export function AISummaryCard({ contactUsername, onDismiss }: AISummaryCardProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<Summary[]>([]);

  useEffect(() => {
    fetchLatestSummary();
  }, [contactUsername]);

  const fetchLatestSummary = async () => {
    try {
      const response = await fetch(`/api/chat-summary/latest/${contactUsername}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/chat-summary/history/${contactUsername}?limit=5`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setHistoryList(data.summaries || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const handleMarkAsRead = async () => {
    if (!summary) return;
    
    try {
      await fetch(`/api/chat-summary/read/${summary.id}`, {
        method: 'PUT',
        credentials: 'include',
      });
      setSummary(null);
      onDismiss?.();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleShowHistory = async () => {
    if (!showHistory) {
      await fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  if (!summary && !showHistory) {
    return null;
  }

  return (
    <Card className="mx-4 my-2 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30 overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">AI Summary</span>
            {summary && (
              <span className="text-xs text-gray-400">
                ({summary.messageCount} messages)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowHistory}
              className="h-7 px-2 text-gray-400 hover:text-white"
            >
              <History className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 px-2 text-gray-400 hover:text-white"
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            {summary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAsRead}
                className="h-7 px-2 text-gray-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {isExpanded && summary && (
          <div className="space-y-2">
            <p className="text-sm text-gray-200 leading-relaxed">
              {summary.text}
            </p>
            {summary.keywords && summary.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {summary.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Generated {new Date(summary.createdAt).toLocaleString()}
            </p>
          </div>
        )}

        {showHistory && (
          <div className="mt-3 pt-3 border-t border-purple-500/20">
            <h4 className="text-xs font-medium text-gray-400 mb-2">Previous Summaries</h4>
            {historyList.length === 0 ? (
              <p className="text-xs text-gray-500">No previous summaries</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {historyList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-gray-800/50 rounded text-xs"
                  >
                    <p className="text-gray-300 line-clamp-2">{item.text}</p>
                    <p className="text-gray-500 mt-1">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

interface AISummarizeButtonProps {
  contactUsername: string;
  unreadCount: number;
  onSummaryGenerated?: (summary: Summary) => void;
}

export function AISummarizeButton({ contactUsername, unreadCount, onSummaryGenerated }: AISummarizeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [threshold, setThreshold] = useState(7);

  useEffect(() => {
    checkEligibility();
  }, [contactUsername, unreadCount]);

  const checkEligibility = async () => {
    try {
      const response = await fetch(`/api/chat-summary/check/${contactUsername}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setShowButton(data.showSummarizeButton);
        setThreshold(data.threshold);
      }
    } catch (error) {
      console.error('Failed to check eligibility:', error);
      setShowButton(false);
    }
  };

  const handleSummarize = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat-summary/generate/${contactUsername}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ includeAll: false }),
      });
      
      if (response.ok) {
        const data = await response.json();
        onSummaryGenerated?.(data.summary);
        setShowButton(false);
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!showButton) {
    return null;
  }

  return (
    <Button
      onClick={handleSummarize}
      disabled={isLoading}
      className="fixed bottom-24 right-4 z-40 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg rounded-full px-4 py-2"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Sparkles className="w-4 h-4 mr-2" />
      )}
      Summarize Chat
    </Button>
  );
}
