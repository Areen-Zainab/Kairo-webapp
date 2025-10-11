// src/App.tsx
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LogIn";
import SignUpPage from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import WorkspaceMainPage from "./pages/workspace/WorkspaceLayout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/workspace" element={<WorkspaceMainPage />} />
    </Routes>
  );
}

export default App;
