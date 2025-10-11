import React from 'react';
import { Check } from 'lucide-react';

interface FinishStepProps {
  onFinish: () => void;
}

const FinishStep: React.FC<FinishStepProps> = ({ onFinish }) => {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/50">
          <Check className="w-10 h-10 text-white" />
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-white mb-2">You're all set! 🎉</h2>
        <p className="text-base text-slate-300">
          Welcome to Kairo. Let's start transforming your meetings.
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 max-w-md mx-auto">
        <div className="space-y-2.5 text-left">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm text-slate-300">Profile configured</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm text-slate-300">Voice recognition enabled</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm text-slate-300">Workspace ready</span>
          </div>
        </div>
      </div>

      <button
        onClick={onFinish}
        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold text-white hover:shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105"
      >
        Go to Dashboard →
      </button>
    </div>
  );
};

export default FinishStep;