import React, { useState, useRef } from 'react';
import { Sparkles, Upload, Mic, Check } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profilePicture: string | null;
  audioSample: File | null;
}

interface ProfileTabProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ profile, onSave }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [previewImage, setPreviewImage] = useState<string | null>(profile.profilePicture);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (field === 'name' || field === 'email') {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
        handleChange('profilePicture', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleChange('audioSample', file);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    intervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    setTimeout(() => stopRecording(), 10000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    handleChange('audioSample', new File([], 'recording.webm', { type: 'audio/webm' }));
  };

  const handleSave = () => {
    const newErrors: { name?: string; email?: string } = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email format';
    if (Object.keys(newErrors).length > 0) return setErrors(newErrors);

    onSave(formData);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setFormData(profile);
    setPreviewImage(profile.profilePicture);
    setHasChanges(false);
    setErrors({});
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
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-4 ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400/50'
                    : formData.audioSample
                    ? 'bg-green-500 hover:bg-green-600 focus:ring-green-400/50'
                    : 'bg-purple-500 hover:bg-purple-600 focus:ring-purple-400/50'
                }`}
              >
                {isRecording ? (
                  <div className="w-5 h-5 bg-white rounded" />
                ) : formData.audioSample ? (
                  <Check className="w-6 h-6 text-white" />
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
                      Recording (Max 10s)...
                    </p>
                  </div>
                ) : formData.audioSample ? (
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Sample recorded</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Tap to re-record</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Record voice sample</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Tap to start speaking (Max 10s)</p>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 rounded-lg text-gray-800 dark:text-slate-300 transition-all"
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
        </div>
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
