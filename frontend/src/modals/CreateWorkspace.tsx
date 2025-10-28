import React, { useState } from 'react';
import { X, Upload, Plus, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useUser } from '../context/UserContext';
import { useToastContext } from '../context/ToastContext';

interface CreateWorkspaceModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onWorkspaceCreated?: () => void;
}

export default function CreateWorkspaceModal({ isOpen = true, onClose, onWorkspaceCreated }: CreateWorkspaceModalProps) {
  const { refreshUser, refreshWorkspaces, setCurrentWorkspace } = useUser();
  const toast = useToastContext();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' || reader.result === null) {
          setLogoPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addMember = () => {
    if (emailInput && emailInput.includes('@')) {
      setMembers([...members, emailInput]);
      setEmailInput('');
    }
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!workspaceName) {
      setError('Please enter a workspace name');
      toast.warning('Please enter a workspace name to continue', 'Missing Information');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.createWorkspace({
        name: workspaceName,
        description,
        members,
      });

      if (response.error) {
        setError(response.error);
        toast.error(response.error, 'Workspace Creation Failed');
      } else if (response.data) {
        const workspace = response.data.workspace;
        console.log('Workspace created:', workspace);
        toast.success(`${workspaceName} has been created successfully!`, 'Workspace Created');
        
        // Refresh workspaces and user context
        await refreshWorkspaces();
        await refreshUser();
        
        // Set as current workspace
        setCurrentWorkspace({
          id: String(workspace.id),
          name: workspace.name,
          role: 'Owner',
          color: 'from-purple-500 to-blue-500',
          memberCount: 1,
        });
        
        // Close modal and navigate to the new workspace
        onWorkspaceCreated?.();
        onClose?.();
        navigate(`/workspace/${workspace.id}`);
      }
    } catch (error) {
      console.error('Create workspace error:', error);
      setError('Failed to create workspace. Please try again.');
      toast.error('Failed to create workspace. Please try again.', 'Creation Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setWorkspaceName('');
    setDescription('');
    setMembers([]);
    setEmailInput('');
    setLogoPreview(null);
    setError(null);
    setIsLoading(false);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="rounded-xl shadow-2xl w-full max-w-4xl border flex flex-col max-h-[85vh] bg-white border-gray-200 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 dark:border-gray-700/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Create Workspace</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Set up your collaborative environment</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all hover:rotate-90 duration-300 p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3 uppercase tracking-wider">
                  Workspace Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden transition-all duration-300 bg-gray-50 border-purple-300 hover:border-purple-400 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 dark:border-purple-500/30 dark:hover:border-purple-500/60">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="text-gray-500" size={28} />
                    )}
                  </div>
                  <label className="cursor-pointer flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="px-5 py-2.5 rounded-md transition-all duration-300 text-sm font-medium text-center shadow-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-700 dark:text-gray-200 dark:border-gray-600/50 dark:hover:from-gray-700 dark:hover:to-gray-600 dark:shadow-lg dark:hover:shadow-purple-500/10">
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                    </div>
                  </label>
                </div>
              </div>

              {/* Workspace Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-2 uppercase tracking-wider">
                  Workspace Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  className="w-full px-4 py-3 rounded-md transition-all duration-300 bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-2 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this workspace about?"
                  rows={4}
                  className="w-full px-4 py-3 rounded-md transition-all duration-300 resize-none bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col">
              {/* Invite Members */}
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-purple-400" />
                  Invite Members
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMember())}
                    placeholder="Enter email address"
                    className="flex-1 px-4 py-3 rounded-md transition-all duration-300 bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
                  />
                  <button
                    type="button"
                    onClick={addMember}
                    className="px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-md hover:from-purple-500 hover:to-purple-600 transition-all duration-300 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-purple-500/30"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                {/* Members List */}
                <div className="flex-1 min-h-0">
                  {members.length > 0 ? (
                    <div className="h-full overflow-y-auto space-y-2 pr-2">
                      {members.map((email, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-4 py-3 rounded-md border transition-all duration-300 group bg-gray-50 border-gray-200 hover:border-purple-300 dark:bg-gray-800/50 dark:border-gray-700/50 dark:hover:border-purple-500/30"
                        >
                          <span className="text-gray-700 dark:text-gray-300 text-sm truncate pr-2">{email}</span>
                          <button
                            type="button"
                            onClick={() => removeMember(index)}
                            className="text-gray-500 hover:text-red-600 transition-colors flex-shrink-0 p-1 hover:bg-red-100 rounded dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-md border-gray-300 dark:border-gray-700/50">
                      <p className="text-gray-500 text-sm">No members added yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
          <div className="px-6 py-5 border-t flex-shrink-0 bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700/50">
          {error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 rounded-md transition-all duration-300 font-medium bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:via-purple-600 hover:to-indigo-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}