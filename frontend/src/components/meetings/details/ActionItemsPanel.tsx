import React, { useState } from 'react';
import { Plus, CheckCircle, Clock, User, Calendar, AlertCircle } from 'lucide-react';
import type { MeetingDetailsData } from './types';

interface ActionItemsPanelProps {
  meeting: MeetingDetailsData;
  onAddActionItem: (actionItem: Omit<ActionItem, 'id'>) => void;
  onUpdateActionItem: (id: string, actionItem: Partial<ActionItem>) => void;
  onDeleteActionItem: (id: string) => void;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  assignee: {
    id: string;
    name: string;
    avatar: string;
  };
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

const ActionItemsPanel: React.FC<ActionItemsPanelProps> = ({
  meeting,
  onAddActionItem,
  onUpdateActionItem,
  onDeleteActionItem
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newActionItem, setNewActionItem] = useState({
    title: '',
    description: '',
    assignee: meeting.participants[0]?.id || '',
    dueDate: '',
    priority: 'medium' as const
  });

  // Mock action items data - in real app, this would come from API
  const actionItems: ActionItem[] = [
    {
      id: '1',
      title: 'Complete dashboard wireframes',
      description: 'Create wireframes for the new dashboard design including user flow and component layouts',
      assignee: {
        id: '2',
        name: 'Fatima Ali',
        avatar: 'FA'
      },
      dueDate: '2024-01-22',
      priority: 'high',
      status: 'pending',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      title: 'Set up notification service',
      description: 'Implement backend notification service infrastructure and API endpoints',
      assignee: {
        id: '3',
        name: 'Ahmed Khan',
        avatar: 'AK'
      },
      dueDate: '2024-01-25',
      priority: 'medium',
      status: 'in-progress',
      createdAt: '2024-01-15T11:15:00Z',
      updatedAt: '2024-01-15T11:15:00Z'
    },
    {
      id: '3',
      title: 'Prepare mobile app timeline',
      description: 'Create detailed timeline and resource allocation for mobile app development',
      assignee: {
        id: '1',
        name: 'Areeba Riaz',
        avatar: 'AR'
      },
      dueDate: '2024-01-30',
      priority: 'low',
      status: 'completed',
      createdAt: '2024-01-15T12:00:00Z',
      updatedAt: '2024-01-15T12:00:00Z'
    }
  ];

  const handleAddActionItem = () => {
    if (newActionItem.title.trim() && newActionItem.dueDate) {
      const assignee = meeting.participants.find(p => p.id === newActionItem.assignee);
      if (assignee) {
        onAddActionItem({
          title: newActionItem.title.trim(),
          description: newActionItem.description.trim(),
          assignee: {
            id: assignee.id,
            name: assignee.name,
            avatar: assignee.avatar || assignee.name.substring(0, 2).toUpperCase()
          },
          dueDate: newActionItem.dueDate,
          priority: newActionItem.priority,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setNewActionItem({
          title: '',
          description: '',
          assignee: meeting.participants[0]?.id || '',
          dueDate: '',
          priority: 'medium'
        });
        setIsAdding(false);
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in-progress':
        return <Clock className="w-4 h-4" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && actionItems.find(item => item.dueDate === dueDate)?.status !== 'completed';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            Action Items
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track and manage meeting action items
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Add Action Item</span>
        </button>
      </div>

      {/* Add Action Item Form */}
      {isAdding && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Add New Action Item
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={newActionItem.title}
                onChange={(e) => setNewActionItem({ ...newActionItem, title: e.target.value })}
                placeholder="Enter action item title..."
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={newActionItem.description}
                onChange={(e) => setNewActionItem({ ...newActionItem, description: e.target.value })}
                placeholder="Enter action item description..."
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Assignee *
                </label>
                <select
                  value={newActionItem.assignee}
                  onChange={(e) => setNewActionItem({ ...newActionItem, assignee: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {meeting.participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={newActionItem.dueDate}
                  onChange={(e) => setNewActionItem({ ...newActionItem, dueDate: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Priority
                </label>
                <select
                  value={newActionItem.priority}
                  onChange={(e) => setNewActionItem({ ...newActionItem, priority: e.target.value as any })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleAddActionItem}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                Add Action Item
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Items List */}
      <div className="space-y-4">
        {actionItems.map((item) => (
          <div
            key={item.id}
            className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-all ${
              isOverdue(item.dueDate) ? 'border-red-300 dark:border-red-700' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </h4>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                    {item.priority.toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(item.status)}`}>
                    {getStatusIcon(item.status)}
                    <span>{item.status.replace('-', ' ').toUpperCase()}</span>
                  </span>
                </div>
                {item.description && (
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    {item.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    {item.assignee.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className={`text-sm font-medium ${
                    isOverdue(item.dueDate) 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {new Date(item.dueDate).toLocaleDateString()}
                    {isOverdue(item.dueDate) && ' (Overdue)'}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onUpdateActionItem(item.id, { status: 'completed' })}
                  className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Mark as completed"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteActionItem(item.id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete action item"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {actionItems.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="font-medium">No action items yet</p>
          <p className="text-sm mt-1">Add your first action item above</p>
        </div>
      )}
    </div>
  );
};

export default ActionItemsPanel;
