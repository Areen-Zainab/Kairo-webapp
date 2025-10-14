import { useState } from 'react';

export default function WorkspaceIntegrationsTab() {
  const [integrations, setIntegrations] = useState([
    { id: 1, name: 'Google Meet', icon: '📹', connected: true, desc: 'Video conferencing integration' },
    { id: 2, name: 'Zoom', icon: '🎥', connected: false, desc: 'Video meetings platform' },
    { id: 3, name: 'Slack', icon: '💬', connected: true, desc: 'Team communication' },
    { id: 4, name: 'Trello', icon: '📋', connected: false, desc: 'Project management' },
    { id: 5, name: 'Jira', icon: '🔷', connected: false, desc: 'Issue tracking' },
    { id: 6, name: 'Email Notifications', icon: '📧', connected: true, desc: 'Email alerts and updates' },
  ]);

  const toggleIntegration = (id: number) => {
    setIntegrations(integrations.map(i => 
      i.id === id ? { ...i, connected: !i.connected } : i
    ));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connected Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="rounded-md p-4 border bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{integration.icon}</div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">{integration.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{integration.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleIntegration(integration.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    integration.connected
                      ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 dark:bg-green-600/20 dark:text-green-400 dark:border-green-500/30'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600/50 dark:hover:bg-purple-600/20 dark:hover:text-purple-400 dark:hover:border-purple-500/30'
                  }`}
                >
                  {integration.connected ? 'Connected' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
