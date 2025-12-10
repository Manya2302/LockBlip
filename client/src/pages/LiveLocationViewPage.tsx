import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  ArrowLeft, 
  Radio, 
  AlertTriangle, 
  ExternalLink,
  Loader2,
  Clock
} from "lucide-react";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
}

interface SessionData {
  sessionId: string;
  sharer: string;
  currentLocation: LocationData | null;
  routeHistory: { lat: number; lng: number; time: string }[];
  movementSpeed: number;
  startedAt: string;
  expiryAt: string;
  lastUpdate: string;
}

export default function LiveLocationViewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchLocation();
      intervalRef.current = setInterval(fetchLocation, 10000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session?.expiryAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(session.expiryAt);
      const diff = expiry.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining("Expired");
        setError("Location sharing has ended");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")} remaining`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session?.expiryAt]);

  const fetchLocation = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/live-location/view/${sessionId}`, {
        headers,
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data);
        setError(null);
      } else if (response.status === 410) {
        setError("Location sharing has ended");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } else if (response.status === 403) {
        setError("You are not authorized to view this location");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } else if (response.status === 404) {
        setError("Location session not found");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to load location");
      }
    } catch (err) {
      console.error("Failed to fetch location:", err);
      setError("Failed to load location data");
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = () => {
    if (!session?.currentLocation) return;
    const { latitude, longitude } = session.currentLocation;
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, "_blank");
  };

  const formatLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    return date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading live location...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button
          variant="ghost"
          onClick={() => setLocation("/home")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="bg-gray-800 border-gray-700 p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Location</h2>
          <p className="text-gray-400">{error}</p>
          <Button
            onClick={() => setLocation("/home")}
            className="mt-4"
          >
            Return Home
          </Button>
        </Card>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/home")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Radio className="h-5 w-5 text-green-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                </div>
                <h1 className="text-lg font-semibold text-white">
                  {session.sharer}'s Live Location
                </h1>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="h-3 w-3" />
                <span>{timeRemaining}</span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openInGoogleMaps}
            className="border-green-500/50 text-green-400 hover:bg-green-500/20"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Maps
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="bg-gray-800 border-gray-700 overflow-hidden">
          <div 
            className="h-64 bg-gradient-to-br from-green-900/30 to-gray-900 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
            onClick={openInGoogleMaps}
          >
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <MapPin className="h-10 w-10 text-green-400" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Radio className="h-3 w-3 text-white" />
                </span>
              </div>
              {session.currentLocation && (
                <>
                  <p className="text-white font-medium mb-1">
                    {session.currentLocation.latitude.toFixed(6)}, {session.currentLocation.longitude.toFixed(6)}
                  </p>
                  {session.currentLocation.accuracy && (
                    <p className="text-xs text-gray-400">
                      Accuracy: ~{Math.round(session.currentLocation.accuracy)}m
                    </p>
                  )}
                </>
              )}
              <p className="text-sm text-green-400 mt-2">Tap to open in Google Maps</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-800 border-gray-700 p-4">
            <p className="text-xs text-gray-400 mb-1">Movement Speed</p>
            <p className="text-2xl font-bold text-white">
              {session.movementSpeed > 0 ? `${session.movementSpeed.toFixed(1)} km/h` : "Stationary"}
            </p>
          </Card>
          <Card className="bg-gray-800 border-gray-700 p-4">
            <p className="text-xs text-gray-400 mb-1">Last Update</p>
            <p className="text-2xl font-bold text-white">
              {session.lastUpdate ? formatLastUpdate(session.lastUpdate) : "N/A"}
            </p>
          </Card>
        </div>

        {session.routeHistory && session.routeHistory.length > 1 && (
          <Card className="bg-gray-800 border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-400" />
              Route History
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {session.routeHistory.slice(-10).reverse().map((point, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-gray-700/50 px-3 py-2 rounded">
                  <span className="text-gray-300">
                    {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                  </span>
                  <span className="text-gray-500">
                    {new Date(point.time).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {session.routeHistory.length} points tracked
            </p>
          </Card>
        )}

        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Started at</span>
            <span className="text-white">
              {new Date(session.startedAt).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-400">Expires at</span>
            <span className="text-white">
              {new Date(session.expiryAt).toLocaleString()}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
