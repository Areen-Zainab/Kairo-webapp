import React from 'react';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  className = ''
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'meetings', label: 'Meetings', icon: '📅' },
    { id: 'teams', label: 'Teams', icon: '👥' },
    { id: 'performance', label: 'Performance', icon: '📈' },
    { id: 'insights', label: 'Insights', icon: '💡' }
  ];

  return (
    <div className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="px-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default TabNavigation;
