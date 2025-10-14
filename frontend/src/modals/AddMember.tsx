import { useState } from 'react';
import { X, Plus, Trash2, Shield, Eye, Edit3 } from 'lucide-react';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddMemberModal({ isOpen, onClose }: AddMemberModalProps) {
  const [emailInputs, setEmailInputs] = useState(['']);
  const [selectedRole, setSelectedRole] = useState('Member');

  const addEmailInput = () => {
    setEmailInputs([...emailInputs, '']);
  };

  const updateEmailInput = (index: number, value: string) => {
    const newInputs = [...emailInputs];
    newInputs[index] = value;
    setEmailInputs(newInputs);
  };

  const removeEmailInput = (index: number) => {
    setEmailInputs(emailInputs.filter((_, i) => i !== index));
  };

  const sendInvites = () => {
    const validEmails = emailInputs.filter(email => email.includes('@'));
    console.log('Sending invites:', { emails: validEmails, role: selectedRole });
    onClose();
    setEmailInputs(['']);
    setSelectedRole('Member');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Admin': return <Shield size={14} className="text-purple-400" />;
      case 'Member': return <Edit3 size={14} className="text-blue-400" />;
      case 'Observer': return <Eye size={14} className="text-gray-400" />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700/50">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700/50">
          <div>
            <h2 className="text-2xl font-bold text-white">Invite Members</h2>
            <p className="text-sm text-gray-400 mt-1">Add new team members to your workspace</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Email Addresses
            </label>
            <div className="space-y-2">
              {emailInputs.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmailInput(index, e.target.value)}
                    placeholder="member@company.com"
                    className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  />
                  {emailInputs.length > 1 && (
                    <button
                      onClick={() => removeEmailInput(index)}
                      className="px-3 py-3 bg-gray-800/50 border border-gray-700/50 text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addEmailInput}
              className="mt-3 px-4 py-2 bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700/50 rounded-md transition-all flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Add Another Email
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Select Role
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['Admin', 'Member', 'Observer'].map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-4 py-3 rounded-md border transition-all flex items-center justify-center gap-2 ${
                    selectedRole === role
                      ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                      : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {getRoleIcon(role)}
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-gray-700/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-800/50 text-gray-300 rounded-md hover:bg-gray-700/50 transition-all border border-gray-700/50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={sendInvites}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:via-purple-600 hover:to-indigo-600 transition-all font-semibold shadow-lg hover:shadow-purple-500/40"
          >
            Send Invites
          </button>
        </div>
      </div>
    </div>
  );
}
