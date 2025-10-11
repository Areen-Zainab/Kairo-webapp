import React, { useState } from 'react';
import { Sun, Moon, Palette, Check } from 'lucide-react';

interface ThemeSettings {
  mode: 'light' | 'dark';
  accentColor: string;
}

interface ThemeTabProps {
  theme: ThemeSettings;
  onSave: (theme: ThemeSettings) => void;
}

const ThemeTab: React.FC<ThemeTabProps> = ({ theme, onSave }) => {
  const [formData, setFormData] = useState<ThemeSettings>(theme);
  const [hasChanges, setHasChanges] = useState(false);

  const accentColors = [
    { name: 'Purple', value: '#9333ea', gradient: 'from-purple-600 to-purple-400' },
    { name: 'Blue', value: '#3b82f6', gradient: 'from-blue-600 to-blue-400' },
    { name: 'Green', value: '#10b981', gradient: 'from-green-600 to-green-400' },
    { name: 'Pink', value: '#ec4899', gradient: 'from-pink-600 to-pink-400' },
    { name: 'Orange', value: '#f97316', gradient: 'from-orange-600 to-orange-400' },
    { name: 'Teal', value: '#14b8a6', gradient: 'from-teal-600 to-teal-400' },
  ];

  const handleChange = (field: keyof ThemeSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(formData);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setFormData(theme);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Theme Mode */}
      <div className="space-y-3">
        <label className="flex items-center space-x-2 text-sm font-medium text-slate-300">
          <Palette className="w-4 h-4" />
          <span>Theme Mode</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleChange('mode', 'light')}
            className={`p-4 rounded-lg border-2 transition-all ${
              formData.mode === 'light'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <Sun className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Light</p>
          </button>
          <button
            type="button"
            onClick={() => handleChange('mode', 'dark')}
            className={`p-4 rounded-lg border-2 transition-all ${
              formData.mode === 'dark'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <Moon className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Dark</p>
          </button>
        </div>
      </div>

      {/* Accent Color */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">Accent Color</label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {accentColors.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => handleChange('accentColor', color.value)}
              className="group relative"
            >
              <div
                className={`w-full aspect-square rounded-lg bg-gradient-to-br ${color.gradient} hover:scale-105 transition-transform`}
              />
              {formData.accentColor === color.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-slate-900" />
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1 text-center">{color.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">Live Preview</label>
        <div
          className={`p-6 rounded-lg border border-white/10 ${
            formData.mode === 'light' ? 'bg-white' : 'bg-slate-900'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: formData.accentColor }}
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    formData.mode === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Your Workspace
                </p>
                <p
                  className={`text-xs ${
                    formData.mode === 'light' ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Preview your theme
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <button
                type="button"
                className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                style={{ backgroundColor: formData.accentColor }}
              >
                Primary Button
              </button>
              <button
                type="button"
                className={`w-full px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  formData.mode === 'light'
                    ? 'border-slate-300 text-slate-900 hover:bg-slate-100'
                    : 'border-slate-600 text-white hover:bg-slate-800'
                }`}
              >
                Secondary Button
              </button>
            </div>

            <div
              className={`p-3 rounded-lg ${
                formData.mode === 'light' ? 'bg-slate-100' : 'bg-slate-800'
              }`}
            >
              <p
                className={`text-xs ${
                  formData.mode === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                This is how your interface will look with the selected theme and accent color.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 rounded-lg text-sm text-white font-medium transition-all"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default ThemeTab;