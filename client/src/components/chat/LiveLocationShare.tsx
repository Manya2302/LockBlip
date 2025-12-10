import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Clock, 
  AlertTriangle, 
  X, 
  Navigation, 
  Radio,
  Loader2,
  StopCircle 
} from "lucide-react";

interface LiveLocationPreset {
  key: string;
  label: string;
  duration: number;
}

interface LiveLocationSession {
  sessionId: string;
  expiryAt: string;
  chatRoomId: string;
  updateInterval: number;
}

interface LiveLocationShareProps {
  targetUsername: string;
  onClose: () => void;
  onSessionStarted?: (session: LiveLocationSession) => void;
}

export function LiveLocationShare({ targetUsername, onClose, onSessionStarted }: LiveLocationShareProps) {
  const [presets, setPresets] = useState<LiveLocationPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('15min');
  const [customDuration, setCustomDuration] = useState<number>(30);
  const [useCustom, setUseCustom] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const response = await fetch('/api/live-location/presets', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPresets(data.presets);
        setError(null);
      } else {
        console.warn('Failed to fetch presets, using defaults');
        setPresets([
          { key: '15min', label: '15 minutes', duration: 15 * 60 * 1000 },
          { key: '1hour', label: '1 hour', duration: 60 * 60 * 1000 },
          { key: '8hours', label: '8 hours', duration: 8 * 60 * 60 * 1000 },
        ]);
        setError(null);
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error);
      setPresets([
        { key: '15min', label: '15 minutes', duration: 15 * 60 * 1000 },
        { key: '1hour', label: '1 hour', duration: 60 * 60 * 1000 },
        { key: '8hours', label: '8 hours', duration: 8 * 60 * 60 * 1000 },
      ]);
      setError(null);
    }
  };

  const handleStartSharing = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const body: any = {
        targetUsername,
        initialLocation: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
        },
      };

      if (useCustom) {
        body.customDuration = customDuration * 60 * 1000;
      } else {
        body.expiryPreset = selectedPreset;
      }

      console.log('📍 Starting location sharing request...');
      console.log('📍 Request body:', body);
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/live-location/start', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });

      console.log('📍 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📍 Location sharing started successfully:', data);
        onSessionStarted?.(data.session);
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        console.log('📍 Error response:', errData);
        console.log('📍 Response status code:', response.status);
        
        if (response.status === 401) {
          console.error('📍 401 Unauthorized - Token may be missing or expired');
          setError('Please log in again to share your location.');
        } else if (response.status === 403) {
          if (errData.error === 'IP_NOT_AUTHORIZED') {
            setError('New device detected. Please check your email to authorize this device.');
          } else {
            setError('Access denied. Please try logging in again.');
          }
        } else {
          setError(errData.error || 'Failed to start location sharing. Please try again.');
        }
      }
    } catch (error: any) {
      if (error.code === 1) {
        setError('Location permission denied. Please enable location access.');
      } else if (error.code === 2) {
        setError('Unable to determine your location. Please try again.');
      } else if (error.code === 3) {
        setError('Location request timed out. Please try again.');
      } else {
        setError('Failed to start location sharing');
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 w-72">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-green-400" />
          <h3 className="text-white font-semibold">Share Live Location</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Share your live location with {targetUsername}
      </p>

      <div className="space-y-2 mb-4">
        {presets.map((preset) => (
          <button
            key={preset.key}
            onClick={() => {
              setSelectedPreset(preset.key);
              setUseCustom(false);
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              !useCustom && selectedPreset === preset.key
                ? 'bg-green-600/20 border border-green-500/50'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Clock className="w-4 h-4 text-green-400" />
            <span className="text-white">{preset.label}</span>
          </button>
        ))}
        
        <button
          onClick={() => setUseCustom(true)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
            useCustom
              ? 'bg-green-600/20 border border-green-500/50'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <Clock className="w-4 h-4 text-green-400" />
          <span className="text-white">Custom duration</span>
        </button>
      </div>

      {useCustom && (
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">
            Duration (minutes)
          </label>
          <input
            type="number"
            min={5}
            max={1440}
            value={customDuration}
            onChange={(e) => setCustomDuration(parseInt(e.target.value) || 30)}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      <Button
        onClick={handleStartSharing}
        disabled={isStarting}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        {isStarting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Navigation className="w-4 h-4 mr-2" />
        )}
        Start Sharing
      </Button>
    </Card>
  );
}

interface LiveLocationTrackerProps {
  sessionId: string;
  onStop?: () => void;
}

export function LiveLocationTracker({ sessionId, onStop }: LiveLocationTrackerProps) {
  const [isTracking, setIsTracking] = useState(true);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [expiryAt, setExpiryAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [sessionId]);

  useEffect(() => {
    if (!expiryAt) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = expiryAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining('Expired');
        stopTracking();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [expiryAt]);

  const startTracking = () => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCoordinates(newCoords);
        sendLocationUpdate(position);
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const sendLocationUpdate = async (position: GeolocationPosition) => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/live-location/update/${sessionId}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 410) {
          stopTracking();
        }
      }
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  const handleStop = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      await fetch(`/api/live-location/stop/${sessionId}`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
    stopTracking();
    onStop?.();
  };

  if (!isTracking) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-4 z-40">
      <Card className="bg-green-900/90 border-green-500/50 p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio className="w-5 h-5 text-green-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          <div>
            <p className="text-sm text-green-300 font-medium">Sharing Live Location</p>
            {timeRemaining && (
              <p className="text-xs text-green-400/70">{timeRemaining} remaining</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStop}
            className="ml-2 text-red-400 hover:text-red-300 hover:bg-red-500/20"
          >
            <StopCircle className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface LiveLocationViewerProps {
  sessionId: string;
  sharerName: string;
}

export function LiveLocationViewer({ sessionId, sharerName }: LiveLocationViewerProps) {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
  } | null>(null);
  const [route, setRoute] = useState<{ lat: number; lng: number; time: string }[]>([]);
  const [isStationary, setIsStationary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiryAt, setExpiryAt] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchLocation();
    intervalRef.current = setInterval(fetchLocation, 10000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionId]);

  const fetchLocation = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/live-location/view/${sessionId}`, {
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.currentLocation) {
          setLocation(data.currentLocation);
        }
        if (data.routeHistory) {
          setRoute(data.routeHistory);
        }
        if (data.expiryAt) {
          setExpiryAt(new Date(data.expiryAt));
        }
        setError(null);
      } else if (response.status === 410) {
        setError('Location sharing has ended');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    } catch (error) {
      console.error('Failed to fetch location:', error);
    }
  };

  const openInMaps = () => {
    if (!location) return;
    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    window.open(url, '_blank');
  };

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <MapPin className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </Card>
    );
  }

  if (!location) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading location...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700 overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio className="w-4 h-4 text-green-400" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            </div>
            <span className="text-sm text-green-400">{sharerName}'s Live Location</span>
          </div>
          {isStationary && (
            <div className="flex items-center gap-1 text-yellow-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>Stationary</span>
            </div>
          )}
        </div>
      </div>

      <div 
        className="h-40 bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors"
        onClick={openInMaps}
      >
        <div className="text-center">
          <MapPin className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-xs text-gray-400">
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </p>
          <p className="text-xs text-green-400 mt-1">Tap to open in Maps</p>
        </div>
      </div>

      {route.length > 1 && (
        <div className="p-2 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Route: {route.length} points tracked
          </p>
        </div>
      )}
    </Card>
  );
}
