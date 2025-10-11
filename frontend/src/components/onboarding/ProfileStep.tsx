import React from 'react';
import { Sparkles } from 'lucide-react';

interface OnboardingData {
  displayName: string;
  timezone: string;
  profilePicture: File | null;
  audioSample: File | null;
  workspaceAction: 'create' | 'join' | 'skip' | null;
  workspaceName: string;
  workspaceCode: string;
}

interface ProfileStepProps {
  data: OnboardingData;
  onChange: (data: Partial<OnboardingData>) => void;
}

const ProfileStep: React.FC<ProfileStepProps> = ({ data, onChange }) => {
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange({ profilePicture: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-1">Welcome to Kairo!</h2>
        <p className="text-sm text-slate-300">Let's set up your profile</p>
      </div>

      {/* Profile Picture */}
      <div className="flex flex-col items-center mb-4">
        <div 
          className="relative group cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={`w-20 h-20 rounded-full overflow-hidden border-2 ${
            previewImage ? 'border-purple-500' : 'border-dashed border-slate-600'
          } bg-white/5 backdrop-blur-sm flex items-center justify-center transition-all hover:border-purple-400`}>
            {previewImage ? (
              <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <Sparkles className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-lg">+</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <p className="text-xs text-slate-400 mt-2">Upload profile picture (optional)</p>
      </div>

      {/* Display Name */}
      <div className="space-y-1.5">
        <label htmlFor="displayName" className="block text-sm font-medium text-slate-300">
          Display Name *
        </label>
        <input
          id="displayName"
          type="text"
          value={data.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          placeholder="How should we call you?"
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Timezone */}
      <div className="space-y-1.5">
        <label htmlFor="timezone" className="block text-sm font-medium text-slate-300">
          Timezone *
        </label>
        <select
          id="timezone"
          value={data.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-900">Select your timezone</option>
          {timezones.map((tz) => (
            <option key={tz} value={tz} className="bg-slate-900">
              {tz.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ProfileStep;