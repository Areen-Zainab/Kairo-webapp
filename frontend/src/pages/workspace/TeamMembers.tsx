import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus, Search, MoreVertical, Crown, Trash2, Shield, Eye, Edit3, TrendingUp, Users, BarChart3, Clock, MessageSquare, Loader2 } from 'lucide-react';
import Layout from '../../components/Layout';
import AddMemberModal from '../../modals/workspace/AddMember';
import { useUser } from '../../context/UserContext';
import { useToastContext } from '../../context/ToastContext';
import apiService from '../../services/api';
import UserAvatar from '../../components/ui/UserAvatar';

// Mock data for demo account only
const MOCK_MEMBERS = [
  { id: 1, userId: 1, name: 'Sana Khan', email: 'sana.k@company.com', role: 'Owner', status: 'active' as const, avatar: 'SK', contributions: 145, meetings: 23, messages: 892 },
  { id: 2, userId: 2, name: 'Muhammad Ali', email: 'muhammad.a@company.com', role: 'Admin', status: 'active' as const, avatar: 'MA', contributions: 98, meetings: 18, messages: 654 },
  { id: 3, userId: 3, name: 'Fatima Sheikh', email: 'fatima.s@company.com', role: 'Member', status: 'active' as const, avatar: 'FS', contributions: 127, meetings: 21, messages: 743 },
  { id: 4, userId: 4, name: 'Daniyal Ahmed', email: 'daniyal.a@company.com', role: 'Member', status: 'active' as const, avatar: 'DA', contributions: 76, meetings: 15, messages: 521 },
  { id: 5, userId: 5, name: 'Javeria Butt', email: 'javeria.b@company.com', role: 'Observer', status: 'invited' as const, avatar: 'JB', contributions: 0, meetings: 0, messages: 0 },
  { id: 6, userId: 6, name: 'Ali Hassan', email: 'ali.h@company.com', role: 'Member', status: 'active' as const, avatar: 'AH', contributions: 89, meetings: 17, messages: 612 },
];

interface WorkspaceMember {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited';
  avatar: string;
  profilePictureUrl?: string;
  contributions: number;
  meetings: number;
  messages: number;
  userId: number;
}

interface PendingInvite {
  id: number;
  invitedEmail: string;
  role: string;
  sentAt: string;
  inviter: {
    name: string;
    email: string;
  };
  invitedUser?: {
    id: number;
    name: string;
    email: string;
    profilePictureUrl?: string;
  };
}

export default function WorkspaceMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useUser();
  const { success: toastSuccess, error: toastError } = useToastContext();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMenu, setShowMenu] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [activeTab, setActiveTab] = useState('members');
  const [currentUserRole, setCurrentUserRole] = useState<string>('member'); // Track current user's role

  // Check if demo account
  const shouldShowDummyData = user?.email?.toLowerCase() === 'areeba@kairo.com';

  // Check if current user can manage members (owner or admin only)
  const canManageMembers = currentUserRole.toLowerCase() === 'owner' || currentUserRole.toLowerCase() === 'admin';

  // Fetch workspace members and invites
  useEffect(() => {
    const fetchData = async () => {
      if (shouldShowDummyData) {
        setMembers(MOCK_MEMBERS);
        setPendingInvites([]);
        setCurrentUserRole('Owner'); // Demo account is always owner
        setLoading(false);
        return;
      }

      // Don't make API calls if user is not loaded yet or it's a demo account
      if (!user) {
        setLoading(false);
        return;
      }

      if (!workspaceId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch workspace details including members
        const workspaceResponse = await apiService.getWorkspaceById(parseInt(workspaceId));
        
        if (workspaceResponse.error) {
          console.error('Error fetching workspace:', workspaceResponse.error);
          toastError(workspaceResponse.error, 'Failed to Load Workspace');
          return;
        }
        
        if (workspaceResponse.data?.workspace) {
          const workspace = workspaceResponse.data.workspace as any;
          console.log('Workspace data:', workspace);
          console.log('Members:', workspace.members);
          
          // Transform members to match our interface
          const transformedMembers: WorkspaceMember[] = (workspace.members || []).map((member: any) => ({
            id: member.id,
            userId: member.userId || member.user?.id,
            name: member.user?.name || 'Unknown',
            email: member.user?.email || '',
            role: member.role || 'Member',
            status: 'active' as const,
            avatar: member.user?.name ? member.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U',
            profilePictureUrl: member.user?.profilePictureUrl,
            contributions: 0, // TODO: Fetch from analytics
            meetings: 0, // TODO: Fetch from analytics
            messages: 0, // TODO: Fetch from analytics
          }));

          console.log('Transformed members:', transformedMembers);
          setMembers(transformedMembers);

          // Find current user's role in this workspace
          const currentMember = transformedMembers.find(m => m.userId === user?.id);
          let userRole = 'member';
          if (currentMember) {
            userRole = currentMember.role;
            setCurrentUserRole(currentMember.role);
          } else if (workspace.ownerId === user?.id) {
            userRole = 'Owner';
            setCurrentUserRole('Owner');
          }

          // Fetch pending invitations only if user is owner or admin
          // Check role directly here instead of relying on canManageMembers state
          const canManage = userRole.toLowerCase() === 'owner' || userRole.toLowerCase() === 'admin';
          if (canManage) {
            try {
              const invitesResponse = await apiService.getWorkspaceInvites(parseInt(workspaceId), 'pending');
              if (invitesResponse.error) {
                console.error('Error fetching invites:', invitesResponse.error);
              } else if (invitesResponse.data?.invites) {
                setPendingInvites(invitesResponse.data.invites);
              }
            } catch (error) {
              // Silently ignore 403 errors for non-admin users
              console.warn('Could not fetch invites:', error);
            }
          }
        }

      } catch (error) {
        console.error('Failed to fetch workspace data:', error);
        toastError('Failed to load team members. Please try again.', 'Load Failed');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceId, shouldShowDummyData, user]);

  // Refresh data after inviting members
  const handleInviteClose = async () => {
    setShowInviteModal(false);
    
    // Refresh invites list only if user can manage members
    if (workspaceId && !shouldShowDummyData && user && canManageMembers) {
      try {
        const invitesResponse = await apiService.getWorkspaceInvites(parseInt(workspaceId), 'pending');
        if (invitesResponse.data?.invites) {
          const oldCount = pendingInvites.length;
          const newCount = invitesResponse.data.invites.length;
          
          setPendingInvites(invitesResponse.data.invites);
          
          // Show success toast if new invites were added
          if (newCount > oldCount) {
            const addedCount = newCount - oldCount;
            toastSuccess(
              addedCount === 1 
                ? 'Invitation sent successfully!' 
                : `${addedCount} invitations sent successfully!`,
              '✓ Invites Sent'
            );
          }
        }
      } catch (error) {
        console.error('Failed to refresh invites:', error);
      }
    }
  };

  // Combine members and pending invites for filtering
  // Sort so active members appear first, then invited members
  const allMembers = [
    ...members.map(m => ({ ...m, status: 'active' as const })),
    ...pendingInvites.map(invite => ({
      id: invite.id + 10000, // Offset to avoid ID conflicts
      userId: invite.invitedUser?.id || 0,
      name: invite.invitedUser?.name || invite.invitedEmail,
      email: invite.invitedEmail,
      role: invite.role,
      status: 'invited' as const,
      avatar: invite.invitedUser?.name 
        ? invite.invitedUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() 
        : invite.invitedEmail.charAt(0).toUpperCase(),
      profilePictureUrl: invite.invitedUser?.profilePictureUrl,
      contributions: 0,
      meetings: 0,
      messages: 0,
    }))
  ].sort((a, b) => {
    // Active members first, then invited members
    if (a.status === 'active' && b.status === 'invited') return -1;
    if (a.status === 'invited' && b.status === 'active') return 1;
    // Within same status, sort by name
    return a.name.localeCompare(b.name);
  });

  const filteredMembers = allMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateRole = async (memberId: number, newRole: string) => {
    if (!canManageMembers) {
      toastError('You do not have permission to change member roles.', 'Permission Denied');
      setShowMenu(null);
      return;
    }

    if (shouldShowDummyData) {
      // For demo account, just update local state
    setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setShowMenu(null);
      toastSuccess(`Role updated to ${newRole}`, '✓ Role Updated');
      return;
    }

    setShowMenu(null);
    
    try {
      // TODO: Implement backend API call for role update
      // const response = await apiService.updateWorkspaceMemberRole(workspaceId, memberId, newRole);
      
      // For now, update local state
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      toastSuccess(`Role updated to ${newRole}`, '✓ Role Updated');
    } catch (error) {
      console.error('Failed to update role:', error);
      toastError('Failed to update member role. Please try again.', 'Update Failed');
    }
  };

  const removeMember = async (memberId: number) => {
    if (!canManageMembers) {
      toastError('You do not have permission to remove members.', 'Permission Denied');
      setShowMenu(null);
      return;
    }

    const member = members.find(m => m.id === memberId);
    
    if (!member) return;
    
    if (shouldShowDummyData) {
      // For demo account, just update local state
      setMembers(members.filter(m => m.id !== memberId));
      setShowMenu(null);
      toastSuccess(`${member.name} removed from workspace`, '✓ Member Removed');
      return;
    }

    // Confirm removal
    if (!confirm(`Are you sure you want to remove ${member.name} from this workspace?`)) {
      return;
    }
    
    setShowMenu(null);
    
    try {
      // TODO: Implement backend API call for member removal
      // const response = await apiService.removeWorkspaceMember(workspaceId, memberId);
      
      // For now, update local state
    setMembers(members.filter(m => m.id !== memberId));
      toastSuccess(`${member.name} removed from workspace`, '✓ Member Removed');
    } catch (error) {
      console.error('Failed to remove member:', error);
      toastError('Failed to remove member. Please try again.', 'Removal Failed');
    }
  };

  const cancelInvite = async (inviteId: number) => {
    if (!canManageMembers) {
      toastError('You do not have permission to cancel invitations.', 'Permission Denied');
      setShowMenu(null);
      return;
    }

    const invite = pendingInvites.find(inv => inv.id === inviteId);
    
    if (!invite) return;
    
    if (shouldShowDummyData) return;

    // Confirm cancellation
    if (!confirm(`Cancel invitation to ${invite.invitedEmail}?`)) {
      return;
    }
    
    setShowMenu(null);
    
    try {
      // TODO: Implement backend API call for canceling invite
      // const response = await apiService.cancelWorkspaceInvite(workspaceId, inviteId);
      
      // For now, update local state
      setPendingInvites(pendingInvites.filter(inv => inv.id !== inviteId));
      toastSuccess(`Invitation to ${invite.invitedEmail} cancelled`, 'Invitation Cancelled');
    } catch (error) {
      console.error('Failed to cancel invite:', error);
      toastError('Failed to cancel invitation. Please try again.', 'Cancellation Failed');
    }
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

  const activeOnlyMembers = members.filter(m => m.status === 'active');
  
  const topContributors = [...activeOnlyMembers]
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 3);

  const topMeetingSpeakers = [...activeOnlyMembers]
    .sort((a, b) => b.meetings - a.meetings)
    .slice(0, 3);

  const topMessagers = [...activeOnlyMembers]
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 3);

  const totalMembers = allMembers.length;
  const activeMembers = members.length;
  const pendingInvitesCount = pendingInvites.length;
  const totalContributions = members.reduce((sum, m) => sum + m.contributions, 0);
  const totalMeetings = members.reduce((sum, m) => sum + m.meetings, 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Team Members</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Manage your workspace team and permissions</p>
          </div>
          {canManageMembers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all duration-300 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-purple-500/30 w-full sm:w-auto"
          >
            <UserPlus size={18} className="sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">Invite Members</span>
          </button>
          )}
        </div>
  
        {/* Tabs */}
        <div className="rounded-lg border p-1 flex gap-1 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'members'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
            }`}
          >
            <Users size={18} />
            <span className="text-sm sm:text-base">Members</span>
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeTab === 'insights'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
            }`}
          >
            <BarChart3 size={18} />
            <span className="text-sm sm:text-base">Insights</span>
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
  
            {/* Loading State */}
            {loading ? (
              <div className="rounded-lg border p-12 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading team members...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="rounded-lg border p-12 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50 flex flex-col items-center justify-center">
                <Users className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No members found</h3>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                  {searchQuery 
                    ? 'Try adjusting your search query' 
                    : 'Start building your team by inviting members to your workspace'
                  }
                </p>
              </div>
            ) : (
              <>
            {/* Members Table */}
            <div className="rounded-lg border overflow-visible bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full overflow-visible">
                  <thead className="bg-gray-50 border-b border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Member</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
                      {canManageMembers && (
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700/30">
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 overflow-visible">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {member.profilePictureUrl ? (
                              <img 
                                src={member.profilePictureUrl} 
                                alt={member.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 dark:border-purple-700"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                                {member.avatar}
                              </div>
                            )}
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
                        {canManageMembers && (
                        <td className="px-6 py-4 whitespace-nowrap text-right overflow-visible">
                          <div className="relative inline-block overflow-visible">
                            <button
                              onClick={(e) => {
                                const buttonRect = e.currentTarget.getBoundingClientRect();
                                setMenuPosition({
                                  top: buttonRect.bottom + 8,
                                  right: window.innerWidth - buttonRect.right
                                });
                                setShowMenu(showMenu === member.id ? null : member.id);
                              }}
                              className="p-2 rounded transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/50"
                            >
                              <MoreVertical size={18} />
                            </button>
                          </div>
                        </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Dropdown Menu - Rendered outside table */}
            {showMenu !== null && menuPosition && (
              <>
                {/* Backdrop to close menu when clicking outside */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => {
                    setShowMenu(null);
                    setMenuPosition(null);
                  }}
                />
                {/* Dropdown menu */}
                <div 
                  className="fixed w-48 bg-white border border-gray-200 rounded-md shadow-xl z-50 dark:bg-gray-800 dark:border-gray-700/50"
                  style={{
                    top: `${menuPosition.top}px`,
                    right: `${menuPosition.right}px`
                  }}
                >
                  {(() => {
                    const member = filteredMembers.find(m => m.id === showMenu);
                    if (!member) return null;
                    
                    return (
                      <div className="py-1">
                        {member.status === 'active' ? (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Change Role</div>
                            {['Admin', 'Member', 'Observer'].map((role) => (
                              <button
                                key={role}
                                onClick={() => {
                                  updateRole(member.id, role);
                                  setShowMenu(null);
                                  setMenuPosition(null);
                                }}
                                disabled={member.role === role}
                                className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                                  member.role === role 
                                    ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 cursor-default' 
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                                }`}
                              >
                                {getRoleIcon(role)}
                                {role}
                                {member.role === role && <span className="ml-auto text-xs">Current</span>}
                              </button>
                            ))}
                            <div className="border-t border-gray-200 my-1 dark:border-gray-700/50"></div>
                            {member.role === 'Owner' ? (
                              <button 
                                onClick={() => {
                                  setShowMenu(null);
                                  setMenuPosition(null);
                                  toastError('Transfer ownership feature coming soon!', 'Not Available');
                                }}
                                className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-gray-700/50"
                              >
                                <Crown size={14} />
                                Transfer Ownership
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  removeMember(member.id);
                                  setShowMenu(null);
                                  setMenuPosition(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-700/50"
                              >
                                <Trash2 size={14} />
                                Remove Member
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Pending Invite</div>
                            <button
                              onClick={() => {
                                setShowMenu(null);
                                setMenuPosition(null);
                                toastError('Resend invitation feature coming soon!', 'Not Available');
                              }}
                              className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-gray-700/50"
                            >
                              <UserPlus size={14} />
                              Resend Invitation
                            </button>
                            <button
                              onClick={() => {
                                cancelInvite(member.id - 10000);
                                setShowMenu(null);
                                setMenuPosition(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-700/50"
                            >
                              <Trash2 size={14} />
                              Cancel Invitation
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </>
        )}
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
                    {pendingInvitesCount > 0 && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        +{pendingInvitesCount} pending
                      </p>
                    )}
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
                      <UserAvatar name={member.name} profilePictureUrl={member.profilePictureUrl} size="md" />
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
                      <UserAvatar name={member.name} profilePictureUrl={member.profilePictureUrl} size="md" />
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
                      <UserAvatar name={member.name} profilePictureUrl={member.profilePictureUrl} size="md" />
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
  
        {/* Invite Members Modal */}
        <AddMemberModal 
          isOpen={showInviteModal} 
          onClose={handleInviteClose} 
        />
      </div>
    </Layout>
  );
}