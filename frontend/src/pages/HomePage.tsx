import React, { useState, useEffect, useRef } from 'react';
import { Zap, Brain, Calendar, Target, Users, BarChart3, MessageSquare, Sparkles, ArrowRight, CheckCircle2, Play, Mic, Video, Shield, Rocket, Globe, Bot, Activity, ChevronDown, X, Menu, Star, Award, Layers } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { useToastContext } from '../context/ToastContext';

export default function KairoHomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [activeFeature, setActiveFeature] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
  const [typedText, setTypedText] = useState('');
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const fullText = "understand & execute";
  const heroRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToastContext();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    const handleScroll = () => {
      const scrolled = window.scrollY;
      setScrollY(scrolled);
      setShowScrollTop(scrolled > 500);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Typing animation with cursor
  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 80);
    return () => clearInterval(typingInterval);
  }, []);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 6);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible((prev) => ({
            ...prev,
            [entry.target.id]: entry.isIntersecting,
          }));
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('[data-animate]').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Transcription",
      description: "Real-time speech-to-text with speaker diarization and 95% accuracy",
      color: "from-purple-500 to-pink-500",
      gradient: "bg-gradient-to-br from-purple-500/20 to-pink-500/20"
    },
    {
      icon: Target,
      title: "Action Item Detection",
      description: "Automatically extract tasks, deadlines, and responsibilities in real-time",
      color: "from-blue-500 to-cyan-500",
      gradient: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20"
    },
    {
      icon: Shield,
      title: "Privacy Mode",
      description: "Pause transcription during sensitive discussions—instant toggle from the live meeting, with full audit intervals stored for compliance",
      color: "from-green-500 to-emerald-500",
      gradient: "bg-gradient-to-br from-green-500/20 to-emerald-500/20"
    },
    {
      icon: Users,
      title: "Meeting Memory",
      description: "Context-aware insights from past discussions with semantic search",
      color: "from-indigo-500 to-purple-500",
      gradient: "bg-gradient-to-br from-indigo-500/20 to-purple-500/20"
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Track team productivity, task completion rates, and meeting efficiency",
      color: "from-cyan-500 to-blue-500",
      gradient: "bg-gradient-to-br from-cyan-500/20 to-blue-500/20"
    },
    {
      icon: MessageSquare,
      title: "Kanban Generation",
      description: "Transform meetings into actionable Trello-style project boards instantly",
      color: "from-emerald-500 to-teal-500",
      gradient: "bg-gradient-to-br from-emerald-500/20 to-teal-500/20"
    }
  ];

  const stats = [
    { value: "95%", label: "Task Capture Rate", icon: Target },
    { value: "3x", label: "Faster Follow-up", icon: Zap },
    { value: "100+", label: "Teams Trust Us", icon: Users },
    { value: "50k+", label: "Meetings Analyzed", icon: BarChart3 }
  ];

  const processSteps = [
    { 
      step: "01", 
      title: "Join & Record", 
      desc: "Kairo bot joins your meeting on Zoom or Google Meet automatically",
      icon: Video,
      details: ["Silent participant", "HD recording", "Multi-platform support"]
    },
    { 
      step: "02", 
      title: "AI Analysis", 
      desc: "Real-time transcription and intelligent task extraction with speaker diarization",
      icon: Brain,
      details: ["Live transcription", "Action item detection", "Deadline parsing"]
    },
    { 
      step: "03", 
      title: "Execute", 
      desc: "Automated Kanban boards, reminders, and privacy controls so nothing slips through",
      icon: Rocket,
      details: ["Auto task boards", "Follow-up reminders", "Privacy mode when you need it"]
    }
  ];

  const testimonials = [
    {
      quote: "The meeting memory feature is incredible. It's like having a perfect team assistant who never forgets.",
      author: "Ahmad Hussain",
      role: "Engineering Lead at SuperviseTech",
      avatar: "AH",
      company: "SuperviseTech"
    },
    {
      quote: "Kairo has completely transformed how our team operates. We never miss action items anymore.",
      author: "Mahum Hamid",
      role: "Product Manager at Mashwara-e-Taleem",
      avatar: "MH",
      company: "Mashwara-e-Taleem"
    },
    {
      quote: "Our sprint retrospectives are now actually productive. Tasks flow directly into our workflow.",
      author: "Maryum Fasih",
      role: "Scrum Master at DevTeam",
      avatar: "MF",
      company: "DevTeam"
    },
    {
      quote: "Kairo's AI-driven insights help us close projects faster and keep everyone accountable.",
      author: "Abeer Jawad",
      role: "Project Director at InnovateX",
      avatar: "AJ",
      company: "InnovateX"
    }
  ];

  const integrations = [
    { name: "Zoom", color: "bg-blue-500" },
    { name: "Google Meet", color: "bg-green-500" },
    { name: "Jira", color: "bg-blue-600" },
    { name: "Trello", color: "bg-indigo-500" },
    { name: "Slack", color: "bg-purple-500" },
    { name: "Calendar", color: "bg-red-500" }
  ];

  const techStack = [
    { name: "Real-Time AI", icon: Brain, desc: "WhisperX & GPT-4" },
    { name: "Secure Cloud", icon: Shield, desc: "Firebase & Auth" },
    { name: "Fast Processing", icon: Zap, desc: "WebRTC & Node.js" },
    { name: "Smart Memory", icon: Activity, desc: "FAISS & NLP" }
  ];

  const handleEmailSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email) {
      toast.success(`Thanks! We'll send updates to ${email}`, 'Subscribed');
      setEmail('');
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white overflow-hidden">
      {/* Enhanced Animated Background */}
      <div className="fixed w-full h-full inset-0 pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-purple-500/15 rounded-full blur-3xl transition-all duration-300 ease-out"
          style={{
            left: `${mousePosition.x / 15}px`,
            top: `${mousePosition.y / 15}px`,
          }}
        />
        <div 
          className="absolute w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-3xl"
          style={{
            right: `${-mousePosition.x / 25}px`,
            top: `${mousePosition.y / 30 + 100}px`,
            transition: 'all 0.5s ease-out'
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Floating particles */}
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/50 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
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
      `}</style>

      {/* Enhanced Navigation with scroll effect */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-6 transition-all duration-300 ${
        scrollY > 50 ? 'backdrop-blur-xl bg-slate-950/90 shadow-lg shadow-purple-500/10' : 'backdrop-blur-md bg-slate-950/30'
      } border-b border-white/5`}>
        <div className="flex items-center space-x-2 group cursor-pointer" onClick={scrollToTop}>
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/50">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Kairo
          </span>
        </div>
        
        <div className="hidden md:flex space-x-8 text-sm">
          {[
            { name: 'Features', id: 'features' },
            { name: 'How It Works', id: 'how-it-works' },
            { name: 'Pricing', id: 'pricing' },
            { name: 'Integrations', id: 'integrations' }
          ].map((item) => (
            <a 
              key={item.name}
              href={`#${item.id}`}
              className="hover:text-purple-400 transition-all hover:scale-105 relative group py-2"
            >
              {item.name}
              <span className="absolute -bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </div>
        
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate("/login")} className="hidden md:block px-4 py-2 text-sm hover:text-purple-400 transition-all hover:scale-105">
            Sign In
          </button>
          <button onClick={() => navigate("/signup")} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all hover:scale-105 hover:-translate-y-0.5">
            Get Started
          </button>
          <button 
            className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-50 flex flex-col items-center justify-center h-full space-y-8">
            {['Features', 'How It Works', 'Pricing', 'Integrations'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="text-2xl hover:text-purple-400 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <button className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-semibold">
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Hero Section */}
      <div ref={heroRef} className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 pt-32 md:pt-40 pb-20 md:pb-32">
        <div className="text-center space-y-6 md:space-y-8">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm backdrop-blur-sm">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-purple-300">Trusted by 100+ teams worldwide</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight px-4">
            <span className="inline-block">Don't just record</span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent inline-block">
              {typedText}
              <span className="animate-pulse">|</span>
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto px-4">
            Transform your meetings into structured, actionable outcomes with AI-powered transcription, 
            task extraction, and intelligent project boards—all in one seamless platform.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4 md:pt-8 px-4">
            <button className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all flex items-center justify-center space-x-2 hover:scale-105 hover:-translate-y-1">
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </button>
            <button className="group px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-semibold hover:bg-white/10 transition-all flex items-center justify-center space-x-2 hover:scale-105">
              <Play className="w-5 h-5 group-hover:scale-125 transition-transform" />
              <span>Watch Demo</span>
            </button>
          </div>

          {/* Social Proof */}
          <div className="flex items-center justify-center space-x-2 text-sm text-slate-400 pt-4">
            <div className="flex -space-x-2">
              {['SC', 'MJ', 'PS', 'AK'].map((initial, i) => (
                <div 
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-slate-950 flex items-center justify-center text-xs font-bold"
                >
                  {initial}
                </div>
              ))}
            </div>
            <span>Join 500+ professionals already using Kairo</span>
          </div>

          {/* Scroll Indicator */}
          <div className="hidden md:block pt-8 animate-bounce">
            <ChevronDown className="w-6 h-6 mx-auto text-purple-400" />
          </div>
        </div>

        {/* Enhanced Stats with better mobile layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-16 md:mt-24 px-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div 
                key={idx} 
                className="group text-center space-y-2 p-4 md:p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-purple-500/50 transition-all hover:scale-110 hover:-translate-y-2 cursor-pointer"
              >
                <Icon className="w-6 h-6 md:w-8 md:h-8 mx-auto text-purple-400 group-hover:scale-125 transition-transform" />
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-slate-400">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Demo Preview - Enhanced with better responsiveness */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-8 pb-20 md:pb-32">
        <div 
          className="relative group"
          data-animate
          id="demo-preview"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl md:rounded-3xl border border-white/10 p-4 md:p-8 hover:border-purple-500/50 transition-all">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
              <div className="text-xs md:text-sm text-slate-400">kairo.ai/dashboard</div>
            </div>
            <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
              <div className="relative z-10 text-center space-y-4 px-4">
                <Bot className="w-12 h-12 md:w-20 md:h-20 mx-auto text-purple-400 animate-pulse" />
                <div className="text-xl md:text-2xl font-bold">Live Meeting Dashboard</div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 rounded-full">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs md:text-sm">Recording</span>
                  </div>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 rounded-full">
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span className="text-xs md:text-sm">Transcribing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Features Grid */}
      <div id="features" className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-12 md:mb-16" data-animate id="features-header">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300">Powerful Features</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Everything You Need
            <span className="block text-transparent bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text">
              To Execute Flawlessly
            </span>
          </h2>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">Transform every meeting into actionable results</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            const isActive = idx === activeFeature;
            return (
              <div
                key={idx}
                data-animate
                id={`feature-${idx}`}
                className={`group relative p-6 md:p-8 backdrop-blur-sm rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                  isActive 
                    ? 'border-purple-500 shadow-2xl shadow-purple-500/20 scale-105 bg-white/10' 
                    : 'border-white/10 hover:border-purple-500/50 bg-white/5 hover:bg-white/10'
                }`}
                onMouseEnter={() => setActiveFeature(idx)}
                style={{ 
                  animationDelay: `${idx * 0.1}s`,
                  transform: isVisible[`feature-${idx}`] ? 'translateY(0)' : 'translateY(50px)',
                  opacity: isVisible[`feature-${idx}`] ? 1 : 0,
                  transition: 'all 0.6s ease-out'
                }}
              >
                <div className={`absolute inset-0 ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="relative z-10">
                  <div className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all shadow-lg`}>
                    <Icon className="w-6 h-6 md:w-7 md:h-7" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold mb-3 group-hover:text-purple-300 transition-colors">{feature.title}</h3>
                  <p className="text-sm md:text-base text-slate-400 group-hover:text-slate-300 transition-colors">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced How It Works */}
      <div id="how-it-works" className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-12 md:mb-16" data-animate id="how-header">
          <h2 className="text-4xl md:text-5xl font-bold">How Kairo Works</h2>
          <p className="text-lg md:text-xl text-slate-400">Three simple steps to smarter meetings</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {processSteps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx} 
                className="relative group"
                data-animate
                id={`step-${idx}`}
                style={{ 
                  transform: isVisible[`step-${idx}`] ? 'translateY(0)' : 'translateY(50px)',
                  opacity: isVisible[`step-${idx}`] ? 1 : 0,
                  transition: `all 0.6s ease-out ${idx * 0.2}s`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6 md:p-8 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 hover:border-purple-500/50 transition-all hover:scale-105">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-5xl md:text-6xl font-bold text-purple-500/30 group-hover:text-purple-500/50 transition-colors">
                      {item.step}
                    </div>
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-purple-500/50">
                      <Icon className="w-7 h-7 md:w-8 md:h-8" />
                    </div>
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold mb-3 group-hover:text-purple-300 transition-colors">{item.title}</h3>
                  <p className="text-sm md:text-base text-slate-400 mb-6">{item.desc}</p>
                  <div className="space-y-2">
                    {item.details.map((detail, i) => (
                      <div key={i} className="flex items-center space-x-2 text-xs md:text-sm text-slate-500 group-hover:text-slate-400 transition-colors">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {idx < 2 && (
                  <div className="hidden lg:block absolute top-20 -right-6 w-12 h-0.5 bg-gradient-to-r from-purple-500 to-transparent animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Integrations Section */}
      <div id="integrations" className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-12 md:mb-16" data-animate id="integrations-header">
          <h2 className="text-4xl md:text-5xl font-bold">Seamless Integrations</h2>
          <p className="text-lg md:text-xl text-slate-400">Works with the tools you already use</p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {integrations.map((integration, idx) => (
            <div
              key={idx}
              className="group px-6 md:px-8 py-3 md:py-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-purple-500/50 transition-all hover:scale-110 cursor-pointer"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 ${integration.color} rounded-full group-hover:scale-150 transition-transform`} />
                <span className="text-sm md:text-base font-semibold group-hover:text-purple-300 transition-colors">{integration.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-12 md:mb-16" data-animate id="tech-header">
          <h2 className="text-4xl md:text-5xl font-bold">Built on Cutting-Edge Tech</h2>
          <p className="text-lg md:text-xl text-slate-400">Enterprise-grade infrastructure you can trust</p>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {techStack.map((tech, idx) => {
            const Icon = tech.icon;
            return (
              <div
                key={idx}
                className="group p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-purple-500/50 transition-all hover:scale-105 cursor-pointer text-center"
              >
                <Icon className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-purple-400 group-hover:scale-125 transition-transform" />
                <h4 className="text-base md:text-lg font-semibold mb-2 group-hover:text-purple-300 transition-colors">{tech.name}</h4>
                <p className="text-xs md:text-sm text-slate-400">{tech.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Testimonials Carousel - Enhanced */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-12 md:mb-16" data-animate id="testimonials-header">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-sm">
            <Award className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300">Wall of Love</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">Loved by Teams Worldwide</h2>
          <p className="text-lg md:text-xl text-slate-400">See what our users have to say</p>
        </div>

        <div className="relative min-h-[300px] md:min-h-[280px]">
          {testimonials.map((testimonial, idx) => (
            <div
              key={idx}
              className={`transition-all duration-500 ${
                idx === activeTestimonial 
                  ? 'opacity-100 scale-100 relative' 
                  : 'opacity-0 scale-95 absolute inset-0'
              }`}
            >
              <div className="p-8 md:p-12 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 hover:border-purple-500/30 transition-all">
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-xl md:text-2xl text-slate-300 mb-8 italic leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm md:text-base font-bold shadow-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-base md:text-lg">{testimonial.author}</div>
                    <div className="text-xs md:text-sm text-slate-400">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <div className="flex justify-center space-x-2 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTestimonial(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === activeTestimonial 
                    ? 'bg-purple-500 w-8' 
                    : 'bg-white/30 hover:bg-white/50 w-2'
                }`}
                aria-label={`View testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Benefits Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="space-y-6 md:space-y-8" data-animate id="benefits-text">
            <h2 className="text-4xl md:text-5xl font-bold">
              Built for teams that
              <span className="block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                execute with precision
              </span>
            </h2>
            <div className="space-y-4">
              {[
                "Never lose track of action items or deadlines",
                "Maintain meeting context across sprint cycles",
                "Automatic task boards from discussions",
                "Seamless integration with your workflow",
                "Enterprise-grade security and compliance",
                "Real-time collaboration features"
              ].map((benefit, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start space-x-3 group hover:translate-x-2 transition-transform"
                >
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-400 flex-shrink-0 mt-1 group-hover:scale-125 transition-transform" />
                  <span className="text-base md:text-lg text-slate-300 group-hover:text-white transition-colors">{benefit}</span>
                </div>
              ))}
            </div>
            <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105 hover:-translate-y-1 flex items-center space-x-2">
              <span>Try Kairo Free</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          <div className="relative" data-animate id="benefits-visual">
            <div className="relative aspect-square">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-3xl backdrop-blur-sm border border-white/10 p-6 md:p-8">
                <div className="w-full h-full bg-slate-900/50 rounded-2xl flex items-center justify-center relative overflow-hidden">
                  {/* Animated Dashboard Elements */}
                  <div className="absolute top-4 left-4 right-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                      <div className="h-2 w-24 md:w-32 bg-slate-700 rounded animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div 
                          key={i} 
                          className="h-10 md:h-12 bg-slate-800 rounded-lg animate-pulse"
                          style={{ animationDelay: `${i * 0.2}s` }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div 
                          key={i} 
                          className="h-16 md:h-20 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg backdrop-blur-sm border border-white/10 animate-pulse"
                          style={{ animationDelay: `${i * 0.3}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating notification cards */}
              <div className="absolute -top-2 md:-top-4 -right-2 md:-right-4 w-40 md:w-48 p-3 md:p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl animate-bounce shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-semibold">Task Created</span>
                </div>
                <div className="text-xs text-slate-400">3 action items detected</div>
              </div>
              
              <div className="absolute -bottom-2 md:-bottom-4 -left-2 md:-left-4 w-40 md:w-48 p-3 md:p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl animate-bounce shadow-lg" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center space-x-2 mb-2">
                  <Brain className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold">AI Processing</span>
                </div>
                <div className="text-xs text-slate-400">Analyzing transcript...</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Demo Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="bg-gradient-to-br from-slate-900/80 to-purple-900/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 md:p-12 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
          
          <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-500/30 rounded-full text-sm">
                <Activity className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>Live in Action</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">See Kairo Transform Your Meetings</h2>
              <p className="text-slate-400">Watch how AI extracts action items in real-time and generates instant task boards</p>
              <button className="group px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all flex items-center space-x-2 hover:scale-105">
                <Play className="w-5 h-5 group-hover:scale-125 transition-transform" />
                <span>Watch 2-Min Demo</span>
              </button>
            </div>
            
            <div className="relative">
              <div className="aspect-video bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden relative">
                {/* Simulated transcript feed */}
                <div className="absolute inset-0 p-4 md:p-6 space-y-3 overflow-hidden">
                  {[
                    { speaker: "Sana", text: "Let's assign this to the dev team", highlight: true },
                    { speaker: "Muhammad", text: "I'll handle the deployment by Friday", highlight: true },
                    { speaker: "Areeba", text: "Sounds good, let's review on Monday", highlight: false },
                  ].map((line, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg ${line.highlight ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-white/5'} animate-pulse`}
                      style={{ animationDelay: `${idx * 0.5}s` }}
                    >
                      <div className="text-xs text-purple-400 mb-1">{line.speaker}</div>
                      <div className="text-sm">{line.text}</div>
                      {line.highlight && (
                        <div className="flex items-center space-x-1 mt-2 text-xs text-green-400">
                          <Target className="w-3 h-3" />
                          <span>Action item detected</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-12 md:mb-16" data-animate id="pricing-header">
          <h2 className="text-4xl md:text-5xl font-bold">Simple, Transparent Pricing</h2>
          <p className="text-lg md:text-xl text-slate-400">Choose the plan that fits your team</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {[
            {
              name: "Starter",
              price: "$0",
              period: "forever",
              description: "Perfect for small teams getting started",
              features: ["Up to 10 meetings/month", "Basic transcription", "Task extraction", "5 team members", "Email support"],
              cta: "Start Free",
              popular: false
            },
            {
              name: "Professional",
              price: "$49",
              period: "per month",
              description: "For growing teams that need more",
              features: ["Unlimited meetings", "Advanced AI features", "Meeting memory", "Unlimited team members", "Priority support", "Live privacy mode", "Analytics dashboard"],
              cta: "Start Trial",
              popular: true
            },
            {
              name: "Enterprise",
              price: "Custom",
              period: "contact us",
              description: "For large organizations with special needs",
              features: ["Everything in Pro", "Custom integrations", "Dedicated support", "SLA guarantee", "Custom AI training", "On-premise deployment"],
              cta: "Contact Sales",
              popular: false
            }
          ].map((plan, idx) => (
            <div
              key={idx}
              className={`relative p-6 md:p-8 rounded-3xl border transition-all hover:scale-105 ${
                plan.popular
                  ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500 shadow-2xl shadow-purple-500/20'
                  : 'bg-white/5 backdrop-blur-sm border-white/10 hover:border-purple-500/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-sm font-semibold shadow-lg">
                  Most Popular
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-xl md:text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="text-4xl md:text-5xl font-bold mb-2">
                  {plan.price}
                  {plan.price !== "Custom" && <span className="text-base md:text-lg text-slate-400">/{plan.period.split(' ')[0]}</span>}
                </div>
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>

              <button className={`w-full py-4 rounded-xl font-semibold transition-all ${
                plan.popular
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50'
                  : 'bg-white/10 hover:bg-white/20'
              } hover:scale-105`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-12 md:mb-16" data-animate id="faq-header">
          <h2 className="text-4xl md:text-5xl font-bold">Frequently Asked Questions</h2>
          <p className="text-lg md:text-xl text-slate-400">Everything you need to know</p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "How does Kairo join my meetings?",
              a: "Kairo uses a virtual bot that joins your Zoom or Google Meet sessions as a participant. It records, transcribes, and analyzes everything automatically."
            },
            {
              q: "Is my data secure?",
              a: "Absolutely. We use enterprise-grade encryption, comply with GDPR and SOC 2, and never share your data with third parties."
            },
            {
              q: "Can I try Kairo for free?",
              a: "Yes! Our Starter plan is free forever for up to 10 meetings per month. No credit card required."
            },
            {
              q: "What languages does Kairo support?",
              a: "Currently, Kairo supports English transcription with 95% accuracy. More languages are coming soon."
            },
            {
              q: "How accurate is the AI?",
              a: "Our AI achieves 95% transcription accuracy and identifies action items with 90% precision, improving with each meeting."
            }
          ].map((faq, idx) => (
            <details 
              key={idx}
              className="group p-4 md:p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer"
            >
              <summary className="flex items-center justify-between font-semibold text-base md:text-lg list-none cursor-pointer">
                <span className="group-hover:text-purple-300 transition-colors pr-4">{faq.q}</span>
                <ChevronDown className="w-5 h-5 flex-shrink-0 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-4 text-sm md:text-base text-slate-400 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Enhanced CTA Section */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity" />
          <div className="relative bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-sm border border-purple-500/30 rounded-3xl p-8 md:p-12 text-center space-y-8">
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-4 animate-pulse shadow-lg shadow-purple-500/50">
              <Rocket className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold">Ready to transform your meetings?</h2>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
              Join hundreds of teams already using Kairo to make every meeting count
            </p>
            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row justify-center gap-4 max-w-xl mx-auto">
              <input 
                type="email" 
                placeholder="Enter your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl w-full sm:flex-1 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
              <button 
                type="submit"
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105 whitespace-nowrap"
              >
                Get Started Free
              </button>
            </form>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-xs md:text-sm text-slate-400">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center space-x-2 mb-4 group cursor-pointer" onClick={scrollToTop}>
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/50">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold">Kairo</span>
              </div>
              <p className="text-sm text-slate-400 mb-6 max-w-xs">
                AI-powered meeting intelligence for teams that execute. Never miss an action item again.
              </p>
              <div className="flex space-x-4">
                {['twitter', 'linkedin', 'github'].map((social) => (
                  <button 
                    key={social}
                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    aria-label={`Visit our ${social}`}
                  >
                    <Globe className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>
            
            {[
              {
                title: "Product",
                links: ["Features", "Pricing", "Security", "Roadmap", "Changelog"]
              },
              {
                title: "Company",
                links: ["About", "Blog", "Careers", "Contact", "Press"]
              },
              {
                title: "Resources",
                links: ["Docs", "API", "Guides", "Community", "Support"]
              },
              {
                title: "Legal",
                links: ["Privacy", "Terms", "Cookies", "DPA"]
              }
            ].map((column, idx) => (
              <div key={idx} className={idx === 0 ? 'col-span-1' : ''}>
                <h4 className="font-semibold mb-4 text-white">{column.title}</h4>
                <div className="space-y-2">
                  {column.links.map((link) => (
                    <a 
                      key={link}
                      href="#" 
                      className="block text-sm text-slate-400 hover:text-purple-400 transition-colors hover:translate-x-1 transform"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-center md:text-left">
            <div className="text-sm text-slate-400">
              © 2025 Kairo AI. All rights reserved.
            </div>
            <div className="flex items-center flex-wrap justify-center gap-4 md:gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-purple-400 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-purple-400 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-purple-400 transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button 
          onClick={scrollToTop}
          className="fixed bottom-24 right-8 z-50 w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-2xl shadow-purple-500/50 flex items-center justify-center hover:scale-110 transition-all group"
          aria-label="Scroll to top"
        >
          <ChevronDown className="w-6 h-6 rotate-180 group-hover:scale-125 transition-transform" />
        </button>
      )}

      {/* Floating Action Button (Chat) */}
      <button 
        className="fixed bottom-8 right-8 z-50 w-14 h-14 md:w-16 md:h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-2xl shadow-purple-500/50 flex items-center justify-center hover:scale-110 transition-all group"
        aria-label="Open chat"
      >
        <MessageSquare className="w-6 h-6 md:w-7 md:h-7 group-hover:scale-125 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full" />
      </button>
    </div>
  );
}