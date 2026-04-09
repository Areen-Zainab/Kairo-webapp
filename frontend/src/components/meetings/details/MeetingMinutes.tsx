import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Clock, Users, AlertCircle, CheckCircle, MessageCircle, Calendar } from 'lucide-react';
import type { MeetingMinutesProps } from './types';
import { generateMeetingMinutesFromInsights } from '../../../utils/generateMeetingMinutes';

const MeetingMinutes: React.FC<MeetingMinutesProps> = ({
  minutes,
  meeting,
  insights,
  onMinuteHover,
  onMinuteClick,
  onExport
}) => {
  const [filter, setFilter] = useState<'all' | 'action-item' | 'decision' | 'discussion' | 'follow-up'>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'priority' | 'category'>('timestamp');
  const [hoveredMinute, setHoveredMinute] = useState<any>(null);
  const [selectedMinute, setSelectedMinute] = useState<any>(null);

  // Generate minutes on-demand if empty and insights are available
  const displayMinutes = useMemo(() => {
    // If minutes array has data, use it (preserves manual edits or backend data)
    if (minutes && minutes.length > 0) {
      return minutes;
    }

    // Otherwise, generate from insights if available
    if (insights && meeting) {
      return generateMeetingMinutesFromInsights(
        insights,
        meeting.transcript || [],
        meeting.notes || []
      );
    }

    // Fallback to empty array
    return [];
  }, [minutes, insights, meeting]);

  const filteredMinutes = displayMinutes
    .filter(minute => filter === 'all' || minute.category === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'timestamp':
          return a.timestamp - b.timestamp;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'action-item': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'decision': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'discussion': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'follow-up': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'text-red-600 dark:text-red-400',
      'medium': 'text-yellow-600 dark:text-yellow-400',
      'low': 'text-green-600 dark:text-green-400'
    };
    return colors[priority] || 'text-gray-600 dark:text-gray-400';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'action-item':
        return <AlertCircle className="w-4 h-4" />;
      case 'decision':
        return <CheckCircle className="w-4 h-4" />;
      case 'discussion':
        return <MessageCircle className="w-4 h-4" />;
      case 'follow-up':
        return <Calendar className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  const handleMinuteHover = (minute: any) => {
    setHoveredMinute(minute);
    onMinuteHover(minute);
  };

  const handleMinuteClick = (minute: any) => {
    setSelectedMinute(minute);
    onMinuteClick(minute);
  };

  const handleExport = (format: 'pdf' | 'markdown') => {
    // Use displayMinutes (generated or provided)
    const minutesToExport = displayMinutes;
    
    if (format === 'pdf') {
      // Create a styled HTML document for PDF export
      const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      const getCategoryLabel = (category: string): string => {
        switch (category) {
          case 'action-item': return 'Action Item';
          case 'decision': return 'Decision';
          case 'discussion': return 'Discussion';
          case 'follow-up': return 'Follow-up';
          default: return category;
        }
      };

      const getPriorityColor = (priority: string): string => {
        switch (priority) {
          case 'high': return '#dc2626';
          case 'medium': return '#f59e0b';
          case 'low': return '#10b981';
          default: return '#6b7280';
        }
      };

      const meetingTitle = meeting?.title || 'Meeting Minutes';
      const meetingDate = meeting?.date || new Date().toLocaleDateString();
      const meetingTime = meeting?.time || '';

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Meeting Minutes - ${meetingTitle}</title>
  <style>
    @media print {
      @page {
        margin: 1in;
        size: letter;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      color: #1e40af;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .meta {
      color: #6b7280;
      font-size: 14px;
      margin: 5px 0;
    }
    .minute {
      margin-bottom: 30px;
      padding: 15px;
      border-left: 4px solid #3b82f6;
      background-color: #f9fafb;
      page-break-inside: avoid;
    }
    .minute-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 10px 0;
    }
    .minute-content {
      color: #374151;
      margin: 10px 0;
      white-space: pre-wrap;
    }
    .minute-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-top: 10px;
      font-size: 12px;
      color: #6b7280;
    }
    .minute-meta span {
      display: inline-flex;
      align-items: center;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 5px;
    }
    .category-badge {
      background-color: #dbeafe;
      color: #1e40af;
    }
    .priority-badge {
      color: white;
    }
    .timestamp {
      color: #6b7280;
    }
    .participants {
      color: #059669;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${meetingTitle}</h1>
    <div class="meta">
      <strong>Date:</strong> ${meetingDate}${meetingTime ? ` at ${meetingTime}` : ''}
    </div>
    ${meeting?.participants && meeting.participants.length > 0 ? `
    <div class="meta">
      <strong>Participants:</strong> ${meeting.participants.map((p: any) => p.name || p).join(', ')}
    </div>
    ` : ''}
  </div>

  ${minutesToExport.length === 0 ? `
    <p>No meeting minutes available.</p>
  ` : minutesToExport.map((minute, index) => `
    <div class="minute">
      <div class="minute-title">${index + 1}. ${minute.title}</div>
      <div class="minute-content">${minute.content.replace(/\n/g, '<br>')}</div>
      <div class="minute-meta">
        <span class="timestamp">⏱️ ${formatTime(minute.timestamp)}</span>
        <span>
          <span class="badge category-badge">${getCategoryLabel(minute.category)}</span>
        </span>
        <span>
          <span class="badge priority-badge" style="background-color: ${getPriorityColor(minute.priority)};">
            ${minute.priority.toUpperCase()} Priority
          </span>
        </span>
        ${minute.participants && minute.participants.length > 0 ? `
        <span class="participants">👥 ${minute.participants.join(', ')}</span>
        ` : ''}
      </div>
    </div>
  `).join('')}

  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>

  <script>
    // Auto-trigger print dialog when page loads
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

      // Create a blob and open in new window for printing
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        // The print dialog will open automatically via the script in the HTML
        // User can then save as PDF from the print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
      } else {
        // Fallback: download as HTML if popup is blocked
        const link = document.createElement('a');
        link.href = url;
        link.download = 'meeting_minutes.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      // Clean up URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      const markdownText = `# Meeting Minutes\n\n${minutesToExport
        .map(minute => `## ${minute.title}\n\n${minute.content}\n\n**Category:** ${minute.category}\n**Priority:** ${minute.priority}\n**Participants:** ${minute.participants.join(', ')}\n\n---\n`)
        .join('\n')}`;
      
      const blob = new Blob([markdownText], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'meeting_minutes.md';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    onExport(format);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Meeting Minutes
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Structured meeting minutes with key decisions and action items
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => handleExport('markdown')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
          >
            <FileText className="w-4 h-4" />
            <span>Export MD</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Items</option>
            <option value="action-item">Action Items</option>
            <option value="decision">Decisions</option>
            <option value="discussion">Discussions</option>
            <option value="follow-up">Follow-ups</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="timestamp">Time</option>
            <option value="priority">Priority</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      {/* Minutes Content */}
      <div className="space-y-4">
        {filteredMinutes.map((minute) => (
          <div
            key={minute.id}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
            onMouseEnter={() => handleMinuteHover(minute)}
            onMouseLeave={() => {
              setHoveredMinute(null);
              onMinuteHover(null as any);
            }}
            onClick={() => handleMinuteClick(minute)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-mono text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-lg font-medium">
                  {formatTime(minute.timestamp)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 ${getCategoryColor(minute.category)}`}>
                  {getCategoryIcon(minute.category)}
                  <span>{minute.category.replace('-', ' ').toUpperCase()}</span>
                </span>
                <span className={`text-sm font-medium ${getPriorityColor(minute.priority)}`}>
                  {minute.priority.toUpperCase()} PRIORITY
                </span>
              </div>
            </div>

            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {minute.title}
            </h4>
            
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              {minute.content}
            </p>

            {minute.participants && minute.participants.length > 0 && (
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Participants:</span>
                <div className="flex items-center space-x-2">
                  {minute.participants.map((participant: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      {participant}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(minute as any).actionItems && (minute as any).actionItems.length > 0 && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Action Items:</h5>
                <ul className="space-y-1">
                  {(minute as any).actionItems.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-slate-700 dark:text-slate-300 flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>Click to view details</span>
                <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Hover for context →
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hover Tooltip */}
      {hoveredMinute && (
        <div className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 max-w-sm">
          <div className="flex items-center space-x-2 mb-2">
            {getCategoryIcon(hoveredMinute.category)}
            <h5 className="font-semibold text-slate-900 dark:text-white">
              {hoveredMinute.title}
            </h5>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            {hoveredMinute.content}
          </p>
          <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{formatTime(hoveredMinute.timestamp)}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>{hoveredMinute.participants.length} participants</span>
            </span>
          </div>
        </div>
      )}

      {/* Selected Minute Modal */}
      {selectedMinute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedMinute.title}
                </h3>
                <button
                  onClick={() => setSelectedMinute(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center space-x-3 mb-4">
                <span className="text-sm font-mono text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-lg font-medium">
                  {formatTime(selectedMinute.timestamp)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 ${getCategoryColor(selectedMinute.category)}`}>
                  {getCategoryIcon(selectedMinute.category)}
                  <span>{selectedMinute.category.replace('-', ' ').toUpperCase()}</span>
                </span>
                <span className={`text-sm font-medium ${getPriorityColor(selectedMinute.priority)}`}>
                  {selectedMinute.priority.toUpperCase()} PRIORITY
                </span>
              </div>

              <div className="prose dark:prose-invert max-w-none">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                  {selectedMinute.content}
                </p>
              </div>

              {selectedMinute.participants && selectedMinute.participants.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Participants:</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedMinute.participants.map((participant: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        {participant}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(selectedMinute as any).actionItems && (selectedMinute as any).actionItems.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Action Items:</h5>
                  <ul className="space-y-2">
                    {(selectedMinute as any).actionItems.map((item: string, index: number) => (
                      <li key={index} className="text-sm text-slate-700 dark:text-slate-300 flex items-start space-x-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedMinute.aiGenerated && (
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>AI Generated</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredMinutes.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8" />
          </div>
          <p className="font-medium">No minutes found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Summary Stats */}
      {displayMinutes.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {displayMinutes.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
            </div>
            <div>
              <div className="text-base font-semibold text-red-600 dark:text-red-400">
                {displayMinutes.filter(m => m.category === 'action-item').length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Action Items</div>
            </div>
            <div>
              <div className="text-base font-semibold text-green-600 dark:text-green-400">
                {displayMinutes.filter(m => m.category === 'decision').length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Decisions</div>
            </div>
            <div>
              <div className="text-base font-semibold text-purple-600 dark:text-purple-400">
                {displayMinutes.filter(m => m.category === 'discussion').length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Discussions</div>
            </div>
            <div>
              <div className="text-base font-semibold text-blue-600 dark:text-blue-400">
                {displayMinutes.filter(m => m.aiGenerated).length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">AI Generated</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingMinutes;
