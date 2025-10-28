import React, { useState } from 'react';
import { Sparkles, Mail, ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '../context/ToastContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const navigate = useNavigate();
  const toast = useToastContext();

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async () => {
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setShowSuccess(true);
    
    // Hide success message after 5 seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 5000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isFormValid && !isSubmitting) {
      handleSubmit();
    }
  };

  const isFormValid = email.trim() !== '' && validateEmail(email) && !emailError;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center overflow-hidden">
      {/* Animated Background - Less Purple */}
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div className="absolute w-96 h-96 bg-slate-600/20 rounded-full blur-3xl top-1/4 left-1/4 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-500/15 rounded-full blur-3xl bottom-1/4 right-1/4 animate-pulse" style={{ animationDelay: '1s' }} />
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-slate-400/40 rounded-full"
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
          0%, 100% { transform: translateY(0px); opacity: 0.3; }
          50% { transform: translateY(-20px); opacity: 0.6; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        .animate-slideOut {
          animation: slideOut 0.3s ease-out;
        }
      `}</style>

      {/* Logo */}
      <a href="/">
      <div className="fixed top-6 left-6 md:top-8 md:left-8 z-50 flex items-center space-x-2">
        <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-300 to-blue-400 bg-clip-text text-transparent">
          Kairo
        </span>
      </div>
      </a>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md px-4 animate-fadeIn">
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-slate-600 to-blue-600 rounded-2xl mb-4 shadow-lg">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Forgot your password?
            </h1>
            <p className="text-slate-300 text-sm">
              Enter your registered email address, and we'll send you reset instructions.
            </p>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div 
              className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start space-x-3 animate-slideIn"
              role="alert"
              aria-live="polite"
            >
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-400 mt-0.5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-green-300 font-medium">
                  If this email is registered, a password reset link has been sent.
                </p>
                <p className="text-xs text-green-400/80 mt-1">
                  Please check your inbox and spam folder.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-slate-300"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={handleEmailChange}
                  onKeyPress={handleKeyPress}
                  placeholder="you@example.com"
                  className={`w-full pl-11 pr-4 py-3 bg-white/5 border ${
                    emailError ? 'border-red-500/50' : 'border-white/10'
                  } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                  aria-label="Email address"
                  aria-invalid={emailError ? 'true' : 'false'}
                  aria-describedby={emailError ? 'email-error' : undefined}
                  disabled={isSubmitting}
                />
              </div>
              {emailError && (
                <p 
                  id="email-error" 
                  className="text-xs text-red-400 mt-1"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-slate-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-2xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center space-x-2"
              aria-label={isSubmitting ? 'Sending reset link...' : 'Send reset link'}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>
          </div>

          {/* Back to Sign In Link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors group"
              aria-label="Back to sign in page"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>

        {/* Additional Help Text */}
        <div className="mt-6 bg-transparent text-center">
          <p className="text-xs bg-transparent text-slate-400">
            Still having trouble? Contact:{' '}
            <button 
              className="text-blue-400 bg-transparent hover:text-blue-300 underline"
              onClick={() => toast.info('Our support team will get back to you soon!', 'Contact Support')}
            >
              support
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}