import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import apiService from '../services/api';
import ProfileStep from '../components/onboarding/ProfileStep';
import VoiceStep from '../components/onboarding/VoiceStep';
import WorkspaceStep from '../components/onboarding/WorkspaceStep';
import FinishStep from '../components/onboarding/FinishStep';
import CalendarStep from '../components/onboarding/CalendarStep';

interface OnboardingData {
  // Existing fields
  displayName: string;
  timezone: string;
  profilePicture: File | null;
  audioSample: File | null;
  biometricConsent: boolean;
  
  // NEW: Calendar fields
  calendarConnected: boolean;
  calendarProvider: 'google' | 'microsoft' | null;
  autoJoinEnabled: boolean;
  
  // Workspace fields
  workspaceAction: 'create' | 'join' | 'skip' | null;
  workspaceName: string;
  workspaceCode: string;
}

export default function KairoOnboarding() {
  const toast = useToastContext();
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<OnboardingData>({
    displayName: '',
    timezone: '',
    profilePicture: null,
    audioSample: null,
    biometricConsent: false,
    // NEW: Calendar defaults
    calendarConnected: false,
    calendarProvider: null,
    autoJoinEnabled: false,
    // Workspace
    workspaceAction: null,
    workspaceName: '',
    workspaceCode: ''
  });

  const totalSteps = 5; // Changed from 4 to 5
  const steps = [
    { number: 1, title: 'Profile' },
    { number: 2, title: 'Voice' },
    { number: 3, title: 'Calendar' }, // NEW
    { number: 4, title: 'Workspace' },
    { number: 5, title: 'Finish' }
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.displayName.trim() !== '' && formData.timezone !== '';
      case 2:
        return formData.audioSample !== null;
      case 3:
        // Calendar step can always proceed (skip is allowed)
        return true;
      case 4:
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

  const handleFinish = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // 1. Update user profile
      console.log('Updating profile...');
      const profileUpdate = await apiService.updateProfile({
        name: formData.displayName,
        timezone: formData.timezone,
      });

      if (profileUpdate.error) {
        throw new Error(profileUpdate.error);
      }

      // 2. Upload profile picture if provided
      if (formData.profilePicture) {
        console.log('Uploading profile picture...');
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(formData.profilePicture!);
        });
        
        const response = await apiService.uploadProfilePicture(base64Data);
        if (response.error) {
          console.error('Profile picture upload failed:', response.error);
          toast.error('Failed to upload profile picture');
        } else if (response.data?.imageUrl) {
          console.log('Profile picture uploaded successfully!', response.data.imageUrl);
          
          // Update user profile with the new image URL
          const updateResponse = await apiService.updateProfile({
            profilePictureUrl: response.data.imageUrl,
          });
          
          if (updateResponse.error) {
            console.error('Failed to update profile with image URL:', updateResponse.error);
          } else {
            console.log('Profile updated with image URL!');
          }
        }
      }

      // 3. Handle Voice Enrollment with Biometric Consent
      if (formData.audioSample && formData.biometricConsent) {
        console.log('Enrolling voice sample...');
        try {
          // First, grant consent
          const consentResponse = await apiService.grantSpeakerConsent();
          if (consentResponse.error) {
            console.error('Failed to grant speaker consent:', consentResponse.error);
            toast.error('Failed to register voice consent');
          } else {
            // Convert to base64 for the API
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(formData.audioSample!);
            });

            // Persist the same sample to the user's profile so it shows in the Profile tab
            // (prevents users from having to upload twice).
            try {
              const ext = formData.audioSample!.type?.split('/')[1] || 'webm';
              const uploadResp = await apiService.uploadAudioRecording(base64Data, ext);
              if (!uploadResp.error && uploadResp.data?.audioUrl) {
                await apiService.updateProfile({ audioSampleUrl: uploadResp.data.audioUrl });
              }
            } catch (uploadErr) {
              console.warn('Failed to save onboarding audio sample to profile:', uploadErr);
              // Non-blocking: voice enrollment can still proceed even if saving the sample fails.
            }

            const enrollResponse = await apiService.enrollSpeakerVoice(base64Data);
            if (enrollResponse.error) {
              console.error('Voice enrollment failed:', enrollResponse.error);
              // Use the specific message from the backend if available
              const errorMsg = enrollResponse.data?.message || enrollResponse.error || 'Voice enrollment failed.';
              toast.error(`${errorMsg} You can re-enroll later in Settings.`);
            } else if (enrollResponse.data?.snrDb && enrollResponse.data.snrDb < 15) {
              console.warn('Voice enrolled but SNR is low:', enrollResponse.data.snrDb);
              toast.warning('Voice enrolled, but background noise was detected. Consider re-enrolling later for better accuracy.');
            } else {
              console.log('Voice enrolled successfully!');
            }
          }
        } catch (voiceErr) {
          console.error('Error during voice setup:', voiceErr);
          toast.error('Voice setup failed, but you can finish onboarding.');
        }
      }

      // 4. Update user preferences
      console.log('Updating preferences...');
      await apiService.updatePreferences({
        autoJoin: formData.autoJoinEnabled,
        timezone: formData.timezone,
      });

      // 5. Handle workspace action
      if (formData.workspaceAction === 'create' && formData.workspaceName) {
        console.log('Creating workspace...');
        const workspaceResponse = await apiService.createWorkspace({
          name: formData.workspaceName,
        });
        
        if (workspaceResponse.error) {
          console.error('Workspace creation failed:', workspaceResponse.error);
        } else {
          toast.success('Workspace created successfully!');
        }
      } else if (formData.workspaceAction === 'join' && formData.workspaceCode) {
        console.log('Joining workspace...');
        const joinResponse = await apiService.joinWorkspace(formData.workspaceCode);
        
        if (joinResponse.error) {
          console.error('Failed to join workspace:', joinResponse.error);
          toast.error(joinResponse.error);
        } else {
          toast.success('Joined workspace successfully!');
        }
      }

      console.log('Onboarding completed successfully!');
      
      // Refresh user data to get the updated profile picture and other info
      await refreshUser();
      
      toast.success('Welcome to Kairo! Your setup is complete.', 'Onboarding Complete');
      
      // Navigate to dashboard after a brief delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
      
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete onboarding');
      setIsSubmitting(false);
    }
  };

  // Add this function to update formData from child steps
  const updateFormData = (newData: Partial<OnboardingData>) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <ProfileStep data={formData} onChange={updateFormData} />;
      case 2:
        return <VoiceStep data={formData} onChange={updateFormData} />;
      case 3:
        return <CalendarStep data={formData} onChange={updateFormData} />; // NEW
      case 4:
        return <WorkspaceStep data={formData} onChange={updateFormData} />;
      case 5:
        return <FinishStep onFinish={handleFinish} isSubmitting={isSubmitting} />;
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
        {currentStep < 5 && (
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              {steps.slice(0, 4).map((step, idx) => (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all text-sm ${
                      step.number < currentStep
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50'
                        : step.number === currentStep
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-2xl shadow-purple-500/50 scale-110'
                        : 'bg-white/10 text-slate-400'
                    }`}>
                      {step.number < currentStep ? <Check className="w-5 h-5" /> : step.number}
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-300 whitespace-nowrap">{step.title}</div>
                  </div>
                  {idx < 3 && (
                    <div className={`flex-1 h-1 mx-4 mb-6 rounded-full transition-all ${
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
          {currentStep < 5 && (
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
        {currentStep < 5 && (
          <div className="text-center mt-3 text-xs text-slate-400">
            Step {currentStep} of 4
          </div>
        )}
      </div>
    </div>
  );
}