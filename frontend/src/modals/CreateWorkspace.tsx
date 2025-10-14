import React, { useState } from 'react';
import { X, Upload, Plus, Trash2, Users } from 'lucide-react';

interface CreateWorkspaceModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function CreateWorkspaceModal({ isOpen = true, onClose }: CreateWorkspaceModalProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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

  const handleSubmit = () => {
    if (!workspaceName) {
      alert('Please enter a workspace name');
      return;
    }
    console.log({ workspaceName, description, members, logo: logoPreview });
    onClose?.();
  };

  const handleClose = () => {
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-lg shadow-2xl w-full max-w-4xl border border-gray-700/50 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Create Workspace</h2>
            <p className="text-sm text-gray-400 mt-1">Set up your collaborative environment</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-all hover:rotate-90 duration-300 p-1"
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
                <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                  Workspace Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-md bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-dashed border-purple-500/30 flex items-center justify-center overflow-hidden hover:border-purple-500/60 transition-all duration-300">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="text-gray-600" size={28} />
                    )}
                  </div>
                  <label className="cursor-pointer flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="px-5 py-2.5 bg-gradient-to-r from-gray-800 to-gray-700 text-gray-200 rounded-md hover:from-gray-700 hover:to-gray-600 transition-all duration-300 border border-gray-600/50 text-sm font-medium text-center shadow-lg hover:shadow-purple-500/10">
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                    </div>
                  </label>
                </div>
              </div>

              {/* Workspace Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">
                  Workspace Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 backdrop-blur-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this workspace about?"
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 resize-none backdrop-blur-sm"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col">
              {/* Invite Members */}
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider flex items-center gap-2">
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
                    className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 backdrop-blur-sm"
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
                          className="flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-md border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300 backdrop-blur-sm group"
                        >
                          <span className="text-gray-300 text-sm truncate pr-2">{email}</span>
                          <button
                            type="button"
                            onClick={() => removeMember(index)}
                            className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 p-1 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-700/50 rounded-md">
                      <p className="text-gray-500 text-sm">No members added yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-700/50 bg-gray-900/30 backdrop-blur-sm flex-shrink-0">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-gray-800/50 text-gray-300 rounded-md hover:bg-gray-700/50 transition-all duration-300 border border-gray-700/50 font-medium backdrop-blur-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:via-purple-600 hover:to-indigo-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-purple-500/40"
            >
              Create Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}