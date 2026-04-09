import React, { useState, useRef, useEffect } from 'react';
import { Check, Mic } from 'lucide-react';

interface OnboardingData {
  displayName: string;
  timezone: string;
  profilePicture: File | null;
  audioSample: File | null;
  biometricConsent: boolean;
  workspaceAction: 'create' | 'join' | 'skip' | null;
  workspaceName: string;
  workspaceCode: string;
}

import apiService from '../../services/api';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';


interface VoiceStepProps {
  data: OnboardingData;
  onChange: (data: Partial<OnboardingData>) => void;
}

const VoiceStep: React.FC<VoiceStepProps> = ({ data, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [snrFeedback, setSnrFeedback] = useState<{ score: number; status: 'good' | 'low' | null }>({ score: 0, status: null });

  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimeRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  const MIN_SAMPLE_SECONDS = 15;
  const MAX_SAMPLE_SECONDS = 30;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-sample.webm', { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);

        // Always allow the user to replay what was recorded, even if it's rejected.
        setAudioURL((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        audioUrlRef.current = url;
        
        stream.getTracks().forEach(track => track.stop());

        // Frontend gate: never save/enroll < 15s
        const dur = recordingTimeRef.current;
        if (dur < MIN_SAMPLE_SECONDS) {
          setSnrFeedback({ score: 0, status: null });
          setError(`Recording too short (${dur}s). Please record at least ${MIN_SAMPLE_SECONDS}s (ideal: 15–30s).`);
          onChange({ audioSample: null });
          return;
        }

        onChange({ audioSample: audioFile });

        // Validate Audio immediately (server-side quality check)
        validateAudio(audioFile);
      };


      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      
      intervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1;
          recordingTimeRef.current = next;
          return next;
        });
      }, 1000);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, MAX_SAMPLE_SECONDS * 1000); // 30 seconds


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

  const validateAudio = async (file: File) => {
    setIsValidating(true);
    setSnrFeedback({ score: 0, status: null });
    
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await apiService.validateSpeakerAudio(base64Data);

      if (response.data) {
        const durationSec = response.data.duration_sec ?? response.data.duration ?? null;
        if (typeof durationSec === 'number' && durationSec > 0 && durationSec < MIN_SAMPLE_SECONDS) {
          setError(`Recording too short (${durationSec.toFixed(1)}s). Please record at least ${MIN_SAMPLE_SECONDS}s (ideal: 15–30s).`);
          setSnrFeedback({ score: 0, status: null });
          // Ensure we don't keep a too-short sample in onboarding state
          onChange({ audioSample: null });
          return;
        }

        const score = response.data.snr_db ?? response.data.snr ?? 0;
        const ok = response.data.valid === true;
        const status = ok && score >= 15 ? 'good' : 'low';
        setSnrFeedback({ score, status });
        if (!ok || status === 'low') {
          const backendReason = response.data.reason;
          setError(
            backendReason && backendReason !== 'ok'
              ? `Audio rejected: ${backendReason}. Please find a quieter place and re-record for better accuracy.`
              : 'Background noise is too high. Please find a quieter place and re-record for better accuracy.'
          );
          // Rejected audio should not be saved into onboarding state
          onChange({ audioSample: null });
        }
      }
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setIsValidating(false);
    }
  };


  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioURL((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      audioUrlRef.current = url;
      setError(null);
      setSnrFeedback({ score: 0, status: null });

      // Frontend gate using browser metadata (no upload if < 15s)
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = url;
      probe.onloadedmetadata = () => {
        const dur = Number.isFinite(probe.duration) ? probe.duration : 0;
        if (dur > 0 && dur < MIN_SAMPLE_SECONDS) {
          setError(`Audio too short (${dur.toFixed(1)}s). Please upload at least ${MIN_SAMPLE_SECONDS}s (ideal: 15–30s).`);
          onChange({ audioSample: null });
          return;
        }
        onChange({ audioSample: file });
        validateAudio(file);
      };
      probe.onerror = () => {
        // If we can't read metadata (rare), fall back to backend validation.
        onChange({ audioSample: file });
        validateAudio(file);
      };
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleConsent = () => {
    onChange({ biometricConsent: !data.biometricConsent });
  };


  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-1">Voice Recognition</h2>
        <p className="text-sm text-slate-300">Help us identify your voice in meetings</p>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <div className="flex flex-col items-center space-y-6">
          {/* Consent Toggle */}
          <div 
            onClick={toggleConsent}
            className={`w-full p-4 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
              data.biometricConsent 
                ? 'bg-purple-500/10 border-purple-500/50' 
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all ${
              data.biometricConsent ? 'bg-purple-600 border-purple-500' : 'border-white/30'
            }`}>
              {data.biometricConsent && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Enable Voice Identification</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Allow Kairo to create a unique voice fingerprint to identify you in meeting transcripts. Your data is encrypted and never shared.
              </p>
            </div>
          </div>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={(isRecording && recordingTime >= 30) || (!isRecording && !data.biometricConsent)}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl relative ${
              !data.biometricConsent && !isRecording
                ? 'bg-slate-700 opacity-50 cursor-not-allowed'
                : isRecording
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
              <div className="text-xs text-slate-400 mt-1">Keep talking for 15-30 seconds</div>
            </div>
          )}

          <div className="text-center w-full">
            {error ? (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                <p className="text-xs text-red-400 font-medium flex items-center justify-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{error}</span>
                </p>
              </div>
            ) : isValidating ? (
              <p className="text-sm text-blue-400 font-medium animate-pulse flex items-center justify-center space-x-2">
                <Info className="w-4 h-4" />
                <span>Checking audio quality...</span>
              </p>
            ) : snrFeedback.status === 'low' ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                <p className="text-xs text-amber-400 font-medium flex items-center justify-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Too much noise! ({snrFeedback.score.toFixed(1)}dB). Please try again.</span>
                </p>
              </div>
            ) : snrFeedback.status === 'good' ? (
              <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                <p className="text-sm text-green-400 font-medium flex items-center justify-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Excellent quality ({snrFeedback.score.toFixed(1)}dB)!</span>
                </p>
              </div>
            ) : data.audioSample ? (
              <div className="space-y-4">
                <p className="text-sm text-green-400 font-medium flex items-center justify-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Sample ready!</span>
                </p>
                {audioURL && (
                  <div className="w-full px-2">
                    <audio controls className="w-full h-8 opacity-60 hover:opacity-100 transition-opacity" style={{ maxWidth: '100%' }}>
                      <source src={audioURL} type="audio/webm" />
                    </audio>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!data.biometricConsent ? (
                  <p className="text-xs text-slate-500">Enable identification above to record</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-300 font-medium">Click to record</p>
                    <p className="text-xs text-slate-400 mt-1 italic">"The quick brown fox jumps over the lazy dog..."</p>
                  </>
                )}
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