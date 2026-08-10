import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = 'light' | 'dark' | 'system';
type Font = 'arial' | 'montserrat' | 'quicksand' | 'jetbrains-mono' | 'pixel-sans';

interface ThemeContextType {
  theme: Theme;
  font: Font;
  setTheme: (theme: Theme) => void;
  setFont: (font: Font) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    // Default to system if no saved theme
    return savedTheme || 'system';
  });
  const [font, setFontState] = useState<Font>(() => {
    const savedFont = localStorage.getItem('font') as Font;
    // Default to montserrat if no saved font
    return savedFont || 'montserrat';
  });

  useEffect(() => {
    // Apply theme to document
    const applyTheme = (currentTheme: Theme) => {
      if (currentTheme === 'system') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    // Listen for system theme changes if theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  useEffect(() => {
    // Apply font to document and body
    const fontMap: Record<Font, string> = {
      'arial': 'Arial, sans-serif',
      'montserrat': 'Montserrat, sans-serif',
      'quicksand': 'Quicksand, sans-serif',
      'jetbrains-mono': 'JetBrains Mono, monospace',
      'pixel-sans': 'VT323, monospace'
    };
    
    document.documentElement.style.fontFamily = fontMap[font];
    document.body.style.fontFamily = fontMap[font];
    localStorage.setItem('font', font);
  }, [font]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setFont = (newFont: Font) => {
    setFontState(newFont);
  };

  return (
    <ThemeContext.Provider value={{ theme, font, setTheme, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
