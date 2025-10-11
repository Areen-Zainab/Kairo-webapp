import React from 'react';

interface OnboardingData {
  displayName: string;
  timezone: string;
  profilePicture: File | null;
  audioSample: File | null;
  workspaceAction: 'create' | 'join' | 'skip' | null;
  workspaceName: string;
  workspaceCode: string;
}

interface WorkspaceStepProps {
  data: OnboardingData;
  onChange: (data: Partial<OnboardingData>) => void;
}

const WorkspaceStep: React.FC<WorkspaceStepProps> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-3">
        <h2 className="text-2xl font-bold text-white mb-1">Join a Workspace</h2>
        <p className="text-sm text-slate-300">Create a new workspace or join an existing one</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => onChange({ workspaceAction: 'create', workspaceCode: '' })}
          className={`p-4 rounded-2xl border-2 transition-all ${
            data.workspaceAction === 'create'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <div className="text-3xl mb-2">🏢</div>
          <h3 className="text-base font-semibold text-white mb-1">Create Workspace</h3>
          <p className="text-xs text-slate-400">Start fresh with a new team workspace</p>
        </button>

        <button
          onClick={() => onChange({ workspaceAction: 'join', workspaceName: '' })}
          className={`p-4 rounded-2xl border-2 transition-all ${
            data.workspaceAction === 'join'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <div className="text-3xl mb-2">👥</div>
          <h3 className="text-base font-semibold text-white mb-1">Join Workspace</h3>
          <p className="text-xs text-slate-400">Enter a code to join your team</p>
        </button>

        <button
          onClick={() => onChange({ workspaceAction: 'skip', workspaceName: '', workspaceCode: '' })}
          className={`p-4 rounded-2xl border-2 transition-all ${
            data.workspaceAction === 'skip'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <div className="text-3xl mb-2">⏭️</div>
          <h3 className="text-base font-semibold text-white mb-1">Skip for Now</h3>
          <p className="text-xs text-slate-400">Set up workspace later</p>
        </button>
      </div>

      {data.workspaceAction === 'create' && (
        <div className="space-y-1.5 mt-4">
          <label className="block text-sm font-medium text-slate-300">Workspace Name *</label>
          <input
            type="text"
            value={data.workspaceName}
            onChange={(e) => onChange({ workspaceName: e.target.value })}
            placeholder="My Team Workspace"
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      )}

      {data.workspaceAction === 'join' && (
        <div className="space-y-1.5 mt-4">
          <label className="block text-sm font-medium text-slate-300">Workspace Code *</label>
          <input
            type="text"
            value={data.workspaceCode}
            onChange={(e) => onChange({ workspaceCode: e.target.value })}
            placeholder="Enter invite code"
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      )}
    </div>
  );
};

export default WorkspaceStep;