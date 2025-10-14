import { useState } from 'react';
import { Settings, Palette, Plug, Shield, Database } from 'lucide-react';
import Layout from '../../components/Layout';
import WorkspaceGeneralTab from '../../components/workspace/settings/WorkspaceGeneralTab';
import WorkspaceAIPreferencesTab from '../../components/workspace/settings/WorkspaceAIPreferencesTab';
import WorkspaceIntegrationsTab from '../../components/workspace/settings/WorkspaceIntegrationsTab';
import WorkspaceRolesTab from '../../components/workspace/settings/WorkspaceRolesTab';
import WorkspaceStorageTab from '../../components/workspace/settings/WorkspaceStorageTab';


// Main Component
export default function WorkspaceSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'ai', label: 'AI Preferences', icon: Palette },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'roles', label: 'Permissions', icon: Shield },
    { id: 'storage', label: 'Storage', icon: Database },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Workspace Settings</h1>
          <p className="text-gray-400 mt-1">Manage your workspace configuration and preferences</p>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-1">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

         {/* Tab Content */}
         {activeTab === 'general' && <WorkspaceGeneralTab />}
         {activeTab === 'ai' && <WorkspaceAIPreferencesTab />}
         {activeTab === 'integrations' && <WorkspaceIntegrationsTab />}
         {activeTab === 'roles' && <WorkspaceRolesTab />}
         {activeTab === 'storage' && <WorkspaceStorageTab />}
      </div>
    </Layout>
  );
}