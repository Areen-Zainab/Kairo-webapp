import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, AlertCircle } from 'lucide-react';
import { useUser } from '../../../context/UserContext';
import { apiService } from '../../../services/api';
import { useToastContext } from '../../../context/ToastContext';

interface ThemeSettings {
  mode: 'light' | 'dark';
  accentColor: string;
}

interface ThemeTabProps {
  theme: ThemeSettings;
  onSave: (theme: ThemeSettings) => void;
}

const ThemeTab: React.FC<ThemeTabProps> = ({ theme, onSave }) => {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const { workspaces, refreshWorkspaces } = useUser();
  const { success: toastSuccess, error: toastError } = useToastContext();
  
  // Get workspace and user's role
  const currentWorkspace = workspaces.find((ws: any) => String(ws.id) === workspaceId);
  const workspaceRole = currentWorkspace?.role || null;
  
  const canEdit = workspaceRole === 'owner' || workspaceRole === 'admin';

  const [formData, setFormData] = useState<ThemeSettings>(() => {
    const accentColor = currentWorkspace?.colorTheme || theme.accentColor;
    return {
      mode: theme.mode,
      accentColor
    };
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update form data when workspace changes
  useEffect(() => {
    if (currentWorkspace?.colorTheme) {
      setFormData(prev => ({
        ...prev,
        accentColor: currentWorkspace.colorTheme || prev.accentColor
      }));
    }
  }, [currentWorkspace?.colorTheme]);

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

  const handleSave = async () => {
    if (!workspaceId) {
      toastError('Workspace ID is missing');
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiService.updateWorkspace(parseInt(workspaceId), {
        colorTheme: formData.accentColor
      });

      if (response.error) {
        toastError(response.error);
      } else {
        toastSuccess('Color theme updated successfully!');
        setHasChanges(false);
        // Refresh workspaces to get updated color theme
        if (refreshWorkspaces) {
          await refreshWorkspaces();
        }
        onSave(formData);
      }
    } catch (error: any) {
      console.error('Error updating color theme:', error);
      toastError('Failed to update color theme. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentWorkspace?.colorTheme) {
      setFormData({
        mode: theme.mode,
        accentColor: currentWorkspace.colorTheme
      });
    } else {
      setFormData(theme);
    }
    setHasChanges(false);
  };

  // Theme mode is controlled globally; this tab focuses on accent color only

  return (
    <div className="space-y-6 animate-fadeIn transition-colors duration-300 text-gray-900 dark:text-white">
      {!canEdit && (
        <div className="rounded-lg border p-4 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30">
          <p className="text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle size={16} />
            You have view-only access. Only workspace owners and admins can modify settings.
          </p>
        </div>
      )}

      {/* Accent Color */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Accent Color
        </label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {accentColors.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => canEdit && handleChange('accentColor', color.value)}
              disabled={!canEdit}
              className={`group relative ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <div
                className={`w-full aspect-square rounded-lg bg-gradient-to-br ${color.gradient} ${canEdit ? 'hover:scale-105 transition-transform' : ''}`}
              />
              {formData.accentColor === color.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                    <Check className="w-4 h-4 text-slate-900" />
                  </div>
                </div>
              )}
              <p className="text-xs mt-1 text-center text-gray-600 dark:text-slate-400">
                {color.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Live Preview
        </label>
        <div className="p-6 rounded-lg border transition-all bg-white border-gray-200 shadow-md dark:bg-slate-900 dark:border-slate-700">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: formData.accentColor }}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Your Workspace
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-400">
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
                className="w-full px-4 py-2 rounded-lg border text-sm font-medium transition-all border-gray-300 text-gray-900 hover:bg-gray-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
              >
                Secondary Button
              </button>
            </div>

            <div className="p-3 rounded-lg bg-gray-100 dark:bg-slate-800">
              <p className="text-xs text-gray-700 dark:text-slate-300">
                This is how your interface will look with the selected theme and accent color.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {canEdit && hasChanges && (
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-sm transition-all bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/40 rounded-lg text-sm text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ThemeTab;
