import { useState } from 'react';
import { UserPlus, Search, MoreVertical, Crown, Trash2, Shield, Eye, Edit3, TrendingUp, Users, BarChart3, Clock, MessageSquare } from 'lucide-react';
import Layout from '../../components/Layout';
import AddMemberModal from '../../modals/AddMember';


// Main Component
const MOCK_MEMBERS = [
  { id: 1, name: 'Sana Khan', email: 'sana.k@company.com', role: 'Owner', status: 'active', avatar: 'SK', contributions: 145, meetings: 23, messages: 892 },
  { id: 2, name: 'Muhammad Ali', email: 'muhammad.a@company.com', role: 'Admin', status: 'active', avatar: 'MA', contributions: 98, meetings: 18, messages: 654 },
  { id: 3, name: 'Fatima Sheikh', email: 'fatima.s@company.com', role: 'Member', status: 'active', avatar: 'FS', contributions: 127, meetings: 21, messages: 743 },
  { id: 4, name: 'Daniyal Ahmed', email: 'daniyal.a@company.com', role: 'Member', status: 'active', avatar: 'DA', contributions: 76, meetings: 15, messages: 521 },
  { id: 5, name: 'Javeria Butt', email: 'javeria.b@company.com', role: 'Observer', status: 'invited', avatar: 'JB', contributions: 0, meetings: 0, messages: 0 },
  { id: 6, name: 'Ali Hassan', email: 'ali.h@company.com', role: 'Member', status: 'active', avatar: 'AH', contributions: 89, meetings: 17, messages: 612 },
];

export default function WorkspaceMembersPage() {
  const [members, setMembers] = useState(MOCK_MEMBERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMenu, setShowMenu] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('members');

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateRole = (memberId: number, newRole: string) => {
    setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    setShowMenu(null);
  };

  const removeMember = (memberId: number) => {
    setMembers(members.filter(m => m.id !== memberId));
    setShowMenu(null);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Owner': return <Crown size={14} className="text-yellow-400" />;
      case 'Admin': return <Shield size={14} className="text-purple-400" />;
      case 'Member': return <Edit3 size={14} className="text-blue-400" />;
      case 'Observer': return <Eye size={14} className="text-gray-400" />;
      default: return null;
    }
  };

  const topContributors = [...members]
    .filter(m => m.status === 'active')
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 3);

  const topMeetingSpeakers = [...members]
    .filter(m => m.status === 'active')
    .sort((a, b) => b.meetings - a.meetings)
    .slice(0, 3);

  const topMessagers = [...members]
    .filter(m => m.status === 'active')
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 3);

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === 'active').length;
  const totalContributions = members.reduce((sum, m) => sum + m.contributions, 0);
  const totalMeetings = members.reduce((sum, m) => sum + m.meetings, 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Team Members</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your workspace team and permissions</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all duration-300 flex items-center gap-2 font-medium shadow-lg hover:shadow-purple-500/30 w-full lg:w-auto justify-center"
          >
            <UserPlus size={20} />
            Invite Members
          </button>
        </div>

        {/* Tabs */}
        <div className="rounded-lg border p-1 flex gap-1 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'members'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
            }`}
          >
            <Users size={18} />
            Members
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'insights'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
            }`}
          >
            <BarChart3 size={18} />
            Insights
          </button>
        </div>

        {activeTab === 'members' ? (
          <>
            {/* Search */}
            <div className="rounded-lg border p-4 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members by name or email..."
                  className="w-full pl-10 pr-4 py-3 rounded-md transition-all bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Members Table */}
            <div className="rounded-lg border overflow-hidden bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Member</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700/30">
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                              {member.avatar}
                            </div>
                            <span className="text-gray-900 dark:text-white font-medium">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-600 dark:text-gray-400">{member.email}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(member.role)}
                            <span className="text-gray-700 dark:text-gray-300">{member.role}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            member.status === 'active' 
                              ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30' 
                              : 'bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30'
                          }`}>
                            {member.status === 'active' ? 'Active' : 'Invited'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setShowMenu(showMenu === member.id ? null : member.id)}
                              className="p-2 rounded transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/50"
                            >
                              <MoreVertical size={18} />
                            </button>
                            {showMenu === member.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-xl z-10 dark:bg-gray-800 dark:border-gray-700/50">
                                <div className="py-1">
                                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Change Role</div>
                                  {['Admin', 'Member', 'Observer'].map((role) => (
                                    <button
                                      key={role}
                                      onClick={() => updateRole(member.id, role)}
                                      className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
                                    >
                                      {getRoleIcon(role)}
                                      {role}
                                    </button>
                                  ))}
                                  <div className="border-t border-gray-200 my-1 dark:border-gray-700/50"></div>
                                  {member.role === 'Owner' ? (
                                    <button className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-gray-700/50">
                                      <Crown size={14} />
                                      Transfer Ownership
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => removeMember(member.id)}
                                      className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-700/50"
                                    >
                                      <Trash2 size={14} />
                                      Remove Member
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Total Members</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{totalMembers}</p>
                  </div>
                  <Users className="text-purple-400" size={32} />
                </div>
              </div>
              <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Active Members</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{activeMembers}</p>
                  </div>
                  <TrendingUp className="text-green-400" size={32} />
                </div>
              </div>
              <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Total Contributions</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{totalContributions}</p>
                  </div>
                  <BarChart3 className="text-blue-400" size={32} />
                </div>
              </div>
              <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Total Meetings</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{totalMeetings}</p>
                  </div>
                  <Clock className="text-yellow-400" size={32} />
                </div>
              </div>
            </div>

            {/* Top Contributors */}
            <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} className="text-purple-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Contributors</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topContributors.map((member, index) => (
                  <div key={member.id} className="rounded-md p-4 border bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                        {member.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white font-medium text-sm">{member.name}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">{member.role}</p>
                      </div>
                      <div className="text-2xl">{['🥇', '🥈', '🥉'][index]}</div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Total Contributions</p>
                      <p className="text-purple-400 font-bold text-lg">{member.contributions}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Meeting Speakers */}
            <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={20} className="text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Most Active in Meetings</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topMeetingSpeakers.map((member, index) => (
                  <div key={member.id} className="rounded-md p-4 border bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm">
                        {member.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white font-medium text-sm">{member.name}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">{member.role}</p>
                      </div>
                      <div className="text-2xl">{['🎤', '🎙️', '🔊'][index]}</div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Meetings Participated</p>
                      <p className="text-blue-400 font-bold text-lg">{member.meetings}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Messagers */}
            <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={20} className="text-green-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Most Active Messengers</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topMessagers.map((member, index) => (
                  <div key={member.id} className="rounded-md p-4 border bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                        {member.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white font-medium text-sm">{member.name}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">{member.role}</p>
                      </div>
                      <div className="text-2xl">{['💬', '✉️', '📨'][index]}</div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Messages Sent</p>
                      <p className="text-green-400 font-bold text-lg">{member.messages}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Members Modal */}
      <AddMemberModal 
        isOpen={showInviteModal} 
        onClose={() => setShowInviteModal(false)} 
      />
    </Layout>
  );
}