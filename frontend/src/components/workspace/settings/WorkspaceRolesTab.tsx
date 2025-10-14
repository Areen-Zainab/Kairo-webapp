import { useState } from 'react';
import { Save } from 'lucide-react';

export default function WorkspaceRolesTab() {
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
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Access Control</h3>
        <div className="space-y-4">
          {Object.entries(permissions).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-md border border-gray-700/50">
              <div>
                <p className="text-white font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p className="text-sm text-gray-400 mt-1">Minimum role required for this action</p>
              </div>
              <select
                value={value}
                onChange={(e) => setPermissions({ ...permissions, [key]: e.target.value })}
                className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all font-medium shadow-lg hover:shadow-purple-500/30 flex items-center gap-2">
          <Save size={18} />
          Save Permissions
        </button>
      </div>
    </div>
  );
}
