import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import ProfileStep from '../components/onboarding/ProfileStep';
import VoiceStep from '../components/onboarding/VoiceStep';
import WorkspaceStep from '../components/onboarding/WorkspaceStep';
import FinishStep from '../components/onboarding/FinishStep';

interface OnboardingData {
  displayName: string;
  timezone: string;
  profilePicture: File | null;
  audioSample: File | null;
  workspaceAction: 'create' | 'join' | 'skip' | null;
  workspaceName: string;
  workspaceCode: string;
}

export default function KairoOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>({
    displayName: '',
    timezone: '',
    profilePicture: null,
    audioSample: null,
    workspaceAction: null,
    workspaceName: '',
    workspaceCode: ''
  });

  const totalSteps = 4;
  const steps = [
    { number: 1, title: 'Profile' },
    { number: 2, title: 'Voice' },
    { number: 3, title: 'Workspace' },
    { number: 4, title: 'Finish' }
  ];

  const updateFormData = (data: Partial<OnboardingData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.displayName.trim() !== '' && formData.timezone !== '';
      case 2:
        return formData.audioSample !== null;
      case 3:
        if (formData.workspaceAction === 'skip') return true;
        return (
          formData.workspaceAction === 'create' ? formData.workspaceName.trim() !== '' :
          formData.workspaceAction === 'join' ? formData.workspaceCode.trim() !== '' :
          false
        );
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFinish = () => {
    console.log('Onboarding completed with data:', formData);
    alert('Redirecting to dashboard...');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <ProfileStep data={formData} onChange={updateFormData} />;
      case 2:
        return <VoiceStep data={formData} onChange={updateFormData} />;
      case 3:
        return <WorkspaceStep data={formData} onChange={updateFormData} />;
      case 4:
        return <FinishStep onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/30 rounded-full blur-3xl top-1/4 left-1/4 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl bottom-1/4 right-1/4 animate-pulse" style={{ animationDelay: '1s' }} />
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/60 rounded-full"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); opacity: 0.4; }
          50% { transform: translateY(-20px); opacity: 0.8; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      {/* Logo */}
      <a href="/">
      <div className="fixed top-6 left-6 md:top-8 md:left-8 z-50 flex items-center space-x-2">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/50">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
        </div>
        <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Kairo
        </span>
      </div>
      </a>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl px-4">
        {/* Step Indicator */}
        {currentStep < 4 && (
          <div className="mb-6">
            <div className="flex items-center justify-between">
              {steps.slice(0, 3).map((step, idx) => (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all text-sm ${
                      step.number < currentStep
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50'
                        : step.number === currentStep
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-2xl shadow-purple-500/50 scale-110'
                        : 'bg-white/10 text-slate-400'
                    }`}>
                      {step.number < currentStep ? <Check className="w-5 h-5" /> : step.number}
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-slate-300">{step.title}</div>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-1 mx-3 mb-5 rounded-full transition-all ${
                      step.number < currentStep 
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600'
                        : 'bg-white/10'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8">
          {renderCurrentStep()}

          {/* Navigation */}
          {currentStep < 4 && (
            <div className="flex space-x-3 mt-6">
              {currentStep > 1 && (
                <button
                  onClick={prevStep}
                  className="flex-1 px-6 py-2.5 border border-white/20 text-white rounded-xl font-medium hover:bg-white/5 transition-all text-sm"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex-1 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:shadow-2xl hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none text-sm"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Progress Text */}
        {currentStep < 4 && (
          <div className="text-center mt-3 text-xs text-slate-400">
            Step {currentStep} of 3
          </div>
        )}
      </div>
    </div>
  );
}