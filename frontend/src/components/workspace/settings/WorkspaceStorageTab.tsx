import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Download, Trash2, AlertCircle } from 'lucide-react';
import { useUser } from '../../../context/UserContext';

export default function WorkspaceStorageTab() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const { workspaces } = useUser();
  
  // Get user's role in the workspace
  const workspaceRole = workspaceId 
    ? workspaces.find((ws: any) => String(ws.id) === workspaceId)?.role 
    : null;
  
  const canEdit = workspaceRole === 'owner' || workspaceRole === 'admin';

  const [retentionPeriod, setRetentionPeriod] = useState('365');
  const [autoArchive, setAutoArchive] = useState(true);

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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Retention</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Retention Period (Days)
            </label>
            <select
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(e.target.value)}
              disabled={!canEdit}
              className={`w-full px-4 py-3 rounded-md border text-gray-900 ${
                canEdit 
                  ? 'bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white' 
                  : 'bg-gray-50 border-gray-200 cursor-not-allowed dark:bg-gray-900 dark:border-gray-800'
              }`}
            >
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
              <option value="-1">Unlimited</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-md border bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/50">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">Auto-Archive Old Meetings</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Automatically archive meetings after retention period</p>
            </div>
            <button
              onClick={() => canEdit && setAutoArchive(!autoArchive)}
              disabled={!canEdit}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                autoArchive ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                autoArchive ? 'translate-x-7' : ''
              }`} />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export & Delete</h3>
        <div className="space-y-3">
          <button 
            disabled={!canEdit}
            className={`w-full px-6 py-3 rounded-md transition-all font-medium flex items-center justify-center gap-2 ${
              canEdit
                ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 dark:bg-blue-600/20 dark:text-blue-400 dark:border-blue-500/30'
                : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed dark:bg-gray-800/50 dark:text-gray-500 dark:border-gray-700/50'
            }`}
          >
            <Download size={18} />
            Export Workspace Data
          </button>
          {workspaceRole === 'owner' && (
            <button className="w-full px-6 py-3 rounded-md transition-all font-medium flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 dark:bg-red-600/20 dark:text-red-400 dark:border-red-500/30">
              <Trash2 size={18} />
              Delete Workspace
            </button>
          )}
        </div>
        <div className="mt-4 p-3 rounded-md flex gap-3 bg-yellow-50 border border-yellow-300 dark:bg-yellow-600/10 dark:border-yellow-500/30">
          <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" size={20} />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">Deleting a workspace will soft-delete it for 30 days before permanent removal.</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all font-medium shadow-lg hover:shadow-purple-500/30 flex items-center gap-2">
            <Save size={18} />
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
}