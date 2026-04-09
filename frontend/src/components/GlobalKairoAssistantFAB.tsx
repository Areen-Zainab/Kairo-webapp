import React from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { KairoAssistantFAB } from './meetings/details';

/**
 * Global "Ask Kairo" floating popup for workspace routes only.
 * Excluded from the workspace memory graph page (it already has its own chatbot UI).
 */
const GlobalKairoAssistantFAB: React.FC = () => {
  const location = useLocation();
  const { currentWorkspace } = useUser();

  if (!location.pathname.startsWith('/workspace')) {
    return null;
  }

  const workspaceIdFromUrl = location.pathname.match(/\/workspace\/(\d+)/)?.[1];
  const workspaceIdFromUrlNum = workspaceIdFromUrl ? parseInt(workspaceIdFromUrl, 10) : undefined;

  const currentWorkspaceIdNum = currentWorkspace?.id
    ? parseInt(String(currentWorkspace.id), 10)
    : undefined;

  const activeWorkspaceId =
    workspaceIdFromUrlNum && !Number.isNaN(workspaceIdFromUrlNum)
      ? workspaceIdFromUrlNum
      : currentWorkspaceIdNum && !Number.isNaN(currentWorkspaceIdNum)
        ? currentWorkspaceIdNum
        : undefined;

  // Exclude the workspace "Memory Graph" page which has its own chatbot popup.
  const isMemoryGraphPage = /^\/workspace\/(\d+\/)?memory(\/|$)/.test(location.pathname);

  if (isMemoryGraphPage) return null;

  return (
    <KairoAssistantFAB
      workspaceId={activeWorkspaceId}
      onGeneratePersonalSummary={() => {
        // No-op for now: the core functionality is the "Ask" search box.
      }}
    />
  );
};

export default GlobalKairoAssistantFAB;

