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
  initialSummary?: Summary | null;
}

export function AISummaryCard({ contactUsername, onDismiss, initialSummary }: AISummaryCardProps) {
  const [summary, setSummary] = useState<Summary | null>(initialSummary || null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<Summary[]>([]);

  useEffect(() => {
    if (initialSummary) {
      setSummary(initialSummary);
    } else {
      fetchLatestSummary();
    }
  }, [contactUsername, initialSummary]);

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
  const [aiAvailable, setAiAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check eligibility when contact changes
  useEffect(() => {
    setShowButton(false);
    checkEligibility();
  }, [contactUsername]);

  // Show button based on local unread count (primary mechanism)
  // This uses the initial unread count captured before messages are marked as seen
  useEffect(() => {
    if (unreadCount >= threshold && aiAvailable) {
      console.log('📊 AI Summary: Showing button based on unread count:', unreadCount, 'threshold:', threshold);
      setShowButton(true);
    }
  }, [unreadCount, threshold, aiAvailable]);

  const checkEligibility = async () => {
    try {
      // First check if AI is available
      const statusResponse = await fetch('/api/chat-summary/status', {
        credentials: 'include',
      });
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setAiAvailable(statusData.available);
        setThreshold(statusData.unreadThreshold || 7);
        
        if (!statusData.available) {
          setShowButton(false);
          return;
        }
      }
      
      // Then check for this specific contact
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
    setError(null);
    try {
      const response = await fetch(`/api/chat-summary/generate/${contactUsername}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ includeAll: false }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        onSummaryGenerated?.(data.summary);
        setShowButton(false);
        setError(null);
      } else {
        const errorMessage = data.error || 'Failed to generate summary';
        setError(errorMessage);
        console.error('Summary generation failed:', errorMessage);
        
        // Auto-hide error after 5 seconds
        setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError('Network error. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!showButton && !error) {
    return null;
  }

  return (
    <div className="absolute bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {error && (
        <div className="bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs animate-in fade-in slide-in-from-bottom-2">
          {error}
        </div>
      )}
      {showButton && (
        <Button
          onClick={handleSummarize}
          disabled={isLoading}
          size="sm"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg rounded-full h-10 px-3 flex items-center gap-2 transition-all duration-300 hover:scale-105"
          title="Summarize unread messages with AI"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-white" />
            )}
          </div>
          <span className="text-xs font-medium">Summarize</span>
        </Button>
      )}
    </div>
  );
}
