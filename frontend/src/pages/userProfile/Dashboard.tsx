import { useState } from 'react';
import { Plus, Users, Calendar, BarChart3, CheckSquare, TrendingUp, X, Clock, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';

const Dashboard = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const user = {
    name: 'Alex Johnson',
    email: 'alex@company.com',
    avatar: 'AJ'
  };

  const workspaces = [
    {
      id: 1,
      name: 'Product Team Alpha',
      role: 'Manager',
      members: 12,
      meetings: 24,
      pendingTasks: 8,
      gradient: 'from-blue-500 to-cyan-500',
      lastActive: '2 hours ago',
    },
    {
      id: 2,
      name: 'Design Sprint Team',
      role: 'Developer',
      members: 6,
      meetings: 15,
      pendingTasks: 3,
      gradient: 'from-purple-500 to-pink-500',
      lastActive: '1 day ago',
    },
    {
      id: 3,
      name: 'Client Solutions',
      role: 'QA Engineer',
      members: 8,
      meetings: 31,
      pendingTasks: 12,
      gradient: 'from-green-500 to-teal-500',
      lastActive: '3 days ago',
    }
  ];

  const notifications = [
    { id: 1, text: 'New task assigned in Product Team', time: '5m ago', unread: true },
    { id: 2, text: 'Meeting starts in 30 minutes', time: '10m ago', unread: true },
    { id: 3, text: 'Sprint retrospective completed', time: '2h ago', unread: false }
  ];

  return (
    <Layout>
      {/* Main Dashboard Content */}
      <div className="pr-0 lg:pr-80">
        <div className="p-6 lg:p-8">
          {/* Hero Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
              Welcome back, {user.name.split(' ')[0]} 👋
            </h1>
            <p className="text-slate-400 text-lg">Manage your workspaces and stay on top of your meetings</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setShowCreateModal(true)}
              className="group relative overflow-hidden p-6 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl hover:border-cyan-400/50 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
                  <Plus size={24} />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-semibold mb-1">Create Workspace</h3>
                  <p className="text-slate-400 text-sm">Start a new collaborative space</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setShowJoinModal(true)}
              className="group relative overflow-hidden p-6 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-2xl hover:border-purple-400/50 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-shadow">
                  <Mail size={24} />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-semibold mb-1">Join Workspace</h3>
                  <p className="text-slate-400 text-sm">Use an invitation code</p>
                </div>
              </div>
            </button>
          </div>

          {/* Workspaces Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span>Your Workspaces</span>
              <span className="px-3 py-1 bg-slate-800 rounded-full text-sm text-slate-400">
                {workspaces.length}
              </span>
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 bg-gradient-to-br ${workspace.gradient} rounded-xl flex items-center justify-center text-2xl font-bold shadow-lg`}>
                        {workspace.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-1">{workspace.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {workspace.lastActive}
                          </span>
                          <span>•</span>
                          <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">{workspace.role}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                        Open
                      </button>
                      <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors">
                        Manage
                      </button>
                      <button className="px-4 py-2 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 rounded-lg font-medium transition-all">
                        Leave
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className="text-cyan-400" />
                        <span className="text-xs text-slate-400">Members</span>
                      </div>
                      <p className="text-xl font-bold">{workspace.members}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={16} className="text-blue-400" />
                        <span className="text-xs text-slate-400">Meetings</span>
                      </div>
                      <p className="text-xl font-bold">{workspace.meetings}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckSquare size={16} className="text-green-400" />
                        <span className="text-xs text-slate-400">Tasks</span>
                      </div>
                      <p className="text-xl font-bold">{workspace.pendingTasks}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-purple-400" />
                        <span className="text-xs text-slate-400">Analytics</span>
                      </div>
                      <p className="text-xl font-bold">→</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="bg-transparent hidden lg:block fixed right-0 top-20 bottom-0 w-80 bg-slate-900/50 backdrop-blur-xl border-l border-slate-800/50 p-6 overflow-y-auto no-scrollbar">
        {/* Mini Calendar */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Calendar</h3>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">October 2025</h4>
              <div className="flex gap-1">
                <button className="p-1 hover:bg-slate-700 rounded">
                  <ChevronLeft size={16} />
                </button>
                <button className="p-1 hover:bg-slate-700 rounded">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-xs text-slate-500 p-1">{day}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => (
                <button
                  key={i}
                  className={`p-1 text-sm rounded hover:bg-slate-700 ${i === 11 ? 'bg-cyan-500 font-bold' : ''}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Notifications</h3>
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border transition-colors ${
                  notif.unread ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-800/50 border-slate-700/50'
                }`}
              >
                <p className="text-sm mb-1">{notif.text}</p>
                <p className="text-xs text-slate-500">{notif.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-colors text-left">
              <Calendar size={18} className="text-cyan-400" />
              <span className="text-sm">Schedule Meeting</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-colors text-left">
              <CheckSquare size={18} className="text-green-400" />
              <span className="text-sm">Create Task</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-colors text-left">
              <BarChart3 size={18} className="text-purple-400" />
              <span className="text-sm">View Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Create Workspace</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Product Team Alpha"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your Role
                </label>
                <select className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                  <option>Manager</option>
                  <option>Developer</option>
                  <option>Designer</option>
                  <option>QA Engineer</option>
                  <option>Product Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Workspace Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Join Workspace</h2>
              <button
                onClick={() => setShowJoinModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Invitation Code
                </label>
                <input
                  type="text"
                  placeholder="ALPHA-2025-XYZ"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <p className="text-sm text-purple-200">
                  <strong>Tip:</strong> Ask your team admin for an invitation code
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </Layout>
  );
};

export default Dashboard;