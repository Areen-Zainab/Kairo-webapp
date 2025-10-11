import React, { useState } from 'react';
import { Lock, Shield, Smartphone, Monitor, Trash2, Eye, EyeOff } from 'lucide-react';

interface ActiveSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

interface SecuritySettings {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  twoFactorEnabled: boolean;
}

interface SecurityTabProps {
  onPasswordChange: (currentPassword: string, newPassword: string) => void;
  onToggle2FA: (enabled: boolean) => void;
  onRevokeSession: (sessionId: string) => void;
}

const SecurityTab: React.FC<SecurityTabProps> = ({ 
  onPasswordChange, 
  onToggle2FA,
  onRevokeSession 
}) => {
  const [formData, setFormData] = useState<SecuritySettings>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false,
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const [activeSessions] = useState<ActiveSession[]>([
    {
      id: '1',
      device: 'Windows PC - Chrome',
      location: 'Rawalpindi, Pakistan',
      lastActive: 'Active now',
      current: true,
    },
    {
      id: '2',
      device: 'iPhone 13 - Safari',
      location: 'Islamabad, Pakistan',
      lastActive: '2 hours ago',
      current: false,
    },
    {
      id: '3',
      device: 'MacBook Pro - Chrome',
      location: 'Lahore, Pakistan',
      lastActive: '1 day ago',
      current: false,
    },
  ]);

  const validatePassword = (password: string) => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a number';
    return '';
  };

  const handleChange = (field: keyof SecuritySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handlePasswordSave = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else {
      const passwordError = validatePassword(formData.newPassword);
      if (passwordError) newErrors.newPassword = passwordError;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onPasswordChange(formData.currentPassword, formData.newPassword);
    setFormData({
      ...formData,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setHasChanges(false);
  };

  const handleCancel = () => {
    setFormData({
      ...formData,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setErrors({});
    setHasChanges(false);
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Change Password */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Lock className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Change Password</h3>
        </div>

        <div className="space-y-2">
          <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300">
            Current Password
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              type={showPasswords.current ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={(e) => handleChange('currentPassword', e.target.value)}
              className={`w-full px-4 py-2.5 pr-10 bg-white/5 border ${
                errors.currentPassword ? 'border-red-500/50' : 'border-white/10'
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('current')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.currentPassword && <p className="text-xs text-red-400">{errors.currentPassword}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300">
            New Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPasswords.new ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={(e) => handleChange('newPassword', e.target.value)}
              className={`w-full px-4 py-2.5 pr-10 bg-white/5 border ${
                errors.newPassword ? 'border-red-500/50' : 'border-white/10'
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('new')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.newPassword && <p className="text-xs text-red-400">{errors.newPassword}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showPasswords.confirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              className={`w-full px-4 py-2.5 pr-10 bg-white/5 border ${
                errors.confirmPassword ? 'border-red-500/50' : 'border-white/10'
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('confirm')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword}</p>}
        </div>

        {hasChanges && (
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasswordSave}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 rounded-lg text-sm text-white font-medium transition-all"
            >
              Update Password
            </button>
          </div>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <div className="pt-6 border-t border-white/10">
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Two-Factor Authentication</h3>
        </div>

        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex-1">
            <label htmlFor="twoFactor" className="text-sm font-medium text-slate-300 cursor-pointer">
              Enable 2FA (Coming Soon)
            </label>
            <p className="text-xs text-slate-400 mt-1">
              Add an extra layer of security to your account
            </p>
          </div>
          <label className={`relative flex h-6 w-11 items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 peer-focus:ring-offset-2 peer-focus:ring-offset-slate-900 opacity-50 cursor-not-allowed ${formData.twoFactorEnabled ? 'bg-purple-600' : 'bg-slate-600'}`}>
            <input
              id="twoFactor"
              type="checkbox"
              checked={formData.twoFactorEnabled}
              onChange={() => {}}
              disabled
              className="sr-only peer"
            />
            <span className="sr-only">Toggle 2FA</span>
            {/* The moving thumb of the toggle */}
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${formData.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </label>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="pt-6 border-t border-white/10">
        <div className="flex items-center space-x-2 mb-4">
          <Smartphone className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Active Sessions</h3>
        </div>

        <div className="space-y-3">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  {session.device.includes('Phone') ? (
                    <Smartphone className="w-5 h-5 text-purple-400" />
                  ) : (
                    <Monitor className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {session.device}
                    {session.current && (
                      <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {session.location} • {session.lastActive}
                  </p>
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => onRevokeSession(session.id)}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Revoke session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;