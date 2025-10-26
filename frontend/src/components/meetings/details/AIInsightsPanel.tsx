import React, { useState } from 'react';
import { Download, FileText, List, AlignLeft, AlignCenter, AlignJustify, Copy, Share2 } from 'lucide-react';
import type { MeetingDetailsData } from './types';

interface AIInsightsPanelProps {
  meeting: MeetingDetailsData;
  onExportInsights: (format: 'pdf' | 'markdown' | 'text') => void;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ meeting, onExportInsights }) => {
  const [format, setFormat] = useState<'paragraph' | 'bullets'>('paragraph');
  const [isExporting, setIsExporting] = useState(false);

  // Mock AI insights data - in real app, this would come from API
  const aiInsights = {
    summary: {
      paragraph: `This sprint planning meeting focused on prioritizing Q4 backlog items and establishing clear sprint goals for Team A. The team successfully reviewed previous sprint achievements, with particular emphasis on the completion of the user authentication feature. Key decisions were made regarding dashboard redesign priorities and notification system implementation timelines. The meeting demonstrated strong collaboration between team members and clear alignment on upcoming deliverables.`,
      bullets: [
        "Sprint planning meeting for Team A's Q4 backlog prioritization",
        "Successfully reviewed previous sprint achievements",
        "User authentication feature completion highlighted as major win",
        "Dashboard redesign assigned to Fatima with high priority",
        "Notification system implementation timeline established",
        "Strong team collaboration and clear alignment on deliverables"
      ]
    },
    keyDecisions: [
      {
        decision: "Dashboard redesign will be the primary focus for next sprint",
        context: "Discussed during slide 3 presentation",
        impact: "High - affects user experience and development timeline",
        participants: ["Areeba Riaz", "Fatima Ali"]
      },
      {
        decision: "Notification system implementation timeline set to 2 weeks",
        context: "Technical discussion during slide 2",
        impact: "Medium - requires backend and frontend coordination",
        participants: ["Ahmed Khan", "Fatima Ali"]
      }
    ],
    actionItems: [
      {
        item: "Complete dashboard wireframes by end of week",
        assignee: "Fatima Ali",
        dueDate: "2024-01-22",
        priority: "High"
      },
      {
        item: "Set up notification service infrastructure",
        assignee: "Ahmed Khan",
        dueDate: "2024-01-25",
        priority: "Medium"
      },
      {
        item: "Prepare mobile app development timeline",
        assignee: "Areeba Riaz",
        dueDate: "2024-01-30",
        priority: "Low"
      }
    ],
    sentiment: {
      overall: "Positive",
      confidence: 0.87,
      breakdown: {
        positive: 0.65,
        neutral: 0.25,
        negative: 0.10
      }
    },
    topics: [
      { name: "Sprint Planning", mentions: 15, sentiment: "Positive" },
      { name: "Dashboard Redesign", mentions: 8, sentiment: "Positive" },
      { name: "User Authentication", mentions: 6, sentiment: "Positive" },
      { name: "Notification System", mentions: 5, sentiment: "Neutral" },
      { name: "Mobile App", mentions: 3, sentiment: "Positive" }
    ],
    participants: [
      { name: "Areeba Riaz", speakingTime: "45%", engagement: "High", keyContributions: ["Meeting facilitation", "Timeline planning"] },
      { name: "Ahmed Khan", speakingTime: "30%", engagement: "High", keyContributions: ["Technical insights", "Implementation details"] },
      { name: "Fatima Ali", speakingTime: "25%", engagement: "Medium", keyContributions: ["Design input", "User experience focus"] }
    ]
  };

  const handleExport = async (exportFormat: 'pdf' | 'markdown' | 'text') => {
    setIsExporting(true);
    
    let content = '';
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (exportFormat === 'markdown') {
      content = `# AI Insights - ${meeting.title}\n\n`;
      content += `**Date:** ${meeting.date}\n`;
      content += `**Duration:** ${meeting.duration} minutes\n\n`;
      
      content += `## Summary\n\n`;
      if (format === 'paragraph') {
        content += `${aiInsights.summary.paragraph}\n\n`;
      } else {
        content += aiInsights.summary.bullets.map(bullet => `- ${bullet}`).join('\n') + '\n\n';
      }
      
      content += `## Key Decisions\n\n`;
      aiInsights.keyDecisions.forEach((decision, index) => {
        content += `### ${index + 1}. ${decision.decision}\n`;
        content += `**Context:** ${decision.context}\n`;
        content += `**Impact:** ${decision.impact}\n`;
        content += `**Participants:** ${decision.participants.join(', ')}\n\n`;
      });
      
      content += `## Action Items\n\n`;
      aiInsights.actionItems.forEach((item, index) => {
        content += `### ${index + 1}. ${item.item}\n`;
        content += `**Assignee:** ${item.assignee}\n`;
        content += `**Due Date:** ${item.dueDate}\n`;
        content += `**Priority:** ${item.priority}\n\n`;
      });
    } else {
      // Text format
      content = `AI INSIGHTS - ${meeting.title}\n`;
      content += `Date: ${meeting.date}\n`;
      content += `Duration: ${meeting.duration} minutes\n\n`;
      
      content += `SUMMARY:\n`;
      if (format === 'paragraph') {
        content += `${aiInsights.summary.paragraph}\n\n`;
      } else {
        content += aiInsights.summary.bullets.map(bullet => `• ${bullet}`).join('\n') + '\n\n';
      }
      
      content += `KEY DECISIONS:\n`;
      aiInsights.keyDecisions.forEach((decision, index) => {
        content += `${index + 1}. ${decision.decision}\n`;
        content += `   Context: ${decision.context}\n`;
        content += `   Impact: ${decision.impact}\n`;
        content += `   Participants: ${decision.participants.join(', ')}\n\n`;
      });
    }
    
    const blob = new Blob([content], { 
      type: exportFormat === 'markdown' ? 'text/markdown' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_insights_${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${exportFormat === 'markdown' ? 'md' : 'txt'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsExporting(false);
    onExportInsights(exportFormat);
  };

  const handleCopy = () => {
    const content = format === 'paragraph' 
      ? aiInsights.summary.paragraph 
      : aiInsights.summary.bullets.join('\n');
    navigator.clipboard.writeText(content);
  };

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
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                format === 'paragraph'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlignLeft className="w-4 h-4" />
              <span>Paragraph</span>
            </button>
            <button
              onClick={() => setFormat('bullets')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                format === 'bullets'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Bullets</span>
            </button>
          </div>
          
          {/* Export Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
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
            {aiInsights.summary.bullets.map((bullet, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-300">{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Key Decisions */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
          Key Decisions
        </h4>
        <div className="space-y-4">
          {aiInsights.keyDecisions.map((decision, index) => (
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

      {/* Action Items */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
          Action Items
        </h4>
        <div className="space-y-3">
          {aiInsights.actionItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-white">{item.item}</p>
                <div className="flex items-center space-x-4 mt-1 text-sm text-slate-600 dark:text-slate-400">
                  <span>Assignee: {item.assignee}</span>
                  <span>Due: {item.dueDate}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    item.priority === 'High' 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : item.priority === 'Medium'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sentiment Analysis */}
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

      {/* Topics and Participants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topics */}
        <div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Key Topics
          </h4>
          <div className="space-y-3">
            {aiInsights.topics.map((topic, index) => (
              <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{topic.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{topic.mentions} mentions</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  topic.sentiment === 'Positive' 
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

        {/* Participants */}
        <div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Participant Analysis
          </h4>
          <div className="space-y-3">
            {aiInsights.participants.map((participant, index) => (
              <div key={index} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-slate-900 dark:text-white">{participant.name}</p>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{participant.speakingTime}</span>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Engagement:</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    participant.engagement === 'High' 
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
                    {participant.keyContributions.map((contribution, idx) => (
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
      </div>
    </div>
  );
};

export default AIInsightsPanel;
