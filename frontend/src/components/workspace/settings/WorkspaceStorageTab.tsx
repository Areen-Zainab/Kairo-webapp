import { useState } from 'react';
import { Save, Download, Trash2, AlertCircle } from 'lucide-react';

export default function WorkspaceStorageTab() {
  const [retentionPeriod, setRetentionPeriod] = useState('365');
  const [autoArchive, setAutoArchive] = useState(true);

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Data Retention</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">
              Retention Period (Days)
            </label>
            <select
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
              <option value="-1">Unlimited</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-md border border-gray-700/50">
            <div>
              <p className="text-white font-medium">Auto-Archive Old Meetings</p>
              <p className="text-sm text-gray-400 mt-1">Automatically archive meetings after retention period</p>
            </div>
            <button
              onClick={() => setAutoArchive(!autoArchive)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                autoArchive ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                autoArchive ? 'translate-x-7' : ''
              }`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Export & Delete</h3>
        <div className="space-y-3">
          <button className="w-full px-6 py-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-600/30 transition-all font-medium flex items-center justify-center gap-2">
            <Download size={18} />
            Export Workspace Data
          </button>
          <button className="w-full px-6 py-3 bg-red-600/20 text-red-400 border border-red-500/30 rounded-md hover:bg-red-600/30 transition-all font-medium flex items-center justify-center gap-2">
            <Trash2 size={18} />
            Delete Workspace
          </button>
        </div>
        <div className="mt-4 p-3 bg-yellow-600/10 border border-yellow-500/30 rounded-md flex gap-3">
          <AlertCircle className="text-yellow-400 flex-shrink-0" size={20} />
          <p className="text-sm text-yellow-400">Deleting a workspace will soft-delete it for 30 days before permanent removal.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all font-medium shadow-lg hover:shadow-purple-500/30 flex items-center gap-2">
          <Save size={18} />
          Save Settings
        </button>
      </div>
    </div>
  );
}