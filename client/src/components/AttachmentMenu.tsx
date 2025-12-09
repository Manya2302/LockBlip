import { useState, useRef, useEffect } from "react";
import { FileText, Camera, Image, Mic, MapPin, User, BarChart3, X, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LiveLocationShare } from "./chat/LiveLocationShare";

interface AttachmentMenuProps {
  onClose: () => void;
  onSendFile: (file: File, type: 'document' | 'image' | 'video' | 'audio') => void;
  onSendLocation: (location: { latitude: number; longitude: number }) => void;
  onSendContact: (contact: { name: string; phone: string; email?: string }) => void;
  onSendPoll: (poll: { question: string; options: string[] }) => void;
  targetUsername?: string;
  onLiveLocationStarted?: (session: any) => void;
}

export default function AttachmentMenu({
  onClose,
  onSendFile,
  onSendLocation,
  onSendContact,
  onSendPoll,
  targetUsername,
  onLiveLocationStarted,
}: AttachmentMenuProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showLiveLocation, setShowLiveLocation] = useState(false);
  
  const documentInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (cameraVideoRef.current && cameraVideoRef.current.srcObject) {
        const stream = cameraVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleDocumentClick = () => {
    documentInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleCameraClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setIsCapturing(true);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play();
      }
    } catch (error) {
      console.error('Failed to access camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (!cameraVideoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideoRef.current.videoWidth;
    canvas.height = cameraVideoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(cameraVideoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onSendFile(file, 'image');
          stopCamera();
          onClose();
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const stopCamera = () => {
    if (cameraVideoRef.current && cameraVideoRef.current.srcObject) {
      const stream = cameraVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      cameraVideoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  };

  const handleAudioClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Prefer Opus in WebM, fall back to Ogg Opus if not supported.
        let mimeType = '';
        if (typeof (window as any).MediaRecorder?.isTypeSupported === 'function') {
          if ((window as any).MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if ((window as any).MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
          } else if ((window as any).MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          }
        }

        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          // Choose an appropriate blob type/extension based on the recorder's mimeType.
          const recorderType = (mediaRecorder.mimeType || mimeType || '').split(';')[0] || 'audio/webm';
          const ext = recorderType.includes('ogg') ? '.ogg' : (recorderType.includes('webm') ? '.webm' : '.webm');
          const audioBlob = new Blob(audioChunksRef.current, { type: recorderType });
          const file = new File([audioBlob], `audio-${Date.now()}${ext}`, { type: recorderType });
          onSendFile(file, 'audio');
          stream.getTracks().forEach(track => track.stop());
          onClose();
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to access microphone:', error);
        alert('Unable to access microphone. Please check permissions.');
      }
    }
  };

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onSendLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          onClose();
        },
        (error) => {
          console.error('Failed to get location:', error);
          alert('Unable to access location. Please check permissions.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'gallery') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === 'document') {
      onSendFile(file, 'document');
    } else {
      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      onSendFile(file, fileType);
    }
    onClose();
  };

  if (showContactForm) {
    return <ContactForm onSend={(contact) => {
      onSendContact(contact);
      onClose();
    }} onCancel={() => setShowContactForm(false)} />;
  }

  if (showPollForm) {
    return <PollForm onSend={(poll) => {
      onSendPoll(poll);
      onClose();
    }} onCancel={() => setShowPollForm(false)} />;
  }

  if (showLiveLocation && targetUsername) {
    return (
      <div className="fixed bottom-20 left-4 z-50">
        <LiveLocationShare
          targetUsername={targetUsername}
          onClose={() => setShowLiveLocation(false)}
          onSessionStarted={(session) => {
            onLiveLocationStarted?.(session);
            onClose();
          }}
        />
      </div>
    );
  }

  if (isCapturing) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col" data-testid="camera-capture-view">
        <div className="flex-1 relative">
          <video ref={cameraVideoRef} className="w-full h-full object-cover" />
          <Button
            onClick={stopCamera}
            className="absolute top-4 right-4 bg-red-500 hover:bg-red-600"
            data-testid="button-close-camera"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        <div className="p-6 bg-gray-900 flex justify-center">
          <Button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full bg-white hover:bg-gray-200"
            data-testid="button-capture-photo"
          >
            <Camera className="w-8 h-8 text-black" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 z-50" data-testid="attachment-menu">
      <Card className="bg-gray-800 border-gray-700 p-4 w-72">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold">Send Attachment</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="button-close-attachment"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <AttachmentOption
            icon={<FileText className="w-6 h-6 text-blue-400" />}
            label="Document"
            onClick={handleDocumentClick}
            testId="option-document"
          />
          <AttachmentOption
            icon={<Camera className="w-6 h-6 text-pink-400" />}
            label="Camera"
            onClick={handleCameraClick}
            testId="option-camera"
          />
          <AttachmentOption
            icon={<Image className="w-6 h-6 text-purple-400" />}
            label="Gallery"
            onClick={handleGalleryClick}
            testId="option-gallery"
          />
          <AttachmentOption
            icon={<Mic className={`w-6 h-6 ${isRecording ? 'text-red-400 animate-pulse' : 'text-orange-400'}`} />}
            label={isRecording ? "Recording..." : "Audio"}
            onClick={handleAudioClick}
            testId="option-audio"
          />
          <AttachmentOption
            icon={<MapPin className="w-6 h-6 text-green-400" />}
            label="Location"
            onClick={handleLocationClick}
            testId="option-location"
          />
          <AttachmentOption
            icon={<User className="w-6 h-6 text-cyan-400" />}
            label="Contact"
            onClick={() => setShowContactForm(true)}
            testId="option-contact"
          />
          <AttachmentOption
            icon={<BarChart3 className="w-6 h-6 text-yellow-400" />}
            label="Poll"
            onClick={() => setShowPollForm(true)}
            testId="option-poll"
          />
          {targetUsername && (
            <AttachmentOption
              icon={<Radio className="w-6 h-6 text-emerald-400" />}
              label="Live Location"
              onClick={() => setShowLiveLocation(true)}
              testId="option-live-location"
            />
          )}
        </div>
      </Card>

      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.csv,.xlsx,.xls"
        onChange={(e) => handleFileChange(e, 'document')}
        className="hidden"
        data-testid="input-document"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={(e) => handleFileChange(e, 'gallery')}
        className="hidden"
        data-testid="input-gallery"
      />
    </div>
  );
}

function AttachmentOption({ icon, label, onClick, testId }: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors"
      data-testid={testId}
    >
      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs text-gray-300 text-center">{label}</span>
    </button>
  );
}

function ContactForm({ onSend, onCancel }: {
  onSend: (contact: { name: string; phone: string; email?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && phone) {
      onSend({ name, phone, email: email || undefined });
    }
  };

  return (
    <Card className="fixed inset-4 z-50 bg-gray-800 border-gray-700 p-6 flex flex-col" data-testid="contact-form">
      <h3 className="text-white text-lg font-semibold mb-4">Send Contact</h3>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <input
          type="text"
          placeholder="Contact Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-gray-700 text-white px-4 py-2 rounded mb-3"
          required
          data-testid="input-contact-name"
        />
        <input
          type="tel"
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="bg-gray-700 text-white px-4 py-2 rounded mb-3"
          required
          data-testid="input-contact-phone"
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-700 text-white px-4 py-2 rounded mb-6"
          data-testid="input-contact-email"
        />
        <div className="flex gap-3 mt-auto">
          <Button type="button" onClick={onCancel} variant="outline" className="flex-1" data-testid="button-cancel-contact">
            Cancel
          </Button>
          <Button type="submit" className="flex-1 bg-swapgreen hover:bg-green-600" data-testid="button-send-contact">
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PollForm({ onSend, onCancel }: {
  onSend: (poll: { question: string; options: string[] }) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(opt => opt.trim() !== '');
    if (question && validOptions.length >= 2) {
      onSend({ question, options: validOptions });
    }
  };

  return (
    <Card className="fixed inset-4 z-50 bg-gray-800 border-gray-700 p-6 flex flex-col" data-testid="poll-form">
      <h3 className="text-white text-lg font-semibold mb-4">Create Poll</h3>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <input
          type="text"
          placeholder="Poll Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="bg-gray-700 text-white px-4 py-2 rounded mb-4"
          required
          data-testid="input-poll-question"
        />
        {options.map((option, index) => (
          <input
            key={index}
            type="text"
            placeholder={`Option ${index + 1}`}
            value={option}
            onChange={(e) => updateOption(index, e.target.value)}
            className="bg-gray-700 text-white px-4 py-2 rounded mb-2"
            data-testid={`input-poll-option-${index}`}
          />
        ))}
        {options.length < 5 && (
          <Button
            type="button"
            onClick={addOption}
            variant="outline"
            className="mb-4"
            data-testid="button-add-poll-option"
          >
            Add Option
          </Button>
        )}
        <div className="flex gap-3 mt-auto">
          <Button type="button" onClick={onCancel} variant="outline" className="flex-1" data-testid="button-cancel-poll">
            Cancel
          </Button>
          <Button type="submit" className="flex-1 bg-swapgreen hover:bg-green-600" data-testid="button-send-poll">
            Send Poll
          </Button>
        </div>
      </form>
    </Card>
  );
}
