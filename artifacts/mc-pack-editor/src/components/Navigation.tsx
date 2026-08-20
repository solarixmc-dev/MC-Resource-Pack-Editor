import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

export default function Navigation() {
  const [location] = useLocation();
  const { theme, setTheme, font, setFont } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/editor", label: "Texture Editor" },
    { path: "/library", label: "Pack Library" },
    { path: "/contact", label: "Contact" },
  ];

  return (
    <nav className="bg-white dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border pl-0 pr-0">
      <div className="w-full px-0">
        <div className="flex items-center justify-between h-16 relative">
          {/* Logo - absolutely positioned to left edge */}
          <Link href="/" className="absolute left-6 flex items-center gap-2">
            <div className="w-10 h-10 bg-black dark:bg-dark-text rounded-lg flex items-center justify-center">
              <span className="text-white dark:text-dark-bg text-lg font-bold">MC</span>
            </div>
            <span className="text-xl font-bold text-black dark:text-dark-text">TextureLab</span>
          </Link>

          {/* Navigation Links - centered */}
          <div className="flex items-center gap-8 mx-auto">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="group relative py-2 text-base font-medium transition-colors text-gray-600 dark:text-dark-text-secondary hover:text-black dark:hover:text-dark-text"
                >
                  {item.label}
                  {/* Underline animation */}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-[#C2B280] transition-all duration-300 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              );
            })}
          </div>

          {/* Settings Button - absolutely positioned to right edge */}
          <div className="absolute right-6 flex-shrink-0 relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-10 h-10 bg-black dark:bg-dark-text rounded-lg flex items-center justify-center hover:bg-gray-800 dark:hover:bg-dark-tertiary transition-colors"
              title="Settings"
            >
              <svg 
                className="w-5 h-5 text-white dark:text-dark-bg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth={2} 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-4 z-[70]">
                <h3 className="text-sm font-semibold text-black dark:text-dark-text px-4 mb-3">Settings</h3>
                
                {/* Theme */}
                <div className="px-4 mb-4">
                  <label className="block text-xs font-medium text-gray-500 dark:text-dark-text-tertiary mb-2">Theme</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'light' ? 'bg-black dark:bg-dark-text text-white dark:text-dark-bg' : 'bg-gray-100 dark:bg-dark-tertiary text-black dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border'}`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-black dark:bg-dark-text text-white dark:text-dark-bg' : 'bg-gray-100 dark:bg-dark-tertiary text-black dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border'}`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'system' ? 'bg-black dark:bg-dark-text text-white dark:text-dark-bg' : 'bg-gray-100 dark:bg-dark-tertiary text-black dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border'}`}
                    >
                      System
                    </button>
                  </div>
                </div>
                
                {/* Font */}
                <div className="px-4">
                  <label className="block text-xs font-medium text-gray-500 dark:text-dark-text-tertiary mb-2">Font</label>
                  <select
                    value={font}
                    onChange={(e) => setFont(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-dark-border rounded-md focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary text-xs"
                  >
                    <option value="arial">Arial</option>
                    <option value="montserrat">Montserrat</option>
                    <option value="quicksand">Quicksand</option>
                    <option value="inter">Inter</option>
                    <option value="comfortaa">Comfortaa</option>
                    <option value="jetbrains-mono">JetBrains Mono</option>
                    <option value="pixel-sans">Pixel Sans</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
