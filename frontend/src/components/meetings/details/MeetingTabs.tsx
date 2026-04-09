import React from 'react';
import MeetingMinutes from './MeetingMinutes';
import NotesPanel from './NotesPanel';
import OverviewPanel from './OverviewPanel';
import TranscriptPanel from './TranscriptPanel';
import FilesPanel from './FilesPanel';
import AIInsightsPanel from './AIInsightsPanel';
import ActionItemsPanel from './ActionItemsPanel';
import { useAIInsights } from '../../../hooks/useAIInsights';
import type { MeetingDetailsData, MeetingMinute, MeetingNote } from './types';

interface MeetingTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  meeting: MeetingDetailsData;
  onMinuteHover: (minute: MeetingMinute) => void;
  onMinuteClick: (minute: MeetingMinute) => void;
  onExportMinutes: (format: 'pdf' | 'markdown') => void;
  onAddNote: (note: Omit<MeetingNote, 'id'>) => void;
  onUpdateNote: (id: string, note: Partial<MeetingNote>) => void;
  onDeleteNote: (id: string) => void;
  onAddActionItem: (actionItem: any) => void;
  onUpdateActionItem: (id: string, actionItem: any) => void;
  onDeleteActionItem: (id: string) => void;
  onFileClick?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  onFileUpload?: (file: File) => void;
  onFileDelete?: (fileId: string) => void;
  currentTime: number;
  actionItems?: any[];
  aiInsights?: any;
  mappingsRefreshTick?: number;
}

const MeetingTabs: React.FC<MeetingTabsProps> = ({
  activeTab,
  onTabChange,
  meeting,
  onMinuteHover,
  onMinuteClick,
  onExportMinutes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onAddActionItem,
  onUpdateActionItem,
  onDeleteActionItem,
  onFileClick,
  onFileDownload,
  onFileUpload,
  onFileDelete,
  currentTime,
  actionItems,
  aiInsights,
  mappingsRefreshTick = 0,
}) => {
  // Get AI insights for generating minutes on-demand (hook must be at top level)
  const { insights } = useAIInsights(meeting.id);

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'transcript',
      label: 'Transcript',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    {
      id: 'summary',
      label: 'Meeting Minutes',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'action-items',
      label: 'Action Items',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    {
      id: 'files',
      label: 'Files',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'ai-insights',
      label: 'AI Insights',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPanel meeting={meeting} />;
      case 'summary':
        return (
          <MeetingMinutes
            minutes={meeting.minutes}
            meeting={meeting}
            insights={insights}
            onMinuteHover={onMinuteHover}
            onMinuteClick={onMinuteClick}
            onExport={onExportMinutes}
          />
        );
      case 'action-items':
        return (
          <ActionItemsPanel
            meeting={meeting}
            onAddActionItem={onAddActionItem}
            onUpdateActionItem={onUpdateActionItem}
            onDeleteActionItem={onDeleteActionItem}
          />
        );
      case 'notes':
        return (
          <NotesPanel
            notes={meeting.notes}
            onAddNote={onAddNote}
            onUpdateNote={onUpdateNote}
            onDeleteNote={onDeleteNote}
            currentTime={currentTime}
          />
        );
      case 'transcript':
        return (
          <TranscriptPanel
            meeting={meeting}
            currentTime={currentTime}
            onTimeUpdate={() => {}}
            onTimestampClick={() => {}}
            onTranscriptHover={() => {}}
            onSlideClick={() => {}}
            onAddNote={onAddNote}
            onDeleteNote={onDeleteNote}
            actionItems={actionItems}
            aiInsights={aiInsights}
            mappingsRefreshTick={mappingsRefreshTick}
          />
        );
        case 'files':
          return (
            <FilesPanel
              files={meeting.files}
              onFileClick={onFileClick || ((file) => console.log('File clicked:', file))}
              onFileDownload={onFileDownload || ((file) => console.log('File download:', file))}
              onFileUpload={onFileUpload}
              onFileDelete={onFileDelete}
              currentTime={currentTime}
            />
          );
      case 'ai-insights':
        return (
          <AIInsightsPanel
            meeting={meeting}
            onExportInsights={(format: 'pdf' | 'markdown' | 'text') => {
              // Export is handled internally by AIInsightsPanel
              console.log('AI insights exported as:', format);
            }}
          />
        );
      default:
        return <OverviewPanel meeting={meeting} />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col min-h-screen">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default MeetingTabs;
