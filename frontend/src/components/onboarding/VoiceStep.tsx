import React, { useState, useRef, useEffect } from 'react';
import { Check, Mic } from 'lucide-react';

interface OnboardingData {
  displayName: string;
  timezone: string;
  profilePicture: File | null;
  audioSample: File | null;
  workspaceAction: 'create' | 'join' | 'skip' | null;
  workspaceName: string;
  workspaceCode: string;
}

interface VoiceStepProps {
  data: OnboardingData;
  onChange: (data: Partial<OnboardingData>) => void;
}

const VoiceStep: React.FC<VoiceStepProps> = ({ data, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-sample.webm', { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        
        setAudioURL(url);
        onChange({ audioSample: audioFile });
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      intervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, 10000);

    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to record.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange({ audioSample: file });
      const url = URL.createObjectURL(file);
      setAudioURL(url);
      setError(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-1">Voice Recognition</h2>
        <p className="text-sm text-slate-300">Help us identify your voice in meetings</p>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isRecording && recordingTime >= 10}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : data.audioSample
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500'
            }`}
          >
            {isRecording ? (
              <div className="w-6 h-6 bg-white rounded" />
            ) : data.audioSample ? (
              <Check className="w-8 h-8 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>

          {isRecording && (
            <div className="text-center">
              <div className="text-2xl font-mono text-white">{formatTime(recordingTime)}</div>
              <div className="text-xs text-slate-400 mt-1">Max 10 seconds</div>
            </div>
          )}

          <div className="text-center w-full">
            {error ? (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            ) : isRecording ? (
              <p className="text-sm text-slate-300 font-medium">Recording... Click to stop</p>
            ) : data.audioSample ? (
              <div className="space-y-2">
                <p className="text-sm text-green-400 font-medium flex items-center justify-center space-x-2">
                  <Check className="w-4 h-4" />
                  <span>Audio sample recorded!</span>
                </p>
                {audioURL && (
                  <div className="w-full px-2">
                    <audio controls className="w-full h-8" style={{ maxWidth: '100%' }}>
                      <source src={audioURL} type="audio/webm" />
                    </audio>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-300 font-medium">Click to record</p>
                <p className="text-xs text-slate-400 mt-1">Speak for 5-10 seconds</p>
              </div>
            )}
          </div>

          <div className="relative w-full flex items-center justify-center my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative px-3 bg-slate-900 text-xs text-slate-400">OR</div>
          </div>

          <button
            onClick={() => audioInputRef.current?.click()}
            className="px-5 py-2 border border-white/20 rounded-xl hover:bg-white/5 transition-all text-sm text-slate-300 hover:text-white"
          >
            Upload audio file
          </button>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default VoiceStep;