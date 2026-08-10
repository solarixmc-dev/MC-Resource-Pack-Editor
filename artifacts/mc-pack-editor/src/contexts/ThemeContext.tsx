import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = 'light' | 'dark';
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
    return (localStorage.getItem('theme') as Theme) || 'light';
  });
  const [font, setFontState] = useState<Font>(() => {
    return (localStorage.getItem('font') as Font) || 'arial';
  });

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Apply font to document
    const fontMap: Record<Font, string> = {
      'arial': 'Arial, sans-serif',
      'montserrat': 'Montserrat, sans-serif',
      'quicksand': 'Quicksand, sans-serif',
      'jetbrains-mono': 'JetBrains Mono, monospace',
      'pixel-sans': 'VT323, monospace'
    };
    
    document.documentElement.style.fontFamily = fontMap[font];
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
