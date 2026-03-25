// ...existing code...
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LogIn";
import SignUpPage from "./pages/SignUp";
import Dashboard from "./pages/userProfile/Dashboard";

import KairoOnboarding from "./pages/Onboarding";
import ForgotPassword from "./pages/ForgotPassword";
import ProfileSettings from "./pages/userProfile/ProfileSettings";
import MyCalendar from "./pages/userProfile/MyCalendar";
import MyNotifications from "./pages/userProfile/MyNotifications";
import MyTasks from "./pages/userProfile/MyTasks";

import WorkspaceMainPage from "./pages/workspace/WorkspaceMainPage";
import TeamMemberPage from "./pages/workspace/TeamMembers";
import WorkspaceSettings from "./pages/workspace/WorkspaceSettings";
import TaskBoard from "./pages/workspace/TaskBoard";
import MemoryView from "./pages/workspace/MemoryView";
import Analytics from "./pages/workspace/Analytics";
import Transcripts from "./pages/workspace/Transcripts";

import MeetingsDashboard from "./pages/meetings/MeetingsMain";
import LiveMeetingView from "./pages/meetings/MeetingLive";
import MeetingDetailsPage from "./pages/meetings/MeetingDetails";
import PreMeetingPage from "./pages/meetings/PreMeeting";
import GlobalKairoAssistantFAB from "./components/GlobalKairoAssistantFAB";

// Redirect component for invalid workspace sub-routes
const WorkspaceRedirect = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <Navigate to={`/workspace/${workspaceId}`} replace />;
}; 

function App() {
  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/signup" element={<SignUpPage />} /> 
        <Route path="/onboarding" element={<KairoOnboarding />} />     

        {/* User Profile Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile-settings" element={<ProfileSettings />} />
        <Route path="/calendar" element={<MyCalendar />} />
        <Route path="/notifications" element={<MyNotifications />} />
        <Route path="/tasks" element={<MyTasks />} />

        {/* Workspace Routes - Support workspace ID in URL */}
        <Route path="/workspace/:workspaceId" element={<WorkspaceMainPage key="workspace" />} />
        <Route path="/workspace/:workspaceId/team-members" element={<TeamMemberPage key="team-members" />} />
        <Route path="/workspace/:workspaceId/settings" element={<WorkspaceSettings key="settings" />} />
        <Route path="/workspace/:workspaceId/tasks" element={<TaskBoard key="tasks" />} />
        <Route path="/workspace/:workspaceId/memory" element={<MemoryView key="memory" />} />
        <Route path="/workspace/:workspaceId/analytics" element={<Analytics key="analytics" />} />
        <Route path="/workspace/:workspaceId/transcripts" element={<Transcripts key="transcripts" />} />
        
        {/* Legacy workspace routes (without ID) */}
        <Route path="/workspace" element={<WorkspaceMainPage key="workspace-legacy" />} />
        <Route path="/workspace/team-members" element={<TeamMemberPage key="team-members-legacy" />} />
        <Route path="/workspace/settings" element={<WorkspaceSettings key="settings-legacy" />} />
        <Route path="/workspace/tasks" element={<TaskBoard key="tasks-legacy" />} />
        <Route path="/workspace/memory" element={<MemoryView key="memory-legacy" />} />
        <Route path="/workspace/analytics" element={<Analytics key="analytics-legacy" />} />
        <Route path="/workspace/transcripts" element={<Transcripts key="transcripts-legacy" />} />

        {/* Meetings Routes - Support workspace ID in URL */}
        <Route path="/workspace/:workspaceId/meetings" element={<MeetingsDashboard key="meetings" />} />
        <Route path="/workspace/:workspaceId/meetings/live/:id" element={<LiveMeetingView key="live" />} />
        <Route path="/workspace/:workspaceId/meetings/live" element={<LiveMeetingView key="live-empty" />} />
        <Route path="/workspace/:workspaceId/meetings/pre/:id" element={<PreMeetingPage key="pre-meeting" />} />
        <Route path="/workspace/:workspaceId/meetings/:id" element={<MeetingDetailsPage key="meeting-details" />} />
        
        {/* Legacy meetings routes (without workspace ID) */}
        <Route path="/workspace/meetings" element={<MeetingsDashboard key="meetings-legacy" />} />
        <Route path="/workspace/meetings/live/:id" element={<LiveMeetingView key="live-legacy" />} />
        <Route path="/workspace/meetings/live" element={<LiveMeetingView key="live-empty-legacy" />} />
        <Route path="/workspace/meetings/pre/:id" element={<PreMeetingPage key="pre-meeting-legacy" />} />
        <Route path="/workspace/meetings/:id" element={<MeetingDetailsPage key="meeting-details-legacy" />} />

        {/* Catch-all for invalid workspace sub-routes */}
        <Route path="/workspace/:workspaceId/*" element={<WorkspaceRedirect />} />
      </Routes>
      <GlobalKairoAssistantFAB />
    </>
  );
}

export default App;
// ...existing code...