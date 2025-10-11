import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, Lock, Eye, EyeOff, User, ArrowRight, Chrome, Github, CheckCircle2, Shield, Zap, Globe } from 'lucide-react';

export default function KairoSignUpPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Password strength checker
  useEffect(() => {
    if (formData.password.length === 0) {
      setPasswordStrength(null);
      return;
    }
    
    const hasLength = formData.password.length >= 8;
    const hasNumber = /\d/.test(formData.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);
    const hasUpper = /[A-Z]/.test(formData.password);
    
    const strengthScore = [hasLength, hasNumber, hasSpecial, hasUpper].filter(Boolean).length;
    
    if (strengthScore <= 1) setPasswordStrength('weak');
    else if (strengthScore === 2 || strengthScore === 3) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [formData.password]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Too short';
    }

    if (!formData.email) {
      newErrors.email = 'Required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email';
    }

    if (!formData.password) {
      newErrors.password = 'Required';
    } else if (formData.password.length < 8) {
      newErrors.password = '8+ characters needed';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Need upper, lower & number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Must match';
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'Required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      alert('Account created successfully!');
      setIsLoading(false);
    }, 1500);

    // navigate to onboarding or dashboard
    window.location.href = '/onboarding';

  };

  const handleSocialSignUp = (provider: string) => {
    alert(`Sign up with ${provider} - Coming soon!`);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength === 'weak') return 'bg-red-500';
    if (passwordStrength === 'medium') return 'bg-yellow-500';
    if (passwordStrength === 'strong') return 'bg-green-500';
    return 'bg-slate-700';
  };

  const getPasswordStrengthWidth = () => {
    if (passwordStrength === 'weak') return 'w-1/3';
    if (passwordStrength === 'medium') return 'w-2/3';
    if (passwordStrength === 'strong') return 'w-full';
    return 'w-0';
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-purple-500/30 rounded-full blur-3xl transition-all duration-300 ease-out"
          style={{
            left: `${mousePosition.x / 15}px`,
            top: `${mousePosition.y / 15}px`,
          }}
        />
        <div 
          className="absolute w-[500px] h-[500px] bg-blue-500/25 rounded-full blur-3xl"
          style={{
            right: `${-mousePosition.x / 25}px`,
            top: `${mousePosition.y / 30 + 100}px`,
            transition: 'all 0.5s ease-out'
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Floating particles */}
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
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Logo - Top Left */}
      <a 
        href="/"
        className="fixed top-6 left-6 md:top-8 md:left-8 z-50 flex items-center space-x-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg"
        aria-label="Go to Kairo homepage"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/50">
          <Sparkles className="w-6 h-6 text-white animate-pulse" aria-hidden="true" />
        </div>
        <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Kairo
        </span>
      </a>

      {/* Two Column Layout */}
      <div className="relative z-10 h-screen flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Side - Branding */}
            <div className="hidden lg:block space-y-6 pr-8" style={{ animation: 'slideIn 0.6s ease-out' }}>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold leading-tight">
                  Join Kairo
                  <span className="block bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
                    Where meetings turn into action
                  </span>
                </h1>
                <p className="text-lg text-slate-400">
                  Create your account and start transforming your meetings with AI-powered intelligence
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-start space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">Secure & Private</h3>
                    <p className="text-xs text-slate-400">Enterprise-grade encryption for all your data</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">Start in Seconds</h3>
                    <p className="text-xs text-slate-400">Quick setup, instant access to all features</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">Join 500+ Teams</h3>
                    <p className="text-xs text-slate-400">Trusted by companies worldwide</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Sign Up Form */}
            <div className="w-full max-w-lg mx-auto lg:mx-0 lg:ml-auto" style={{ animation: 'slideIn 0.8s ease-out' }}>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl blur-3xl opacity-20" />
              
              {/* Sign Up Card */}
              <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-5">
                  <h2 className="text-2xl font-bold mb-1.5">Create your account</h2>
                  <p className="text-slate-400 text-sm">Start your journey with Kairo today</p>
                </div>

                {/* Social Sign Up */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button
                    onClick={() => handleSocialSignUp('Google')}
                    className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                    aria-label="Sign up with Google"
                  >
                    <Chrome className="w-4 h-4 group-hover:scale-110 transition-transform" aria-hidden="true" />
                    <span className="font-medium">Google</span>
                  </button>
                  
                  <button
                    onClick={() => handleSocialSignUp('Microsoft')}
                    className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                    aria-label="Sign up with Microsoft"
                  >
                    <Github className="w-4 h-4 group-hover:scale-110 transition-transform" aria-hidden="true" />
                    <span className="font-medium">Microsoft</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative bg-transparent px-3 bg-slate-900 text-xs text-slate-500">OR</div>
                </div>

                {/* Form - Two Column Layout for Efficiency */}
                <div className="space-y-4">
                  {/* Row 1: Full Name & Email */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="fullName" className="block text-sm font-medium text-slate-300">
                        Full Name
                      </label>
                      <div className="relative group">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
                        <input
                          id="fullName"
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => handleInputChange('fullName', e.target.value)}
                          onFocus={() => setFocusedInput('fullName')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="John Doe"
                          className={`w-full pl-10 pr-3 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none transition-all ${
                            errors.fullName
                              ? 'border-red-500 focus:ring-1 focus:ring-red-500/50'
                              : focusedInput === 'fullName'
                              ? 'border-purple-500 focus:ring-1 focus:ring-purple-500/50'
                              : 'border-white/10'
                          }`}
                          aria-invalid={!!errors.fullName}
                        />
                      </div>
                      {errors.fullName && (
                        <p className="text-xs text-red-400">{errors.fullName}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                        Email
                      </label>
                      <div className="relative group">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
                        <input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          onFocus={() => setFocusedInput('email')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="you@company.com"
                          className={`w-full pl-10 pr-3 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none transition-all ${
                            errors.email
                              ? 'border-red-500 focus:ring-1 focus:ring-red-500/50'
                              : focusedInput === 'email'
                              ? 'border-purple-500 focus:ring-1 focus:ring-purple-500/50'
                              : 'border-white/10'
                          }`}
                          aria-invalid={!!errors.email}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs text-red-400">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Password & Confirm Password */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                        Password
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          onFocus={() => setFocusedInput('password')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="Min 8 characters"
                          className={`w-full pl-10 pr-10 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none transition-all ${
                            errors.password
                              ? 'border-red-500 focus:ring-1 focus:ring-red-500/50'
                              : focusedInput === 'password'
                              ? 'border-purple-500 focus:ring-1 focus:ring-purple-500/50'
                              : 'border-white/10'
                          }`}
                          aria-invalid={!!errors.password}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-0 bg-transparent top-0.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {formData.password && !errors.password && (
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${getPasswordStrengthColor()} ${getPasswordStrengthWidth()} transition-all duration-300`} />
                        </div>
                      )}
                      {errors.password && (
                        <p className="text-xs text-red-400">{errors.password}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
                        Confirm
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          onFocus={() => setFocusedInput('confirmPassword')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="Re-enter password"
                          className={`w-full pl-10 pr-10 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none transition-all ${
                            errors.confirmPassword
                              ? 'border-red-500 focus:ring-1 focus:ring-red-500/50'
                              : focusedInput === 'confirmPassword'
                              ? 'border-purple-500 focus:ring-1 focus:ring-purple-500/50'
                              : 'border-white/10'
                          }`}
                          aria-invalid={!!errors.confirmPassword}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-0 bg-transparent top-0.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {formData.confirmPassword && !errors.confirmPassword && formData.password === formData.confirmPassword && (
                        <p className="flex items-center space-x-1 text-xs text-green-400">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          <span>Match</span>
                        </p>
                      )}
                      {errors.confirmPassword && (
                        <p className="text-xs text-red-400">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="pt-2">
                    <label className="flex items-start space-x-2.5 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={formData.acceptTerms}
                        onChange={(e) => handleInputChange('acceptTerms', e.target.checked)}
                        className={`w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-500/50 cursor-pointer flex-shrink-0 ${
                          errors.acceptTerms ? 'border-red-500' : ''
                        }`}
                        aria-invalid={!!errors.acceptTerms}
                      />
                      <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                        I agree to{' '}
                        <a href="/terms" className="text-purple-400 hover:text-purple-300 underline">Terms</a>
                        {' '}&{' '}
                        <a href="/privacy" className="text-purple-400 hover:text-purple-300 underline">Privacy</a>
                      </span>
                    </label>
                    {errors.acceptTerms && (
                      <p className="text-xs text-red-400 ml-6 mt-1">{errors.acceptTerms}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="group w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all flex items-center justify-center space-x-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 mt-5"
                    aria-label="Create your account"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>

                {/* Log In Link */}
                <div className="mt-5 text-center text-sm text-slate-400">
                  Already have an account?{' '}
                  <a 
                    href="/login" 
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors hover:underline"
                  >
                    Log In
                  </a>
                </div>
              </div>

              {/* Bottom Text */}
              <div className="mt-3 text-center text-xs text-slate-500">
                Protected by encryption · <a href="/terms" className="hover:text-slate-400 transition-colors">Terms</a> · <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}