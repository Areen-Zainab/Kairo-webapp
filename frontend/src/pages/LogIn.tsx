import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, Github, AlertCircle, Zap, Shield, Globe } from 'lucide-react';
import { useNavigate } from "react-router-dom";

export default function KairoLoginPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      if (email && password) {
        // Navigate to dashboard on success
        navigate('/dashboard');
      } else {
        setError('Please fill in all fields');
      }
      setIsLoading(false);
    }, 1500);
  };

  const handleSocialLogin = (provider: string) => {
    alert(`Login with ${provider} - Coming soon!`);
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
        href="/" onClick={() => navigate('/')}
        className="fixed top-6 left-6 md:top-8 md:left-8 z-50 flex items-center space-x-2 group cursor-pointer"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/50">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
        </div>
        <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Kairo
        </span>
      </a>

      {/* Two Column Layout */}
      <div className="relative z-10 h-screen flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Side - Branding & Trust */}
            <div className="hidden lg:block space-y-6 pr-8" style={{ animation: 'slideIn 0.6s ease-out' }}>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold leading-tight">
                  Welcome back to
                  <span className="block bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
                    Kairo AI
                  </span>
                </h1>
                <p className="text-lg text-slate-400">
                  Transform your meetings into actionable outcomes with AI-powered intelligence
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-start space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-purple-500/30 transition-all">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">Enterprise Security</h3>
                    <p className="text-xs text-slate-400">SOC 2 Type II certified with end-to-end encryption</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-purple-500/30 transition-all">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">Lightning Fast</h3>
                    <p className="text-xs text-slate-400">Real-time AI processing with 99.9% uptime</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-purple-500/30 transition-all">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">Global Trust</h3>
                    <p className="text-xs text-slate-400">500+ teams across 50+ countries</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto" style={{ animation: 'slideIn 0.8s ease-out' }}>
              {/* Glow effect behind card */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl blur-3xl opacity-20" />
              
              {/* Login Card */}
              <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2">Sign in to your account</h2>
                  <p className="text-slate-400 text-sm">Enter your credentials to continue</p>
                </div>

                {/* Social Login Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={() => handleSocialLogin('Google')}
                    className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    aria-label="Sign in with Google"
                  >
                    <Chrome className="w-4 h-4 group-hover:scale-110 transition-transform" aria-hidden="true" />
                    <span className="text-sm font-medium">Google</span>
                  </button>
                  
                  <button
                    onClick={() => handleSocialLogin('GitHub')}
                    className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    aria-label="Sign in with GitHub"
                  >
                    <Github className="w-4 h-4 group-hover:scale-110 transition-transform" aria-hidden="true" />
                    <span className="text-sm font-medium">GitHub</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative bg-transparent px-3 bg-slate-900 text-xs text-slate-500">OR</div>
                </div>

                {/* Login Form */}
                <div className="space-y-4">
                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                      Email
                    </label>
                    <div className="relative group">
                      <div className={`absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur-md opacity-0 group-hover:opacity-20 transition-opacity ${focusedInput === 'email' ? 'opacity-30' : ''}`} />
                      <div className="relative flex items-center">
                        <Mail className="absolute left-3 w-4 h-4 text-slate-400" />
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onFocus={() => setFocusedInput('email')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="you@company.com"
                          className={`w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none transition-all ${
                            focusedInput === 'email'
                              ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                      Password
                    </label>
                    <div className="relative group">
                      <div className={`absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur-md opacity-0 group-hover:opacity-20 transition-opacity ${focusedInput === 'password' ? 'opacity-30' : ''}`} />
                      <div className="relative flex items-center">
                        <Lock className="absolute left-3 w-4 h-4 text-slate-400" />
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={() => setFocusedInput('password')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="Enter your password"
                          className={`w-full pl-10 pr-10 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none transition-all ${
                            focusedInput === 'password'
                              ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute bg-transparent right-3 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 rounded"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Remember me</span>
                    </label>
                    <a 
                      href="/forgot-password" 
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center space-x-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="group w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all flex items-center justify-center space-x-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    aria-label="Sign in to your account"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>

                {/* Sign Up Link */}
                <div className="mt-6 text-center text-sm text-slate-400">
                  Don't have an account?{' '}
                  <a 
                    href="/signup" 
                    onClick={() => navigate('/signup')}
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors hover:underline"
                  >
                    Create one now
                  </a>
                </div>
              </div>

              {/* Bottom Text */}
              <div className="mt-4 text-center text-xs text-slate-500">
                Protected by encryption · <a href="/terms" className="hover:text-slate-400 transition-colors">Terms</a> · <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}