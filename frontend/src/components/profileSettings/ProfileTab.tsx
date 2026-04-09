import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Upload, Mic, Check, Play, Pause, Trash2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { UserProfile } from '../../context/UserContext';
import apiService from '../../services/api';

interface ProfileTabProps {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ profile, onSave }) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: profile.name,
    email: profile.email,
    profilePictureUrl: profile.profilePictureUrl,
    audioSampleUrl: profile.audioSampleUrl,
    timezone: profile.timezone,
  });
  const [previewImage, setPreviewImage] = useState<string | null>(profile.profilePictureUrl || null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  
  const MIN_RECORDING_SECONDS = 15;
  const MAX_RECORDING_SECONDS = 30;

  // Audio states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  // Auto-enrollment: runs in background when audio is ready and consent exists
  const [hasConsent, setHasConsent] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<null | 'enrolling' | 'success' | 'error'>(null);
  const [enrollmentMessage, setEnrollmentMessage] = useState<string | null>(null);
  const hasConsentRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Sync formData with profile prop when it changes (e.g., after save)
  useEffect(() => {
    setFormData({
      name: profile.name,
      email: profile.email,
      profilePictureUrl: profile.profilePictureUrl,
      audioSampleUrl: profile.audioSampleUrl,
      timezone: profile.timezone,
    });
    setPreviewImage(profile.profilePictureUrl || null);
    setPendingAudio(null);
    setRecordedBlob(null);
    setLocalAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setHasChanges(false);
  }, [profile]);

  // Fetch consent once on mount so we know whether to auto-enroll
  useEffect(() => {
    apiService.getSpeakerConsentStatus().then((res) => {
      const consent = res.data?.hasConsent ?? false;
      setHasConsent(consent);
      hasConsentRef.current = consent;
    }).catch(() => {});
  }, []);

  const autoEnroll = async (blob: Blob) => {
    if (!hasConsentRef.current) return;
    setEnrollmentStatus('enrolling');
    setEnrollmentMessage(null);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const validation = await apiService.validateSpeakerAudio(base64Data);
      if (validation.error) {
        setEnrollmentStatus('error');
        setEnrollmentMessage(validation.error);
        return;
      }

      const durationSec = validation.data?.duration_sec ?? validation.data?.duration ?? null;
      if (typeof durationSec === 'number' && durationSec > 0 && durationSec < 15) {
        setEnrollmentStatus('error');
        setEnrollmentMessage(`Recording too short (${durationSec.toFixed(1)}s). Record at least 15s for voice fingerprinting.`);
        return;
      }

      const snr = validation.data?.snr_db ?? validation.data?.snr ?? 0;
      if (!validation.data?.valid || snr < 15) {
        const reason = validation.data?.reason;
        setEnrollmentStatus('error');
        setEnrollmentMessage(
          reason && reason !== 'ok'
            ? `Voice fingerprint skipped: ${reason}. Re-record in a quieter place.`
            : 'Too much background noise for fingerprinting. Re-record in a quieter place.'
        );
        return;
      }

      const enroll = await apiService.enrollSpeakerVoice(base64Data);
      if (enroll.error) {
        setEnrollmentStatus('error');
        setEnrollmentMessage(enroll.error);
        return;
      }

      setEnrollmentStatus('success');
      setEnrollmentMessage(null);
    } catch {
      setEnrollmentStatus('error');
      setEnrollmentMessage('Voice fingerprint update failed. You can retry from the Voice tab.');
    }
  };

  const handleChange = (field: keyof Partial<UserProfile>, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (field === 'name' || field === 'email') {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      // Store locally as base64 for preview and later upload
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPendingImage(dataUrl); // Store base64 locally
        setPreviewImage(dataUrl); // Show preview
        setHasChanges(true); // Mark as changed
      };
      reader.readAsDataURL(file);
    }
  };

  // Cleanup audio player and local blob URLs on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
      }
    };
  }, []);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        alert('Please select an audio file');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('Audio file size must be less than 10MB');
        return;
      }

      // Revoke any previous local URL to avoid memory leaks
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
      }
      // Create a local blob URL immediately for reliable playback
      const blobUrl = URL.createObjectURL(file);
      setLocalAudioUrl(blobUrl);
      setRecordedBlob(file);

      // Auto-enroll in parallel with the Supabase upload
      autoEnroll(file);

      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        
        try {
          const fileExtension = file.type.split('/')[1] || 'webm';
          const response = await apiService.uploadAudioRecording(dataUrl, fileExtension);
          
          if (response.error) {
            alert('Failed to upload audio. Please try again.');
          } else if (response.data?.audioUrl) {
            setPendingAudio(response.data.audioUrl);
            setHasChanges(true);
          }
        } catch (error) {
          console.error('Error uploading audio:', error);
          alert('Failed to upload audio. Please try again.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(audioBlob);

        // Create a local blob URL immediately for reliable playback (same as onboarding).
        // Functional updater ensures we always revoke the CURRENT previous URL,
        // not the stale closure value from when startRecording was called.
        const blobUrl = URL.createObjectURL(audioBlob);
        setLocalAudioUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return blobUrl;
        });

        // Stop all tracks before the async upload
        stream.getTracks().forEach(track => track.stop());

        // Auto-enroll in parallel with the Supabase upload (does not block save flow)
        autoEnroll(audioBlob);

        // Upload to server for persistence
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setIsUploading(true);
          
          try {
            const response = await apiService.uploadAudioRecording(dataUrl, 'webm');
            if (response.error) {
              alert('Failed to upload recording. Please try again.');
            } else if (response.data?.audioUrl) {
              setPendingAudio(response.data.audioUrl);
              setHasChanges(true);
            }
          } catch (error) {
            console.error('Error uploading recording:', error);
            alert('Failed to upload recording. Please try again.');
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      intervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);

      // Auto-stop at max duration
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
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

  const playAudio = () => {
    // Prefer local blob URL (guaranteed to work) over server URL
    const audioUrl = localAudioUrl || pendingAudio || formData.audioSampleUrl;
    if (!audioUrl) return;

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audioPlayerRef.current = audio;
    
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      alert('Error playing audio');
    };

    audio.play();
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setIsPlaying(false);
  };

  const deleteAudio = () => {
    if (confirm('Are you sure you want to delete your voice sample?')) {
      setPendingAudio(null);
      setRecordedBlob(null);
      setEnrollmentStatus(null);
      setEnrollmentMessage(null);
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
        setLocalAudioUrl(null);
      }
      // Use null (not undefined) so JSON.stringify sends audioSampleUrl:null to the backend,
      // which triggers the deletion path in PUT /auth/me
      setFormData(prev => ({
        ...prev,
        audioSampleUrl: null as unknown as string,
      }));
      setHasChanges(true);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setIsPlaying(false);
    }
  };

  const handleSave = async () => {
    const newErrors: { name?: string; email?: string } = {};
    if (!formData.name?.trim()) newErrors.name = 'Name is required';
    if (!formData.email?.trim()) newErrors.email = 'Email is required';
    else if (formData.email && !validateEmail(formData.email)) newErrors.email = 'Invalid email format';
    if (Object.keys(newErrors).length > 0) return setErrors(newErrors);

    setIsUploading(true);
    let updatedData = { ...formData };

    try {
      // Upload pending image if exists
      if (pendingImage) {
        const response = await apiService.uploadProfilePicture(pendingImage);
        
        if (response.error) {
          alert('Failed to upload image. Please try again.');
          setIsUploading(false);
          return;
        }

        if (response.data?.imageUrl) {
          updatedData.profilePictureUrl = response.data.imageUrl;
          setPendingImage(null);
        }
      }

      // Save audio URL if exists
      if (pendingAudio) {
        updatedData.audioSampleUrl = pendingAudio;
        setPendingAudio(null);
      } else if (formData.audioSampleUrl === null && profile.audioSampleUrl) {
        // User deleted the audio — send null explicitly so JSON.stringify includes the key
        (updatedData as any).audioSampleUrl = null;
      }

      // Save all changes
      onSave(updatedData);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: profile.name,
      email: profile.email,
      profilePictureUrl: profile.profilePictureUrl,
      audioSampleUrl: profile.audioSampleUrl,
      timezone: profile.timezone,
    });
    setPreviewImage(profile.profilePictureUrl || null);
    setPendingImage(null);
    setPendingAudio(null);
    setRecordedBlob(null);
    if (localAudioUrl) {
      URL.revokeObjectURL(localAudioUrl);
      setLocalAudioUrl(null);
    }
    setEnrollmentStatus(null);
    setEnrollmentMessage(null);
    setHasChanges(false);
    setErrors({});
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Profile Picture */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Profile Picture
        </label>
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 flex items-center justify-center">
              {previewImage ? (
                <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Sparkles className="w-8 h-8 text-gray-400 dark:text-slate-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/30 dark:bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Upload className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 rounded-lg text-sm text-gray-800 dark:text-slate-300 transition-all"
            >
              Upload Photo
            </button>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              JPG, PNG or GIF. Max 5MB.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Full Name *
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-white/5 border ${
            errors.name ? 'border-red-400 dark:border-red-500/50' : 'border-gray-300 dark:border-white/10'
          } rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
          placeholder="Areeba Riaz"
        />
        {errors.name && <p className="text-xs text-red-500 dark:text-red-400">{errors.name}</p>}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Email Address *
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-white/5 border ${
            errors.email ? 'border-red-400 dark:border-red-500/50' : 'border-gray-300 dark:border-white/10'
          } rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
          placeholder="areeba@example.com"
        />
        {errors.email && <p className="text-xs text-red-500 dark:text-red-400">{errors.email}</p>}
      </div>

      {/* Audio Sample */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Voice Sample (Optional)
        </label>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Help us identify your voice in meetings for better speaker diarization.
        </p>
        
        {/* Show current audio if exists */}
        {(pendingAudio || formData.audioSampleUrl) && !isRecording ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Voice sample saved</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Ready for speaker identification</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isPlaying ? pauseAudio : playAudio}
                  className="p-2 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-800/50 dark:hover:bg-green-700/50 text-green-700 dark:text-green-300 transition-all"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={deleteAudio}
                  className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Auto-enrollment status — shown only when consent is granted */}
            {hasConsent && enrollmentStatus === 'enrolling' && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating voice fingerprint…</span>
              </div>
            )}
            {hasConsent && enrollmentStatus === 'success' && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Voice fingerprint updated</span>
              </div>
            )}
            {hasConsent && enrollmentStatus === 'error' && enrollmentMessage && (
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{enrollmentMessage}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
            {isUploading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <p className="ml-3 text-sm text-gray-700 dark:text-slate-300">Uploading audio...</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isUploading}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400/50'
                        : 'bg-purple-500 hover:bg-purple-600 focus:ring-purple-400/50'
                    }`}
                  >
                    {isRecording ? (
                      <div className="w-5 h-5 bg-white rounded" />
                    ) : (
                      <Mic className="w-6 h-6 text-white" />
                    )}
                  </button>
                  <div>
                    {isRecording ? (
                      <div>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{formatTime(recordingTime)}</p>
                        <p className="text-xs text-red-500 flex items-center">
                          <span className="w-2 h-2 bg-red-400 rounded-full mr-1 animate-pulse"></span>
                          Recording ({MIN_RECORDING_SECONDS}–{MAX_RECORDING_SECONDS}s)...
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Record voice sample</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Tap to start ({MIN_RECORDING_SECONDS}–{MAX_RECORDING_SECONDS}s of speech)</p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isRecording || isUploading}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 rounded-lg text-gray-800 dark:text-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4 mr-1 inline-block" /> Upload File
                </button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 rounded-lg text-sm text-gray-800 dark:text-slate-300 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:shadow-lg hover:shadow-purple-400/30 rounded-lg text-sm text-white font-medium transition-all"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
