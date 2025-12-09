import React, { useState } from 'react';
import { FileText, List, AlignLeft, Copy, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import type { MeetingDetailsData } from './types';
import { useAIInsights } from '../../../hooks/useAIInsights';

interface AIInsightsPanelProps {
  meeting: MeetingDetailsData;
  onExportInsights: (format: 'pdf' | 'markdown' | 'text') => void;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ meeting, onExportInsights }) => {
  const [format, setFormat] = useState<'paragraph' | 'bullets'>('paragraph');
  const [isExporting, setIsExporting] = useState(false);

  const { insights, loading, error, isRegenerating, generationProgress, regenerate } = useAIInsights(meeting.id);

  // Default empty insights structure
  const aiInsights = insights || {
    summary: null,
    keyDecisions: [],
    actionItems: [],
    sentiment: null,
    topics: [],
    participants: [],
    generated: false
  };

  // Format speaking time for display
  const formatSpeakingTime = (time: number | string): string => {
    if (typeof time === 'number') {
      // Convert decimal (0.45) to percentage (45%)
      return `${Math.round(time * 100)}%`;
    }
    return time;
  };

  const handleExport = async (exportFormat: 'pdf' | 'markdown' | 'text') => {
    setIsExporting(true);

    let content = '';

    if (exportFormat === 'markdown') {
      content = `# AI Insights - ${meeting.title}\n\n`;
      content += `**Date:** ${meeting.date}\n`;
      content += `**Duration:** ${meeting.duration} minutes\n`;
      content += `**Participants:** ${meeting.participants.map(p => p.name).join(', ')}\n\n`;
      content += `---\n\n`;

      // Summary Section
      content += `## Summary\n\n`;
      if (format === 'paragraph' && aiInsights.summary) {
        content += `${aiInsights.summary.paragraph}\n\n`;
      } else if (aiInsights.summary) {
        content += aiInsights.summary.bullets.map((bullet: string) => `- ${bullet}`).join('\n') + '\n\n';
      } else {
        content += `*No summary available.*\n\n`;
      }

      // Key Decisions Section
      content += `## Key Decisions\n\n`;
      if (aiInsights.keyDecisions.length > 0) {
        aiInsights.keyDecisions.forEach((decision: typeof aiInsights.keyDecisions[0], index: number) => {
          content += `### ${index + 1}. ${decision.decision}\n`;
          content += `**Context:** ${decision.context}\n`;
          content += `**Impact:** ${decision.impact}\n`;
          content += `**Participants:** ${decision.participants.join(', ')}\n`;
          if (decision.confidence !== undefined) {
            content += `**Confidence:** ${Math.round(decision.confidence * 100)}%\n`;
          }
          content += `\n`;
        });
      } else {
        content += `*No decisions identified.*\n\n`;
      }

      // Action Items Section
      content += `## Action Items\n\n`;
      if (aiInsights.actionItems.length > 0) {
        aiInsights.actionItems.forEach((item: typeof aiInsights.actionItems[0], index: number) => {
          content += `### ${index + 1}. ${item.title}\n`;
          if (item.description) {
            content += `${item.description}\n\n`;
          }
          content += `**Assignee:** ${item.assignee || 'Unassigned'}\n`;
          content += `**Due Date:** ${item.dueDate || 'Not set'}\n`;
          if (item.confidence !== undefined) {
            content += `**Confidence:** ${Math.round(item.confidence * 100)}%\n`;
          }
          content += `\n`;
        });
      } else {
        content += `*No action items detected.*\n\n`;
      }

      // Topics Section
      content += `## Topics Discussed\n\n`;
      if (aiInsights.topics.length > 0) {
        aiInsights.topics.forEach((topic: typeof aiInsights.topics[0], index: number) => {
          content += `${index + 1}. **${topic.name}**`;
          if (topic.mentions !== undefined) {
            content += ` (mentioned ${topic.mentions} time${topic.mentions !== 1 ? 's' : ''})`;
          }
          if (topic.sentiment) {
            content += ` - ${topic.sentiment} sentiment`;
          }
          content += `\n`;
        });
        content += `\n`;
      } else {
        content += `*No topics identified.*\n\n`;
      }

      // Sentiment Analysis Section
      content += `## Sentiment Analysis\n\n`;
      if (aiInsights.sentiment) {
        content += `**Overall Sentiment:** ${aiInsights.sentiment.overall}\n`;
        content += `**Confidence:** ${Math.round(aiInsights.sentiment.confidence * 100)}%\n\n`;
        if (aiInsights.sentiment.breakdown) {
          content += `**Breakdown:**\n`;
          content += `- Positive: ${Math.round(aiInsights.sentiment.breakdown.positive * 100)}%\n`;
          content += `- Neutral: ${Math.round(aiInsights.sentiment.breakdown.neutral * 100)}%\n`;
          content += `- Negative: ${Math.round(aiInsights.sentiment.breakdown.negative * 100)}%\n\n`;
        }
      } else {
        content += `*No sentiment analysis available.*\n\n`;
      }

      // Participant Analysis Section
      content += `## Participant Analysis\n\n`;
      if (aiInsights.participants.length > 0) {
        aiInsights.participants.forEach((participant: typeof aiInsights.participants[0]) => {
          content += `### ${participant.name}\n`;
          content += `**Speaking Time:** ${formatSpeakingTime(participant.speakingTime)}\n`;
          content += `**Engagement Level:** ${participant.engagement}\n`;
          if (participant.sentiment) {
            content += `**Sentiment:** ${participant.sentiment}\n`;
          }
          if (participant.keyContributions && participant.keyContributions.length > 0) {
            content += `**Key Contributions:**\n`;
            participant.keyContributions.forEach((contribution: string) => {
              content += `- ${contribution}\n`;
            });
          }
          content += `\n`;
        });
      } else {
        content += `*No participant analysis available.*\n\n`;
      }

    } else {
      // Text format
      content = `AI INSIGHTS - ${meeting.title}\n`;
      content += `${'='.repeat(50)}\n\n`;
      content += `Date: ${meeting.date}\n`;
      content += `Duration: ${meeting.duration} minutes\n`;
      content += `Participants: ${meeting.participants.map(p => p.name).join(', ')}\n\n`;
      content += `${'-'.repeat(50)}\n\n`;

      // Summary Section
      content += `SUMMARY:\n`;
      if (format === 'paragraph' && aiInsights.summary) {
        content += `${aiInsights.summary.paragraph}\n\n`;
      } else if (aiInsights.summary) {
        content += aiInsights.summary.bullets.map((bullet: string) => `• ${bullet}`).join('\n') + '\n\n';
      } else {
        content += `No summary available.\n\n`;
      }

      // Key Decisions Section
      content += `KEY DECISIONS:\n`;
      if (aiInsights.keyDecisions.length > 0) {
        aiInsights.keyDecisions.forEach((decision: typeof aiInsights.keyDecisions[0], index: number) => {
          content += `${index + 1}. ${decision.decision}\n`;
          content += `   Context: ${decision.context}\n`;
          content += `   Impact: ${decision.impact}\n`;
          content += `   Participants: ${decision.participants.join(', ')}\n`;
          if (decision.confidence !== undefined) {
            content += `   Confidence: ${Math.round(decision.confidence * 100)}%\n`;
          }
          content += `\n`;
        });
      } else {
        content += `No decisions identified.\n\n`;
      }

      // Action Items Section
      content += `ACTION ITEMS:\n`;
      if (aiInsights.actionItems.length > 0) {
        aiInsights.actionItems.forEach((item: typeof aiInsights.actionItems[0], index: number) => {
          content += `${index + 1}. ${item.title}\n`;
          if (item.description) {
            content += `   ${item.description}\n`;
          }
          content += `   Assignee: ${item.assignee || 'Unassigned'}\n`;
          content += `   Due Date: ${item.dueDate || 'Not set'}\n`;
          if (item.confidence !== undefined) {
            content += `   Confidence: ${Math.round(item.confidence * 100)}%\n`;
          }
          content += `\n`;
        });
      } else {
        content += `No action items detected.\n\n`;
      }

      // Topics Section
      content += `TOPICS DISCUSSED:\n`;
      if (aiInsights.topics.length > 0) {
        aiInsights.topics.forEach((topic: typeof aiInsights.topics[0], index: number) => {
          content += `${index + 1}. ${topic.name}`;
          if (topic.mentions !== undefined) {
            content += ` (mentioned ${topic.mentions} time${topic.mentions !== 1 ? 's' : ''})`;
          }
          if (topic.sentiment) {
            content += ` - ${topic.sentiment} sentiment`;
          }
          content += `\n`;
        });
        content += `\n`;
      } else {
        content += `No topics identified.\n\n`;
      }

      // Sentiment Analysis Section
      content += `SENTIMENT ANALYSIS:\n`;
      if (aiInsights.sentiment) {
        content += `Overall Sentiment: ${aiInsights.sentiment.overall}\n`;
        content += `Confidence: ${Math.round(aiInsights.sentiment.confidence * 100)}%\n\n`;
        if (aiInsights.sentiment.breakdown) {
          content += `Breakdown:\n`;
          content += `  Positive: ${Math.round(aiInsights.sentiment.breakdown.positive * 100)}%\n`;
          content += `  Neutral: ${Math.round(aiInsights.sentiment.breakdown.neutral * 100)}%\n`;
          content += `  Negative: ${Math.round(aiInsights.sentiment.breakdown.negative * 100)}%\n\n`;
        }
      } else {
        content += `No sentiment analysis available.\n\n`;
      }

      // Participant Analysis Section
      content += `PARTICIPANT ANALYSIS:\n`;
      if (aiInsights.participants.length > 0) {
        aiInsights.participants.forEach((participant: typeof aiInsights.participants[0], index: number) => {
          content += `${index + 1}. ${participant.name}\n`;
          content += `   Speaking Time: ${formatSpeakingTime(participant.speakingTime)}\n`;
          content += `   Engagement Level: ${participant.engagement}\n`;
          if (participant.sentiment) {
            content += `   Sentiment: ${participant.sentiment}\n`;
          }
          if (participant.keyContributions && participant.keyContributions.length > 0) {
            content += `   Key Contributions:\n`;
            participant.keyContributions.forEach((contribution: string) => {
              content += `     - ${contribution}\n`;
            });
          }
          content += `\n`;
        });
      } else {
        content += `No participant analysis available.\n\n`;
      }
    }

    const fileExtension = exportFormat === 'markdown' ? 'md' : exportFormat === 'pdf' ? 'txt' : 'txt';
    const mimeType = exportFormat === 'markdown' ? 'text/markdown' : 'text/plain';
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_insights_${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExporting(false);
    onExportInsights(exportFormat);
  };

  const handleCopy = () => {
    if (!aiInsights.summary) return;
    const content = format === 'paragraph'
      ? aiInsights.summary.paragraph
      : aiInsights.summary.bullets.join('\n');
    navigator.clipboard.writeText(content);
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-600 dark:text-slate-400">
          Generating AI insights...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
        <p className="text-slate-700 dark:text-slate-300 font-medium">
          Failed to load AI insights
        </p>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          {error}
        </p>
        <button
          onClick={() => {
            console.log('🔵 [AIInsightsPanel] Retry button clicked in error state!');
            console.log('   Calling regenerate() to trigger generation');
            regenerate();
          }}
          disabled={isRegenerating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
        >
          {isRegenerating ? 'Generating...' : 'Retry'}
        </button>
      </div>
    );
  }

  // Empty or missing insights
  const isGeneratingServer = insights?.generating;
  if (!insights?.generated || (!aiInsights.summary && aiInsights.keyDecisions.length === 0)) {
    // Show progress state only when generating
    if (isRegenerating || isGeneratingServer) {
      const currentProgress = generationProgress;

      return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[400px] space-y-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">{currentProgress}%</span>
            </div>
          </div>

          <div className="text-center max-w-md space-y-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Generating AI Insights
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Analyzing meeting transcript, extracting action items, and summarizing key decisions...
            </p>
          </div>

          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${currentProgress}%` }}
            ></div>
          </div>
        </div>
      );
    }

    // Idle/failed state with action
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <FileText className="w-12 h-12 text-slate-400" />
        <p className="text-slate-700 dark:text-slate-300 font-medium">
          AI Insights Not Available
        </p>
        <p className="text-slate-600 dark:text-slate-400 text-sm text-center max-w-md">
          {error ? error : 'Click generate to create insights for this meeting.'}
        </p>
        <button
          onClick={() => {
            console.log('🔵 [AIInsightsPanel] Generate Insights button clicked!');
            console.log('   regenerate function:', regenerate);
            console.log('   meeting.id:', meeting.id);
            console.log('   isRegenerating:', isRegenerating);
            regenerate();
          }}
          disabled={isRegenerating}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Regenerating...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Generate Insights</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            AI Insights
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Intelligent analysis of meeting content and discussions
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Format Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setFormat('paragraph')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${format === 'paragraph'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <AlignLeft className="w-4 h-4" />
              <span>Paragraph</span>
            </button>
            <button
              onClick={() => setFormat('bullets')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${format === 'bullets'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <List className="w-4 h-4" />
              <span>Bullets</span>
            </button>
          </div>

          {/* Regenerate Button */}
          <button
            onClick={() => {
              console.log('🔵 [AIInsightsPanel] Regenerate button clicked (header)!');
              console.log('   regenerate function:', regenerate);
              console.log('   meeting.id:', meeting.id);
              console.log('   isRegenerating:', isRegenerating);
              regenerate();
            }}
            disabled={isRegenerating}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            title="Regenerate insights"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Regenerate</span>
              </>
            )}
          </button>

          {/* Export Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              disabled={!aiInsights.summary}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy summary"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleExport('text')}
              disabled={isExporting}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Export TXT</span>
            </button>
            <button
              onClick={() => handleExport('markdown')}
              disabled={isExporting}
              className="flex items-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Export MD</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      {aiInsights.summary && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Meeting Summary
          </h4>
          {format === 'paragraph' ? (
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {aiInsights.summary.paragraph}
            </p>
          ) : (
            <ul className="space-y-2">
              {aiInsights.summary.bullets.map((bullet: string, index: number) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span className="text-slate-700 dark:text-slate-300">{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Key Decisions */}
      {aiInsights.keyDecisions.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
            Key Decisions
          </h4>
          <div className="space-y-4">
            {aiInsights.keyDecisions.map((decision: typeof aiInsights.keyDecisions[0], index: number) => (
              <div key={index} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h5 className="font-medium text-slate-900 dark:text-white mb-2">
                  {decision.decision}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Context:</span>
                    <p className="text-slate-700 dark:text-slate-300">{decision.context}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Impact:</span>
                    <p className="text-slate-700 dark:text-slate-300">{decision.impact}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Participants:</span>
                    <p className="text-slate-700 dark:text-slate-300">{decision.participants.join(', ')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {aiInsights.actionItems.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
            Action Items
          </h4>
          <div className="space-y-3">
            {aiInsights.actionItems.map((item: typeof aiInsights.actionItems[0], index: number) => (
              <div key={index} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white mb-2">{item.title}</p>
                  {item.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{item.description}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                    {item.assignee && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-500">Assignee:</span>
                        <span className="font-medium">{item.assignee}</span>
                      </div>
                    )}
                    {item.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-500">Due:</span>
                        <span className="font-medium">{item.dueDate}</span>
                      </div>
                    )}
                    {item.confidence !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-500">Confidence:</span>
                        <span className="font-medium">{Math.round(item.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment Analysis */}
      {aiInsights.sentiment && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Sentiment Analysis
          </h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {aiInsights.sentiment.overall}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {Math.round(aiInsights.sentiment.confidence * 100)}% confidence
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                  <div
                    className="h-2 bg-green-500 rounded-full"
                    style={{ width: `${aiInsights.sentiment.breakdown.positive * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Positive</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                  <div
                    className="h-2 bg-yellow-500 rounded-full"
                    style={{ width: `${aiInsights.sentiment.breakdown.neutral * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Neutral</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                  <div
                    className="h-2 bg-red-500 rounded-full"
                    style={{ width: `${aiInsights.sentiment.breakdown.negative * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Negative</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Topics and Participants */}
      {(aiInsights.topics.length > 0 || aiInsights.participants.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Topics */}
          {aiInsights.topics.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Key Topics
              </h4>
              <div className="space-y-3">
                {aiInsights.topics.map((topic: typeof aiInsights.topics[0], index: number) => (
                  <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{topic.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{topic.mentions} mentions</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${topic.sentiment === 'Positive'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : topic.sentiment === 'Negative'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                      {topic.sentiment}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants */}
          {aiInsights.participants.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Participant Analysis
              </h4>
              <div className="space-y-3">
                {aiInsights.participants.map((participant: typeof aiInsights.participants[0], index: number) => (
                  <div key={index} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-slate-900 dark:text-white">{participant.name}</p>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {formatSpeakingTime(participant.speakingTime)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Engagement:</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${participant.engagement === 'High'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : participant.engagement === 'Medium'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {participant.engagement}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Key Contributions:</p>
                      <ul className="text-sm text-slate-700 dark:text-slate-300">
                        {participant.keyContributions.map((contribution: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-1">
                            <span className="w-1 h-1 bg-slate-400 rounded-full mt-2 flex-shrink-0"></span>
                            <span>{contribution}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIInsightsPanel;
