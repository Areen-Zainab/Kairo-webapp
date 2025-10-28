import { X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useUser } from '../context/UserContext';
import { useToastContext } from '../context/ToastContext';

interface JoinWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceJoined?: () => void;
}

export default function JoinWorkspaceModal({ isOpen, onClose, onWorkspaceJoined }: JoinWorkspaceModalProps) {
  const { refreshUser, refreshWorkspaces, setCurrentWorkspace } = useUser();
  const toast = useToastContext();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  if (!isOpen) return null;

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Please enter a workspace code');
      toast.warning('Please enter a workspace code', 'Missing Code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.joinWorkspace(code.trim());

      if (response.error) {
        setError(response.error);
        toast.error(response.error, 'Join Failed');
      } else if (response.data) {
        const workspace = response.data.workspace;
        const isAlreadyMember = response.data.alreadyMember;
        
        console.log('Joined workspace:', workspace);
        
        if (isAlreadyMember) {
          toast.success(`You're already a member of ${workspace.name}!`, 'Already a Member');
        } else {
          toast.success(`Successfully joined ${workspace.name}!`, 'Workspace Joined');
        }
        
        // Refresh workspaces and user context
        await refreshWorkspaces();
        await refreshUser();
        
        // Set as current workspace
        setCurrentWorkspace({
          id: String(workspace.id),
          name: workspace.name,
          role: workspace.role || 'Member',
          color: 'from-blue-500 to-cyan-500',
          memberCount: workspace.memberCount || 1,
        });
        
        // Close modal and navigate to the workspace
        onWorkspaceJoined?.();
        onClose();
        navigate(`/workspace/${workspace.id}`);
      }
    } catch (error) {
      console.error('Join workspace error:', error);
      setError('Failed to join workspace. Please try again.');
      toast.error('Failed to join workspace. Please try again.', 'Join Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    setIsLoading(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Join Workspace</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded transition-colors hover:bg-gray-100 text-gray-600 dark:hover:bg-slate-700 dark:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Invitation Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ALPHA-2025-XYZ"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 dark:bg-red-500/10 dark:border-red-500/30">
              <p className="text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          )}
          
          <div className="bg-purple-50 border border-purple-200 rounded p-3 dark:bg-purple-500/10 dark:border-purple-500/30">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              <strong>Tip:</strong> Ask your team admin for an invitation code
            </p>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded font-medium text-gray-900 border border-gray-300 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleJoin}
              disabled={isLoading || !code.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded font-medium text-white hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                'Join'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


