// Shared types for onboarding flow

export interface OnboardingData {
  // Profile Step
  displayName: string;
  timezone: string;
  profilePicture: File | null;
  
  // Voice Step
  audioSample: File | null;
  
  // Workspace Step
  workspaceAction: 'create' | 'join' | null;
  workspaceName: string;
  workspaceCode: string;
}

export interface StepComponentProps {
  data: OnboardingData;
  onChange: (data: Partial<OnboardingData>) => void;
}