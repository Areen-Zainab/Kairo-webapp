import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Save, Trash2, AlertCircle, Copy, Check } from 'lucide-react';
import { useUser } from '../../../context/UserContext';
import { useToastContext } from '../../../context/ToastContext';
import apiService from '../../../services/api';

export default function WorkspaceGeneralTab() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const navigate = useNavigate();
  const { workspaces, refreshWorkspaces, setCurrentWorkspace } = useUser();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToastContext();
  
  const [workspaceName, setWorkspaceName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Get user's role in the workspace
  const workspaceRole = workspaceId 
    ? workspaces.find((ws: any) => String(ws.id) === workspaceId)?.role 
    : null;
  
  const canEdit = workspaceRole === 'owner' || workspaceRole === 'admin';

  // Load workspace data
  useEffect(() => {
    if (workspaceId) {
      const workspace = workspaces.find((ws: any) => String(ws.id) === workspaceId);
      if (workspace) {
        setWorkspaceName(workspace.name || '');
        setDescription(workspace.description || '');
        setWorkspaceCode(workspace.code || '');
      }
    }
  }, [workspaceId, workspaces]);

  // Copy workspace code to clipboard
  const handleCopyCode = async () => {
    if (workspaceCode) {
      await navigator.clipboard.writeText(workspaceCode);
      setCodeCopied(true);
      toastInfo('Code copied to clipboard!', 'Invitation Code');
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!workspaceId) {
      toastError('Workspace ID is required');
      return;
    }
    
    // Validate workspace name
    if (!workspaceName.trim()) {
      toastError('Workspace name cannot be empty');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await apiService.updateWorkspace(parseInt(workspaceId), {
        name: workspaceName.trim(),
        description: description.trim() || undefined,
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      await refreshWorkspaces();
      toastSuccess('Workspace settings updated successfully!', 'Success');
    } catch (error: any) {
      console.error('Failed to update workspace:', error);
      const errorMessage = error.message || error.error || 'Failed to update workspace settings';
      toastError(errorMessage, 'Update Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceId) return;
    
    setIsDeleting(true);
    try {
      const response = await apiService.deleteWorkspace(parseInt(workspaceId));
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Refresh workspaces to remove deleted workspace from list
      await refreshWorkspaces();
      
      // Clear current workspace from context if it was the deleted workspace
      const savedWorkspace = localStorage.getItem('currentWorkspace');
      if (savedWorkspace) {
        try {
          const currentWs = JSON.parse(savedWorkspace);
          if (String(currentWs.id) === workspaceId) {
            // This is the current workspace, clear it
            setCurrentWorkspace(null);
            localStorage.removeItem('currentWorkspace');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      toastSuccess('Workspace deleted successfully!', 'Deleted');
      
      // Navigate to dashboard after a short delay to show the toast
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      const errorMessage = error.message || error.error || 'Failed to delete workspace';
      toastError(errorMessage, 'Delete Failed');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-lg border p-4 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30">
          <p className="text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle size={16} />
            You have view-only access. Only workspace owners and admins can modify settings.
          </p>
        </div>
      )}
      
      <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workspace Information</h3>
        
        <div className="space-y-5">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              Workspace Logo
            </label>
            <div className="flex items-center gap-4">
              <div className={`w-20 h-20 rounded-md bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-2 ${canEdit ? 'border-dashed border-purple-300 dark:border-purple-500/30 hover:border-purple-400 dark:hover:border-purple-500/60' : 'border-gray-300 dark:border-gray-700'} flex items-center justify-center overflow-hidden transition-all duration-300`}>
                {logoPreview ? (
                  typeof logoPreview === 'string' ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className={`${canEdit ? 'text-gray-500 dark:text-gray-600' : 'text-gray-400 dark:text-gray-600'}`} size={28} />
                  )
                ) : (
                  <Upload className={`${canEdit ? 'text-gray-500 dark:text-gray-600' : 'text-gray-400 dark:text-gray-600'}`} size={28} />
                )}
              </div>
              {canEdit ? (
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <div className="px-5 py-2.5 rounded-md transition-all border text-sm font-medium bg-white border-gray-300 text-gray-900 hover:bg-gray-100 dark:bg-gray-800/50 dark:border-gray-600/50 dark:text-gray-200 dark:hover:bg-gray-700/50">
                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                  </div>
                </label>
              ) : (
                <div className="px-5 py-2.5 rounded-md border text-sm font-medium bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-900 dark:border-gray-700 dark:text-gray-600">
                  Only admins can upload logo
                </div>
              )}
            </div>
          </div>

          {/* Workspace Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Workspace Name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              disabled={!canEdit}
              className={`w-full px-4 py-3 rounded-md transition-all border text-gray-900 placeholder-gray-400 ${
                canEdit 
                  ? 'bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white' 
                  : 'bg-gray-50 border-gray-200 cursor-not-allowed dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400'
              }`}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={!canEdit}
              className={`w-full px-4 py-3 rounded-md transition-all resize-none border text-gray-900 placeholder-gray-400 ${
                canEdit 
                  ? 'bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500' 
                  : 'bg-gray-50 border-gray-200 cursor-not-allowed dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400'
              }`}
            />
          </div>

          {/* Workspace Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Invitation Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workspaceCode}
                readOnly
                className="flex-1 px-4 py-3 rounded-md transition-all bg-gray-50 border border-gray-300 text-gray-600 font-mono text-lg tracking-wider dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400"
              />
              <button
                onClick={handleCopyCode}
                className="px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all font-medium flex items-center gap-2"
                title="Copy code"
              >
                {codeCopied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Share this code with others to let them join your workspace
            </p>
          </div>
        </div>
      </div>

      {/* Delete Workspace Section - Only show for owners */}
      {workspaceRole === 'owner' && (
        <div className="rounded-lg border p-6 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-4 flex items-center gap-2">
            <AlertCircle size={20} />
            Danger Zone
          </h3>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Delete Workspace</p>
              <p className="text-xs text-red-700 dark:text-red-400">Permanently delete this workspace and all associated data</p>
            </div>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all font-medium text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Delete Workspace
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all font-medium text-sm disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-all font-medium text-sm dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {!workspaceId && 'Select a workspace to manage settings'}
          {workspaceId && !canEdit && 'Your role does not allow editing workspace settings'}
        </div>
        
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={!workspaceId || isSaving || !workspaceName}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all font-medium shadow-lg hover:shadow-purple-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  );
}
