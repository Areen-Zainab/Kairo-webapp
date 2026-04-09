import { useEffect, useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setMousePosition({ x: e.clientX, y: e.clientY });
    const handleScroll = () => setScrollY(window.scrollY);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white overflow-hidden">
      {/* Animated Background (same as landing theme) */}
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
            transition: "all 0.5s ease-out",
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        {/* Floating particles (same as landing) */}
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/50 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
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

      {/* Header/Nav (same as landing) */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-6 transition-all duration-300 ${
          scrollY > 50
            ? "backdrop-blur-xl bg-slate-950/90 shadow-lg shadow-purple-500/10"
            : "backdrop-blur-md bg-slate-950/30"
        } border-b border-white/5`}
      >
        <div
          className="flex items-center space-x-2 group cursor-pointer"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" ? navigate("/") : null)}
          aria-label="Go to homepage"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/50">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Kairo
          </span>
        </div>

        <div className="hidden md:flex space-x-8 text-sm">
          {[
            { name: "Features", id: "features" },
            { name: "How It Works", id: "how-it-works" },
            { name: "Pricing", id: "pricing" },
            { name: "Integrations", id: "integrations" },
          ].map((item) => (
            <a
              key={item.name}
              href={`/#${item.id}`}
              className="hover:text-purple-400 transition-all hover:scale-105 relative group py-2"
            >
              {item.name}
              <span className="absolute -bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/login")}
            className="hidden md:block px-4 py-2 text-sm hover:text-purple-400 transition-all hover:scale-105"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all hover:scale-105 hover:-translate-y-0.5"
          >
            Get Started
          </button>
          <button
            className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
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
            {[
              { label: "Features", href: "/#features" },
              { label: "How It Works", href: "/#how-it-works" },
              { label: "Pricing", href: "/#pricing" },
              { label: "Integrations", href: "/#integrations" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-2xl hover:text-purple-400 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <button
              className="text-2xl hover:text-purple-400 transition-colors"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/login");
              }}
            >
              Sign In
            </button>
            <button
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-semibold"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/signup");
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-8 pt-32 pb-20">
        <div className="bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-white/10 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Terms of Service</h1>
          <p className="text-sm text-slate-400 mb-8">Last updated: April 9, 2026</p>

          <div className="space-y-6 text-slate-200/90 leading-relaxed">
            <p className="text-slate-300">
              These Terms of Service (“Terms”) govern your use of Kairo and any related services. This page is provided as a
              minimal, informational placeholder.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Use of the Service</h2>
              <p className="text-slate-300">
                You agree to use Kairo responsibly and comply with applicable laws. You are responsible for the content you
                upload or process through the service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Accounts</h2>
              <p className="text-slate-300">
                You are responsible for maintaining the confidentiality of your account credentials and for activity under
                your account.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Privacy</h2>
              <p className="text-slate-300">
                Our handling of personal data is described in the{" "}
                <a href="/privacy" className="text-purple-300 hover:text-purple-200 underline">
                  Privacy Policy
                </a>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Disclaimer</h2>
              <p className="text-slate-300">
                The service is provided “as is” without warranties of any kind to the fullest extent permitted by law.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Contact</h2>
              <p className="text-slate-300">
                If you have questions about these Terms, contact us through the support channels listed in the app.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 text-sm text-slate-400 flex flex-wrap gap-4">
            <a href="/" className="hover:text-purple-300 transition-colors">
              Home
            </a>
            <a href="/privacy" className="hover:text-purple-300 transition-colors">
              Privacy
            </a>
            <a href="/login" className="hover:text-purple-300 transition-colors">
              Sign in
            </a>
            <a href="/signup" className="hover:text-purple-300 transition-colors">
              Create account
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

