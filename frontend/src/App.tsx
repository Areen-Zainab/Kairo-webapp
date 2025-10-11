// src/App.tsx
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LogIn";
import SignUpPage from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import WorkspaceMainPage from "./pages/workspace/WorkspaceLayout";
import KairoOnboarding from "./pages/Onboarding";
import ForgotPassword from "./pages/ForgotPassword";
import ProfileSettings from "./pages/ProfileSettings";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/onboarding" element={<KairoOnboarding />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/workspace" element={<WorkspaceMainPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/profile-settings" element={<ProfileSettings />} />
    </Routes>
  );
}

export default App;
