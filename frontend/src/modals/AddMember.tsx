import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { X, Plus, Trash2, Shield, Eye, Edit3, Copy, Check, Link2, Loader2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import apiService from '../services/api';
import { useToastContext } from '../context/ToastContext';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddMemberModal({ isOpen, onClose }: AddMemberModalProps) {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const { workspaces } = useUser();
  const { success: toastSuccess, error: toastError } = useToastContext();
  const [emailInputs, setEmailInputs] = useState(['']);
  const [selectedRole, setSelectedRole] = useState('member');
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'invite' | 'code'>('invite');
  const [isLoading, setIsLoading] = useState(false);

  // Load workspace code
  useEffect(() => {
    if (workspaceId) {
      const workspace = workspaces.find((ws: any) => String(ws.id) === workspaceId);
      if (workspace) {
        setWorkspaceCode(workspace.code || '');
      }
    }
  }, [workspaceId, workspaces]);

  // Copy workspace code to clipboard
  const handleCopyCode = async () => {
    if (workspaceCode) {
      await navigator.clipboard.writeText(workspaceCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

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

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const sendInvites = async () => {
    // Filter and validate email addresses
    const trimmedEmails = emailInputs.map(email => email.trim()).filter(email => email);
    
    if (trimmedEmails.length === 0) {
      toastError('Please enter at least one email address', 'No Emails Entered');
      return;
    }

    // Validate email formats
    const invalidEmails = trimmedEmails.filter(email => !isValidEmail(email));
    if (invalidEmails.length > 0) {
      toastError(
        invalidEmails.length === 1
          ? `Invalid email format: ${invalidEmails[0]}`
          : `${invalidEmails.length} email(s) have invalid format: ${invalidEmails.join(', ')}`,
        'Invalid Email Format'
      );
      return;
    }

    const validEmails = trimmedEmails.filter(isValidEmail);

    if (!workspaceId) {
      toastError('Workspace not found', 'Error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.inviteWorkspaceMembers(
        parseInt(workspaceId),
        validEmails,
        selectedRole.toLowerCase()
      );

      // Check if response exists and has an error
      if (!response) {
        toastError('No response from server. Please try again.', 'Connection Error');
        return;
      }

      if (response.error) {
        toastError(response.error, 'Failed to Send Invitations');
        return;
      }

      const results = response.data?.results || [];
      
      console.log('Invitation results:', results);
      
      // Categorize results
      const successResults = results.filter((r: any) => r.status === 'success');
      const errorResults = results.filter((r: any) => r.status === 'error');
      const infoResults = results.filter((r: any) => r.status === 'info');
      
      // Further categorize errors by type
      const notFoundErrors = errorResults.filter((r: any) => 
        r.message.toLowerCase().includes('not found') || 
        r.message.toLowerCase().includes('does not exist') ||
        r.message.toLowerCase().includes('need to create')
      );
      const alreadyMemberErrors = errorResults.filter((r: any) => 
        r.message.toLowerCase().includes('already a member')
      );
      const invalidEmailErrors = errorResults.filter((r: any) => 
        r.message.toLowerCase().includes('invalid email')
      );
      const otherErrors = errorResults.filter((r: any) => 
        !notFoundErrors.includes(r) && 
        !alreadyMemberErrors.includes(r) && 
        !invalidEmailErrors.includes(r)
      );

      // Show success message
      if (successResults.length > 0) {
        const names = successResults.map((r: any) => r.email).join(', ');
        toastSuccess(
          successResults.length === 1 
            ? `Invitation sent to ${names}` 
            : `${successResults.length} invitations sent successfully!`,
          '✓ Invitations Sent'
        );
      }

      // Show info message for info status (already invited from backend)
      if (infoResults.length > 0) {
        infoResults.forEach((result: any) => {
          toastSuccess(
            result.message || `${result.email} has already been invited`,
            'ℹ Already Invited'
          );
        });
      }

      // Show info message for already members
      if (alreadyMemberErrors.length > 0) {
        const names = alreadyMemberErrors.map((r: any) => r.email).join(', ');
        toastSuccess(
          alreadyMemberErrors.length === 1
            ? `${names} is already a member`
            : `${alreadyMemberErrors.length} user${alreadyMemberErrors.length > 1 ? 's are' : ' is'} already member${alreadyMemberErrors.length > 1 ? 's' : ''}`,
          'Already Members'
        );
      }

      // Show error message for invalid email format
      if (invalidEmailErrors.length > 0) {
        const names = invalidEmailErrors.map((r: any) => r.email).join(', ');
        toastError(
          invalidEmailErrors.length === 1
            ? `Invalid email format: ${names}`
            : `${invalidEmailErrors.length} email(s) have invalid format`,
          'Invalid Email Format'
        );
      }

      // Show error message for users not found
      if (notFoundErrors.length > 0) {
        notFoundErrors.forEach((result: any) => {
          toastError(
            result.message || `User not found: ${result.email}`,
            'User Not Found'
          );
        });
      }

      // Show error message for other errors
      if (otherErrors.length > 0) {
        otherErrors.forEach((result: any) => {
          toastError(
            result.message || `Failed to invite ${result.email}`,
            'Invitation Error'
          );
        });
      }

      // Close modal and reset if at least one invitation was successful
      if (successResults.length > 0) {
        setTimeout(() => {
          onClose();
          setEmailInputs(['']);
          setSelectedRole('member');
        }, 1500); // Give time to see the success message
      } else if (errorResults.length === validEmails.length && validEmails.length > 1) {
        // All failed and multiple emails were attempted, don't close the modal
        toastError('No invitations were sent. Please check the email addresses and try again.', 'All Invitations Failed');
      }
    } catch (error) {
      console.error('Error sending invites:', error);
      toastError('Failed to send invitations. Please check your connection and try again.', 'Network Error');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    const lowerRole = role.toLowerCase();
    switch (lowerRole) {
      case 'admin': return <Shield size={14} className="text-purple-400" />;
      case 'member': return <Edit3 size={14} className="text-blue-400" />;
      case 'observer': return <Eye size={14} className="text-gray-400" />;
      default: return null;
    }
  };

  const roleOptions = ['admin', 'member', 'observer'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="rounded-lg shadow-2xl w-full max-w-2xl border bg-white border-gray-200 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 dark:border-gray-700/50">
        <div className="flex items-center justify-between px-6 py-5 border-b bg-white border-gray-200 dark:border-gray-700/50 dark:bg-transparent">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Members</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Invite team members to your workspace</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('invite')}
              className={`flex-1 px-4 py-2.5 rounded-t-md font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'invite'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
              }`}
            >
              <Plus size={18} />
              Invite by Email
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 px-4 py-2.5 rounded-t-md font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'code'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
              }`}
            >
              <Link2 size={18} />
              Share Invitation Code
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {activeTab === 'invite' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3 uppercase tracking-wider">
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
                        className="flex-1 px-4 py-3 rounded-md transition-all bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
                      />
                      {emailInputs.length > 1 && (
                        <button
                          onClick={() => removeEmailInput(index)}
                          className="px-3 py-3 rounded-md transition-all text-red-600 hover:bg-red-100 border border-gray-300 bg-white dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addEmailInput}
                  className="mt-3 px-4 py-2 rounded-md transition-all flex items-center gap-2 text-sm bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
                >
                  <Plus size={16} />
                  Add Another Email
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3 uppercase tracking-wider">
                  Select Role
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {roleOptions.map((role) => (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      disabled={isLoading}
                      className={`px-4 py-3 rounded-md border transition-all flex items-center justify-center gap-2 capitalize ${
                        selectedRole === role
                          ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-600/20 dark:border-purple-500 dark:text-purple-400'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-400 dark:hover:border-gray-600'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {getRoleIcon(role)}
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-500/10 dark:border-purple-500/30">
                <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                  <strong>Share this invitation code with others to let them join your workspace:</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3 uppercase tracking-wider">
                  Invitation Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={workspaceCode}
                    readOnly
                    className="flex-1 px-4 py-4 rounded-md transition-all bg-gray-50 border border-gray-300 text-gray-600 font-mono text-2xl tracking-widest text-center dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400"
                  />
                  <button
                    onClick={handleCopyCode}
                    className="px-6 py-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all font-medium flex items-center gap-2"
                    title="Copy code"
                  >
                    {codeCopied ? <Check size={20} /> : <Copy size={20} />}
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Anyone with this code can join your workspace
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-t flex gap-3 bg-gray-50 border-gray-200 dark:border-gray-700/50 dark:bg-transparent">
          {activeTab === 'invite' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-md transition-all font-medium bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50 dark:hover:bg-gray-700/50"
              >
                Cancel
              </button>
              <button
                onClick={sendInvites}
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:via-purple-600 hover:to-indigo-600 transition-all font-semibold shadow-lg hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Invites'
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:via-purple-600 hover:to-indigo-600 transition-all font-semibold shadow-lg hover:shadow-purple-500/40"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
