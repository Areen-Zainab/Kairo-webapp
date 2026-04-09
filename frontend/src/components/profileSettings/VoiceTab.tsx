import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, CheckCircle, XCircle, Trash2, RefreshCw, AlertTriangle, ShieldCheck, Loader2, Mic, Info, ChevronUp } from 'lucide-react';
import apiService from '../../services/api';
import type { SpeakerConsentStatus } from '../../services/api';

const VoiceTab: React.FC = () => {
  const [status, setStatus] = useState<SpeakerConsentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isGrantingConsent, setIsGrantingConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [snrFeedback, setSnrFeedback] = useState<{ score: number; status: 'good' | 'low' | null }>({ score: 0, status: null });
  const [showRecorder, setShowRecorder] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MIN_SAMPLE_SECONDS = 15;
  const MAX_SAMPLE_SECONDS = 30;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getSpeakerConsentStatus();
      if (response.data) {
        setStatus(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch voice status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleGrantConsent = async () => {
    setIsGrantingConsent(true);
    setError(null);
    try {
      const response = await apiService.grantSpeakerConsent();
      if (response.error) {
        setError(response.error);
      } else {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to grant consent:', err);
      setError('Failed to enable voice identification. Please try again.');
    } finally {
      setIsGrantingConsent(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke your biometric consent and delete your voice profile? This will prevent Kairo from identifying you in future meetings.')) {
      return;
    }
    setIsRevoking(true);
    try {
      await apiService.revokeSpeakerConsent();
      await fetchStatus();
    } catch (err) {
      console.error('Failed to revoke consent:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setSnrFeedback({ score: 0, status: null });
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
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        stream.getTracks().forEach((t) => t.stop());

        const file = new File([audioBlob], 'voice-sample.webm', { type: 'audio/webm' });
        await validateAndEnroll(file);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      intervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Hard cap at 30s like onboarding
      window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, MAX_SAMPLE_SECONDS * 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied. Please allow microphone access to record.');
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const validateAndEnroll = async (file: File) => {
    try {
      setIsValidating(true);
      setIsEnrolling(false);
      setError(null);
      setSnrFeedback({ score: 0, status: null });

      const base64Data = await fileToBase64(file);
      const validation = await apiService.validateSpeakerAudio(base64Data);

      if (validation.error) {
        setError(validation.error);
        return;
      }

      const durationSec =
        validation.data?.duration_sec ??
        validation.data?.duration ??
        null;

      if (typeof durationSec === 'number' && durationSec > 0 && durationSec < MIN_SAMPLE_SECONDS) {
        setError(`Recording too short (${durationSec.toFixed(1)}s). Please record at least ${MIN_SAMPLE_SECONDS}s (ideal: 15–30s).`);
        setSnrFeedback({ score: 0, status: null });
        return;
      }

      const snr =
        validation.data?.snr_db ??
        validation.data?.snr ??
        0;

      const isValid = validation.data?.valid === true;
      const status = isValid && snr >= 15 ? 'good' : 'low';
      setSnrFeedback({ score: snr, status });
      if (!isValid || status === 'low') {
        const backendReason = validation.data?.reason;
        setError(
          backendReason && backendReason !== 'ok'
            ? `Audio rejected: ${backendReason}. Please re-record in a quieter place.`
            : 'Background noise is too high. Please re-record in a quieter place.'
        );
        return;
      }

      setIsEnrolling(true);
      const enroll = await apiService.enrollSpeakerVoice(base64Data);
      if (enroll.error) {
        setError(enroll.error);
        return;
      }

      await fetchStatus();
      setShowRecorder(false);
    } catch (err) {
      console.error('Voice enrollment error:', err);
      setError('Voice enrollment failed. Please try again.');
    } finally {
      setIsValidating(false);
      setIsEnrolling(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioURL(URL.createObjectURL(file));
    await validateAndEnroll(file);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400">Loading voice profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Voice Identification</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage your biometric voice profile and consent</p>
            </div>
          </div>
          {(status?.embeddingCount ?? 0) > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="w-4 h-4" /> Active
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-wider">
              <XCircle className="w-4 h-4" /> Not Enrolled
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Biometric Consent</label>
              <div className="flex items-center gap-2 mt-1">
                {status?.hasConsent ? (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Granted on {new Date(status.consentGivenAt!).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Not Granted
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Voice Footprint</label>
              <div className="flex items-center gap-2 mt-1">
                {(status?.embeddingCount ?? 0) > 0 ? (
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Last updated {new Date(status!.lastEmbeddingUpdated!).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">No voice metrics found</span>
                )}
              </div>
            </div>
          </div>

          {status?.hasConsent && (
            <div className="space-y-3">
              {/* Enrolled summary — shown when a fingerprint already exists */}
              {(status?.embeddingCount ?? 0) > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Voice sample enrolled</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Last updated {new Date(status!.lastEmbeddingUpdated!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowRecorder(v => !v); setError(null); setSnrFeedback({ score: 0, status: null }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    {showRecorder ? <><ChevronUp className="w-3.5 h-3.5" /> Hide</> : <><Mic className="w-3.5 h-3.5" /> Update sample</>}
                  </button>
                </div>
              )}

              {/* Recording interface — always shown when not enrolled, toggled when enrolled */}
              {((status?.embeddingCount ?? 0) === 0 || showRecorder) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {(status?.embeddingCount ?? 0) > 0 ? 'Record a new voice sample' : 'Record or upload a voice sample'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Record 15–30 seconds of natural speech. We validate audio quality, then update your voice fingerprint.
                      </p>
                    </div>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isRecording && recordingTime >= MAX_SAMPLE_SECONDS}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isRecording
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                          : 'bg-blue-600 hover:bg-blue-700'
                      } text-white`}
                    >
                      {isRecording ? <div className="w-3.5 h-3.5 bg-white rounded" /> : <Mic className="w-5 h-5" />}
                    </button>
                  </div>

                  {isRecording && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Recording… <span className="font-mono">{formatTime(recordingTime)}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Aim for {MIN_SAMPLE_SECONDS}–{MAX_SAMPLE_SECONDS} seconds of natural speech.
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      Or upload an existing recording
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleUpload}
                    />
                    {audioURL && (
                      <audio
                        controls
                        className="h-8 opacity-70 hover:opacity-100 transition-opacity flex-1 min-w-[160px]"
                      >
                        <source src={audioURL} />
                      </audio>
                    )}
                  </div>

                  <div className="space-y-2">
                    {error && (
                      <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    {isValidating && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking audio quality…</span>
                      </div>
                    )}
                    {!error && !isValidating && snrFeedback.status === 'low' && (
                      <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>Too much noise ({snrFeedback.score.toFixed(1)} dB). Please try again in a quieter place.</span>
                      </div>
                    )}
                    {!error && !isValidating && snrFeedback.status === 'good' && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>
                          Excellent audio quality ({snrFeedback.score.toFixed(1)} dB)
                          {isEnrolling && ' — updating your voice profile…'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> How it works
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When you enroll your voice, Kairo creates a mathematical fingerprint (embedding) of your speech. This fingerprint is used to identify you in meeting transcripts. Your voice data is processed securely and is never shared outside your workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            {!status?.hasConsent ? (
              <div className="w-full p-4 rounded-xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable Voice Identification</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      By enabling, you consent to Kairo creating a mathematical voice fingerprint from your recording. This is used solely to identify you in meeting transcripts within your workspace. You can revoke this at any time.
                    </p>
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  onClick={handleGrantConsent}
                  disabled={isGrantingConsent}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                >
                  {isGrantingConsent
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enabling…</>
                    : <><ShieldCheck className="w-4 h-4" /> Enable Voice Identification</>
                  }
                </button>
              </div>
            ) : (
              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >
                {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Revoke Consent & Delete
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Privacy Notice */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-100/50 dark:border-white/5">
        <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Privacy & Security
        </h4>
        <ul className="space-y-3">
          {[
            'Your voice metrics are stored as non-reversible mathematical vectors.',
            'Kairo never stores raw audio recordings of your enrollment after processing.',
            'Identification is only performed for the workspaces you have joined.',
            'You can delete your voice profile and all associated data at any time.'
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-tight">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VoiceTab;
