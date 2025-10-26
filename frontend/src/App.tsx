// ...existing code...
import { Routes, Route } from "react-router-dom";
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

import MeetingsDashboard from "./pages/meetings/MeetingsMain";
import LiveMeetingView from "./pages/meetings/MeetingLive";
import MeetingDetailsPage from "./pages/meetings/MeetingDetails"; 

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

        {/* Workspace Routes */}
        <Route path="/workspace" element={<WorkspaceMainPage />} />
        <Route path="/workspace/team-members" element={<TeamMemberPage />} />
        <Route path="/workspace/settings" element={<WorkspaceSettings />} />
        <Route path="/workspace/tasks" element={<TaskBoard />} />
        <Route path="/workspace/memory" element={<MemoryView />} />
        <Route path="/workspace/analytics" element={<Analytics />} />

        {/* Meetings Routes */}
        <Route path="/workspace/meetings" element={<MeetingsDashboard />} />
        <Route path="/workspace/meetings/live" element={<LiveMeetingView />} />
        <Route path="/workspace/meetings/:id" element={<MeetingDetailsPage />} />
      </Routes>
    </>
  );
}

export default App;
// ...existing code...