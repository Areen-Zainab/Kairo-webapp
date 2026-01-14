import React, { useState, useEffect, useRef } from 'react';
import { FileText, List, AlignLeft, Copy, RefreshCw, Loader2, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import type { MeetingDetailsData } from './types';
import { useAIInsights } from '../../../hooks/useAIInsights';

interface AIInsightsPanelProps {
  meeting: MeetingDetailsData;
  onExportInsights: (format: 'pdf' | 'markdown' | 'text') => void;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ meeting, onExportInsights }) => {
  const [format, setFormat] = useState<'paragraph' | 'bullets'>('paragraph');
  const [summaryView, setSummaryView] = useState<'executive' | 'detailed' | 'bullet'>('detailed');
  const [isExporting, setIsExporting] = useState(false);
  
  // Track which insights have appeared to trigger animations
  const [appearedInsights, setAppearedInsights] = useState<Set<string>>(new Set());
  const [newInsight, setNewInsight] = useState<string | null>(null);
  const prevInsightsRef = useRef<any>(null);

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

  // Calculate progress based on insights received
  const calculateProgress = () => {
    if (!aiInsights) return 0;
    
    let completedCount = 0;
    if (aiInsights.keyDecisions?.length) completedCount++;
    if (aiInsights.sentiment) completedCount++;
    if (aiInsights.topics?.length) completedCount++;
    if (aiInsights.actionItems?.length) completedCount++;
    if (aiInsights.participants?.length) completedCount++;
    if (aiInsights.summary) completedCount++;
    
    return Math.round((completedCount / 6) * 100);
  };

  const calculatedProgress = calculateProgress();

  // Detect new insights appearing and trigger animations
  useEffect(() => {
    if (!insights || !prevInsightsRef.current) {
      prevInsightsRef.current = insights;
      return;
    }

    const prev = prevInsightsRef.current;
    const current = insights;

    // Check which insights just appeared
    const newInsights: string[] = [];
    
    if (!prev.keyDecisions?.length && current.keyDecisions?.length) {
      newInsights.push('decisions');
    }
    if (!prev.sentiment && current.sentiment) {
      newInsights.push('sentiment');
    }
    if (!prev.topics?.length && current.topics?.length) {
      newInsights.push('topics');
    }
    if (!prev.actionItems?.length && current.actionItems?.length) {
      newInsights.push('actionItems');
    }
    if (!prev.participants?.length && current.participants?.length) {
      newInsights.push('participants');
    }
    if (!prev.summary && current.summary) {
      newInsights.push('summary');
    }

    if (newInsights.length > 0) {
      // Mark as appeared
      setAppearedInsights(prev => new Set([...prev, ...newInsights]));
      
      // Show notification for the newest insight
      setNewInsight(newInsights[newInsights.length - 1]);
      setTimeout(() => setNewInsight(null), 3000);
    }

    prevInsightsRef.current = current;
  }, [insights]);

  // Helper to check if insight just appeared
  const isNewInsight = (insightType: string) => {
    return appearedInsights.has(insightType) && newInsight === insightType;
  };

  // Helper to check if decisions are placeholder
  const hasRealDecisions = (decisions: any[]) => {
    if (!decisions || decisions.length === 0) return false;
    if (decisions.length === 1) {
      const firstDecision = decisions[0];
      const text = firstDecision.decision || '';
      return !(text === 'No decisions identified.' || text === 'No decisions made' || text.toLowerCase().includes('no decision'));
    }
    return true;
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

  // Empty or missing insights - show progress banner instead of loading spinner
  const isGeneratingServer = insights?.generating;
  if (!insights?.generated || (!aiInsights.summary && aiInsights.keyDecisions.length === 0)) {
    // Show progress state when generating or when progress < 100%
    if (isRegenerating || isGeneratingServer || calculatedProgress < 100) {
      return (
        <div className="p-6 space-y-6">
          {/* Progress Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-600 p-4 rounded-lg animate-fade-in">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  AI is analyzing this meeting...
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Insights will appear here as they're generated. This usually takes 1-2 minutes.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{calculatedProgress}%</p>
                <p className="text-xs text-slate-500">Complete</p>
              </div>
            </div>
            
            {/* Progress checklist */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className={`flex items-center space-x-2 ${aiInsights.keyDecisions?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                {aiInsights.keyDecisions?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Decisions</span>
              </div>
              <div className={`flex items-center space-x-2 ${aiInsights.sentiment ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                {aiInsights.sentiment ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Sentiment</span>
              </div>
              <div className={`flex items-center space-x-2 ${aiInsights.topics?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                {aiInsights.topics?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Topics</span>
              </div>
              <div className={`flex items-center space-x-2 ${aiInsights.actionItems?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                {aiInsights.actionItems?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Action Items</span>
              </div>
              <div className={`flex items-center space-x-2 ${aiInsights.participants?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                {aiInsights.participants?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Participants</span>
              </div>
              <div className={`flex items-center space-x-2 ${aiInsights.summary ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                {aiInsights.summary ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Summary</span>
              </div>
            </div>
          </div>

          {/* Placeholder content areas that will be populated */}
          <div className="space-y-4 opacity-40">
            <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
            <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
            <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
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
      {/* New Insight Notification */}
      {newInsight && (
        <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center space-x-3 animate-bounce-gentle">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="font-medium">
              {newInsight === 'decisions' && '✨ Decisions analyzed!'}
              {newInsight === 'sentiment' && '✨ Sentiment captured!'}
              {newInsight === 'topics' && '✨ Topics identified!'}
              {newInsight === 'actionItems' && '✨ Action items detected!'}
              {newInsight === 'participants' && '✨ Participants analyzed!'}
              {newInsight === 'summary' && '✨ Summary complete!'}
            </span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      )}

      {/* Generation Progress Banner */}
      {(isRegenerating || insights?.generating || calculatedProgress < 100) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-600 p-4 rounded-lg animate-fade-in">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                AI is analyzing this meeting...
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Insights will appear here as they're generated. This usually takes 1-2 minutes.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{calculatedProgress}%</p>
              <p className="text-xs text-slate-500">Complete</p>
            </div>
          </div>
          
          {/* Progress checklist */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className={`flex items-center space-x-2 ${aiInsights.keyDecisions?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
              {aiInsights.keyDecisions?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Decisions</span>
            </div>
            <div className={`flex items-center space-x-2 ${aiInsights.sentiment ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
              {aiInsights.sentiment ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Sentiment</span>
            </div>
            <div className={`flex items-center space-x-2 ${aiInsights.topics?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
              {aiInsights.topics?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Topics</span>
            </div>
            <div className={`flex items-center space-x-2 ${aiInsights.actionItems?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
              {aiInsights.actionItems?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Action Items</span>
            </div>
            <div className={`flex items-center space-x-2 ${aiInsights.participants?.length ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
              {aiInsights.participants?.length ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Participants</span>
            </div>
            <div className={`flex items-center space-x-2 ${aiInsights.summary ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
              {aiInsights.summary ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Summary</span>
            </div>
          </div>
        </div>
      )}

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
        <div className={`bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6 ${isNewInsight('summary') ? 'animate-scale-in' : 'animate-fade-in'}`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
              Meeting Summary
            </h4>
            
            {/* Format Toggles on the Right */}
            <div className="flex items-center space-x-3">
              {/* Summary View Selector - Only show if layered summaries exist */}
              {(aiInsights.summary.executive_summary || aiInsights.summary.detailed_summary || aiInsights.summary.bullet_summary) && (
                <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg p-1 border border-slate-200 dark:border-slate-600">
                  <button
                    onClick={() => setSummaryView('executive')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      summaryView === 'executive'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="2-3 sentence executive summary"
                  >
                    Executive
                  </button>
                  <button
                    onClick={() => setSummaryView('detailed')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      summaryView === 'detailed'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Full narrative summary"
                  >
                    Detailed
                  </button>
                  <button
                    onClick={() => setSummaryView('bullet')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      summaryView === 'bullet'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Quick bullet points"
                  >
                    Bullets
                  </button>
                </div>
              )}
              
              {/* Paragraph/Bullets Format Toggle */}
              {!(aiInsights.summary.executive_summary || aiInsights.summary.detailed_summary || aiInsights.summary.bullet_summary) && (
                <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                  <button
                    onClick={() => setFormat('paragraph')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${format === 'paragraph'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>Paragraph</span>
                  </button>
                  <button
                    onClick={() => setFormat('bullets')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${format === 'bullets'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Bullets</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Render based on summary view */}
          {summaryView === 'executive' && aiInsights.summary.executive_summary ? (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-600 p-4 rounded">
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {aiInsights.summary.executive_summary}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                ⚡ Executive Summary
              </p>
            </div>
          ) : summaryView === 'detailed' && aiInsights.summary.detailed_summary ? (
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {aiInsights.summary.detailed_summary}
              </p>
            </div>
          ) : summaryView === 'bullet' && aiInsights.summary.bullet_summary ? (
            <ul className="space-y-2">
              {aiInsights.summary.bullet_summary.map((bullet: string, index: number) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span className="text-slate-700 dark:text-slate-300">{bullet}</span>
                </li>
              ))}
            </ul>
          ) : format === 'paragraph' ? (
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
        <div className={`space-y-4 ${isNewInsight('decisions') ? 'animate-scale-in' : 'animate-fade-in'}`}>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
            Key Decisions
          </h4>
          {hasRealDecisions(aiInsights.keyDecisions) ? (
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
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">No Decisions Made</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  This meeting did not result in any formal decisions.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Items */}
      {aiInsights.actionItems.length > 0 && (
        <div className={`space-y-4 ${isNewInsight('actionItems') ? 'animate-scale-in' : 'animate-fade-in'}`}>
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
        <div className={`bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 ${isNewInsight('sentiment') ? 'animate-scale-in' : 'animate-fade-in'}`}>
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
            <div className={isNewInsight('topics') ? 'animate-scale-in' : 'animate-fade-in'}>
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
            <div className={isNewInsight('participants') ? 'animate-scale-in' : 'animate-fade-in'}>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Participant Analysis
              </h4>
              <div className="space-y-3">
                {aiInsights.participants.map((participant: typeof aiInsights.participants[0], index: number) => {
                  // Handle speaker IDs that might be UNKNOWN or Speaker_N
                  const displayName = participant.name || `Participant ${index + 1}`;
                  const isUnknownSpeaker = !participant.name || 
                    participant.name.toUpperCase() === 'UNKNOWN' || 
                    participant.name.startsWith('Speaker_') ||
                    participant.name.startsWith('SPEAKER');
                  
                  return (
                    <div key={index} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {isUnknownSpeaker && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                              {participant.name}
                            </span>
                          )}
                          <p className="font-medium text-slate-900 dark:text-white">
                            {isUnknownSpeaker ? `Unidentified Speaker` : displayName}
                          </p>
                        </div>
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIInsightsPanel;
