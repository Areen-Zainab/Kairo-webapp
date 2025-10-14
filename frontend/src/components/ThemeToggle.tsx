import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 bg-transparent md:p-2 transition-all duration-300 hover:bg-slate-800/50 rounded-lg"
      title={`Theme: ${theme}`}
    >
      {theme === 'dark' ? (
        <Moon className="w-4 h-4 md:w-[18px] md:h-[18px] text-slate-400 hover:text-white transition-colors duration-300" />
      ) : (
        <Sun className="w-4 h-4 md:w-[18px] md:h-[18px] text-slate-400 hover:text-white transition-colors duration-300" />
      )}
    </button>
  );
};

export default ThemeToggle;


