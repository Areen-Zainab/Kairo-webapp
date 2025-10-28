import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save, AlertCircle } from 'lucide-react';
import { useUser } from '../../../context/UserContext';

export default function WorkspaceRolesTab() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const { workspaces } = useUser();
  
  // Get user's role in the workspace
  const workspaceRole = workspaceId 
    ? workspaces.find((ws: any) => String(ws.id) === workspaceId)?.role 
    : null;
  
  const canEdit = workspaceRole === 'owner' || workspaceRole === 'admin';

  const [permissions, setPermissions] = useState({
    deleteMeetings: 'Admin',
    inviteMembers: 'Member',
    exportData: 'Admin',
    manageIntegrations: 'Owner',
    modifySettings: 'Admin',
  });

  const roleOptions = ['Owner', 'Admin', 'Member', 'Observer'];

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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Access Control</h3>
        <div className="space-y-4">
          {Object.entries(permissions).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 rounded-md border bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/50">
              <div>
                <p className="text-gray-900 dark:text-white font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Minimum role required for this action</p>
              </div>
              <select
                value={value}
                onChange={(e) => setPermissions({ ...permissions, [key]: e.target.value })}
                disabled={!canEdit}
                className={`px-4 py-2 rounded-md border ${
                  canEdit 
                    ? 'bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:bg-gray-700/50 dark:border-gray-600/50' 
                    : 'bg-gray-50 border-gray-200 cursor-not-allowed dark:bg-gray-900 dark:border-gray-800'
                } text-gray-900 dark:text-white`}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all font-medium shadow-lg hover:shadow-purple-500/30 flex items-center gap-2">
            <Save size={18} />
            Save Permissions
          </button>
        </div>
      )}
    </div>
  );
}
