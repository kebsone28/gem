import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors duration-200 bg-gray-800 text-yellow-400 hover:bg-gray-700 ${className}`}
      aria-label="Toggle theme"
      title="Thème fixé en Wanekoo Deep Navy"
    >
      <Sun size={20} />
    </button>
  );
};
