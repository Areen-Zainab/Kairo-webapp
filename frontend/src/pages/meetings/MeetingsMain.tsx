import { useState, useRef } from 'react';
import { 
  Calendar, 
  Video, 
  Search, 
  Filter, 
  ArrowUpRight,
  FileText,
  Brain,
  LayoutGrid,
  List,
  CalendarDays,
  Columns,
  Settings,
  Plus
} from 'lucide-react';
import Layout from '../../components/Layout';
import LiveMeetingBanner from '../../components/meetings/dashboard/LiveMeetingBanner';
import ListView from '../../components/meetings/dashboard/ListView';
import GridView from '../../components/meetings/dashboard/GridView';
import KanbanView from '../../components/meetings/dashboard/KanbanView';
import CalendarView from '../../components/meetings/dashboard/CalendarView';
import { useNavigate } from 'react-router-dom';

type TabType = 'all' | 'upcoming' | 'live' | 'history';
type ViewType = 'list' | 'grid' | 'calendar' | 'kanban';

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: 'live' | 'upcoming' | 'completed';
  participants: { name: string; avatar: string }[];
  summary?: string;
  topics?: string[];
  aiInsights?: number;
  tasks?: number;
  transcriptReady?: boolean;
  memoryLinks?: number;
}
const MeetingsDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('week');
  const [showTimeFilterMenu, setShowTimeFilterMenu] = useState(false);

  const plusMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const timeFilterMenuRef = useRef<HTMLDivElement>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const stats = [
    { label: 'Total Meetings', value: '24', change: '+12%', icon: Video, color: 'from-blue-500 to-cyan-500' },
    { label: 'This Week', value: '8', change: '+3', icon: Calendar, color: 'from-purple-500 to-pink-500' },
    { label: 'Transcripts Ready', value: '18', change: '100%', icon: FileText, color: 'from-green-500 to-emerald-500' },
    { label: 'AI Insights', value: '156', change: '+23', icon: Brain, color: 'from-orange-500 to-red-500' },
  ];

  const meetings: Meeting[] = [
    {
      id: '1',
      title: 'Sprint Planning – Team Kairo',
      date: 'Today',
      time: '10:00 AM - 11:00 AM',
      duration: '1h',
      status: 'live',
      participants: [
        { name: 'John', avatar: 'JD' },
        { name: 'Sarah', avatar: 'SK' },
        { name: 'Mike', avatar: 'MJ' },
      ],
      summary: 'Prioritizing Q4 backlog and discussing sprint goals',
      topics: ['Q4 Planning', 'Backlog', 'Sprint Goals'],
      aiInsights: 12,
      tasks: 8,
    },
    {
      id: '2',
      title: 'Product Roadmap Review',
      date: 'Tomorrow',
      time: '2:00 PM - 3:30 PM',
      duration: '1.5h',
      status: 'upcoming',
      participants: [
        { name: 'Emily', avatar: 'EC' },
        { name: 'David', avatar: 'DL' },
      ],
      summary: 'Reviewing Q1 2025 product roadmap with stakeholders',
      topics: ['Product Strategy', 'Roadmap', 'Q1 Goals'],
      tasks: 5,
    },
    {
      id: '3',
      title: 'Design System Workshop',
      date: 'Dec 10, 2024',
      time: '9:00 AM - 10:30 AM',
      duration: '1.5h',
      status: 'completed',
      participants: [
        { name: 'Alex', avatar: 'AT' },
        { name: 'Lisa', avatar: 'LM' },
        { name: 'Tom', avatar: 'TP' },
      ],
      summary: 'Established new component guidelines and updated design tokens',
      topics: ['Design System', 'Components', 'Guidelines'],
      aiInsights: 8,
      transcriptReady: true,
      memoryLinks: 3,
      tasks: 12,
    },
    {
      id: '4',
      title: 'Client Demo: New Features',
      date: 'Dec 15, 2024',
      time: '3:00 PM - 4:00 PM',
      duration: '1h',
      status: 'upcoming',
      participants: [
        { name: 'John', avatar: 'JD' },
        { name: 'Client', avatar: 'CL' },
      ],
      summary: 'Showcasing latest platform updates to client',
      topics: ['Demo', 'Features', 'Client Feedback'],
    },
  ];

  const liveMeeting = meetings.find(m => m.status === 'live');
  const [dismissLiveBanner, setDismissLiveBanner] = useState(false);

  const withinTimeFilter = (meeting: Meeting) => {
    if (timeFilter === 'all') return true;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const addDays = (d: number) => new Date(startOfDay.getTime() + d * 86400000);

    // Handle shorthand labels in sample data
    let meetingDate: Date | null = null;
    const raw = meeting.date;
    if (raw.toLowerCase().includes('today')) meetingDate = startOfDay;
    else if (raw.toLowerCase().includes('tomorrow')) meetingDate = addDays(1);
    else {
      const parsed = new Date(raw);
      meetingDate = isNaN(parsed.getTime()) ? null : parsed;
    }
    if (!meetingDate) return true; // if unknown, don't exclude

    if (timeFilter === 'today') {
      return meetingDate >= startOfDay && meetingDate < addDays(1);
    }
    if (timeFilter === 'week') {
      const end = addDays(7);
      return meetingDate >= startOfDay && meetingDate < end;
    }
    if (timeFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return meetingDate >= startOfMonth && meetingDate < startNextMonth;
    }
    if (timeFilter === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      const startNextQuarter = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
      return meetingDate >= startOfQuarter && meetingDate < startNextQuarter;
    }
    return true;
  };

  const filteredMeetings = meetings.filter(meeting => {
    if (activeTab === 'all') return true;
    if (activeTab === 'live') return meeting.status === 'live';
    if (activeTab === 'upcoming') return meeting.status === 'upcoming';
    if (activeTab === 'history') return meeting.status === 'completed';
    return true;
  }).filter(meeting => 
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(withinTimeFilter);

  const tabs = [
    { id: 'all', label: 'All Meetings', count: meetings.length },
    { id: 'upcoming', label: 'Upcoming', count: meetings.filter(m => m.status === 'upcoming').length },
    { id: 'live', label: 'Live', count: meetings.filter(m => m.status === 'live').length },
    { id: 'history', label: 'History', count: meetings.filter(m => m.status === 'completed').length },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <LiveMeetingBanner
          liveMeeting={dismissLiveBanner ? undefined : liveMeeting}
          onJoin={() => navigate('/workspace/meetings/live')}
          onDismiss={() => setDismissLiveBanner(true)}
        />

        <div className="mb-8 flex items-start justify-between gap-3 relative z-20">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
              Meetings
            </h1>
            <p className="text-slate-400">Manage your meetings and AI-powered insights</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-1 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-0.5">
              <button
                onClick={() => setViewType('list')}
                className={`p-2 rounded transition-all ${
                  viewType === 'list'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType('grid')}
                className={`p-2 rounded transition-all ${
                  viewType === 'grid'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType('kanban')}
                className={`p-2 rounded transition-all ${
                  viewType === 'kanban'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Kanban View"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType('calendar')}
                className={`p-2 rounded transition-all ${
                  viewType === 'calendar'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Calendar View"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 relative" ref={timeFilterMenuRef}>
              <button
                type="button"
                onClick={() => setShowTimeFilterMenu(v => !v)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-white rounded-lg text-sm hover:bg-slate-800/70 transition-all"
                aria-haspopup="menu"
                aria-expanded={showTimeFilterMenu}
              >
                <Filter className="w-4 h-4 text-slate-300" />
                <span className="capitalize">{timeFilter === 'week' ? 'This Week' : timeFilter === 'today' ? 'Today' : timeFilter === 'month' ? 'This Month' : 'This Quarter'}</span>
              </button>
              {showTimeFilterMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-lg shadow-xl z-50" role="menu">
                  <div className="p-1">
                    <button onClick={() => { setTimeFilter('all'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 text-slate-200 ${timeFilter==='all' ? 'bg-white/5' : ''}`} role="menuitem">All</button>
                    <button onClick={() => { setTimeFilter('today'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 text-slate-200 ${timeFilter==='today' ? 'bg-white/5' : ''}`} role="menuitem">Today</button>
                    <button onClick={() => { setTimeFilter('week'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 text-slate-200 ${timeFilter==='week' ? 'bg-white/5' : ''}`} role="menuitem">This Week</button>
                    <button onClick={() => { setTimeFilter('month'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 text-slate-200 ${timeFilter==='month' ? 'bg-white/5' : ''}`} role="menuitem">This Month</button>
                    <button onClick={() => { setTimeFilter('quarter'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 text-slate-200 ${timeFilter==='quarter' ? 'bg-white/5' : ''}`} role="menuitem">This Quarter</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Plus Dropdown */}
              <div className="relative overflow-visible" ref={plusMenuRef}>
                <button onClick={() => setShowPlusMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-md text-white text-sm font-medium transition-all" aria-haspopup="menu" aria-expanded={showPlusMenu}>
                  <Plus className="w-4 h-4" />
                  New
                </button>
                {showPlusMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-lg shadow-xl z-50" role="menu">
                    <div className="p-2">
                      <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-white/5 text-slate-200" role="menuitem">Schedule new meeting</button>
                      <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-white/5 text-slate-200" role="menuitem">Import from Calendar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Settings Dropdown */}
              <div className="relative overflow-visible" ref={settingsMenuRef}>
                <button onClick={() => setShowSettingsMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/50 rounded-md text-slate-200 text-sm transition-all" aria-haspopup="menu" aria-expanded={showSettingsMenu}>
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                {showSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-lg shadow-xl z-50" role="menu">
                    <div className="p-2">
                      <p className="px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Sync Frequency</p>
                      <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-white/5 text-slate-300" role="menuitem">Manual</button>
                      <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-white/5 text-slate-300" role="menuitem">Every 15 minutes</button>
                      <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-white/5 text-slate-300" role="menuitem">Hourly</button>
                      <div className="h-px bg-slate-700/60 my-2" />
                      <p className="px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Integrations</p>
                      <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-white/5 text-slate-300" role="menuitem">Google Calendar</button>
                      <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-white/5 text-slate-300" role="menuitem">Outlook</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-5 hover:border-slate-600 transition-all duration-200 group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 bg-gradient-to-br ${stat.color} rounded-lg group-hover:scale-105 transition-transform duration-200`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-green-400 text-xs font-medium flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-0.5">{stat.value}</h3>
                <p className="text-slate-400 text-sm">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-1 mb-6">
          <div className="flex space-x-1 relative">
            <div
              className="absolute top-1 bottom-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-md transition-all duration-300 ease-out"
              style={{
                width: `${100 / tabs.length}%`,
                left: `${(tabs.findIndex(t => t.id === activeTab) * 100) / tabs.length}%`,
              }}
            />
            
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className="relative flex-1 flex items-center justify-center space-x-2 px-5 py-2.5 rounded-md transition-all duration-200 z-10"
              >
                <span className={`font-medium text-sm transition-all ${
                  activeTab === tab.id ? 'text-white' : 'text-slate-400'
                }`}>
                  {tab.label}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white/15 text-white' 
                    : 'bg-slate-700/30 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {viewType !== 'calendar' && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>
          </div>
        )}

        {viewType === 'list' && (<ListView meetings={filteredMeetings} />)}

        {viewType === 'grid' && (<GridView meetings={filteredMeetings} />)}

        {viewType === 'kanban' && (<KanbanView meetings={filteredMeetings} />)}

        {viewType === 'calendar' && (<CalendarView meetings={filteredMeetings} />)}

        {filteredMeetings.length === 0 && viewType !== 'calendar' && (
          <div className="text-center py-20">
            <Video className="w-14 h-14 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">No meetings found</h3>
            <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MeetingsDashboard;