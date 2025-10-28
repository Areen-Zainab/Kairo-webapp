import { useState } from 'react';
import { Settings, Sparkles, Plug, Shield, Database, Paintbrush } from 'lucide-react';
import Layout from '../../components/Layout';
import WorkspaceGeneralTab from '../../components/workspace/settings/WorkspaceGeneralTab';
import WorkspaceAIPreferencesTab from '../../components/workspace/settings/WorkspaceAIPreferencesTab';
import WorkspaceIntegrationsTab from '../../components/workspace/settings/WorkspaceIntegrationsTab';
import WorkspaceRolesTab from '../../components/workspace/settings/WorkspaceRolesTab';
import WorkspaceStorageTab from '../../components/workspace/settings/WorkspaceStorageTab';
import ThemeTab from '../../components/workspace/settings/ThemeTab';


// Main Component
export default function WorkspaceSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'theme', label: 'Theme', icon: Paintbrush },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'roles', label: 'Permissions', icon: Shield },
    { id: 'storage', label: 'Storage', icon: Database },
  ];

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Workspace Settings</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Manage your workspace configuration and preferences</p>
        </div>

        {/* Tabs */}
        <div className="rounded-lg border p-1 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2 sm:px-3 py-2 sm:py-2.5 rounded-md text-xs sm:text-sm font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
                  }`}
                  title={tab.label}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="inline md:hidden text-[10px] leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

         {/* Tab Content */}
         {activeTab === 'general' && <WorkspaceGeneralTab />}
         {activeTab === 'theme' && <ThemeTab theme={{ mode: 'dark', accentColor: '#9333ea' }} onSave={(theme) => console.log('Theme saved:', theme)} />}
         {activeTab === 'ai' && <WorkspaceAIPreferencesTab />}
         {activeTab === 'integrations' && <WorkspaceIntegrationsTab />}
         {activeTab === 'roles' && <WorkspaceRolesTab />}
         {activeTab === 'storage' && <WorkspaceStorageTab />}
      </div>
    </Layout>
  );
}