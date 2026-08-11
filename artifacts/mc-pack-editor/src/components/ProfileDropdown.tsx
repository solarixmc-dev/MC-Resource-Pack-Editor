import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Link } from "wouter";

export default function ProfileDropdown() {
  const { user, logout, updateUser } = useAuth();
  const { theme, setTheme, font, setFont } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [displayUsername, setDisplayUsername] = useState('');

  // Load current user data from localStorage on mount and when it changes
  useEffect(() => {
    const savedUsername = localStorage.getItem('username') || user?.username || '';
    const savedEmail = localStorage.getItem('email') || user?.email || '';
    setTempUsername(savedUsername);
    setTempEmail(savedEmail);
    setDisplayUsername(savedUsername);
  }, [user]);

  const handleSaveSettings = () => {
    if (user) {
      const updatedUser = {
        ...user,
        username: tempUsername,
        email: tempEmail
      };
      updateUser(updatedUser);
      
      // Also save directly to localStorage to ensure persistence
      localStorage.setItem('username', tempUsername);
      localStorage.setItem('email', tempEmail);
      
      // Update display username
      setDisplayUsername(tempUsername);
    }
    setShowSettings(false);
  };

  if (showSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
        <div className="bg-white dark:bg-dark-secondary rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-black dark:text-dark-text mb-4">Account Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">Username</label>
              <input
                type="text"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">Email</label>
              <input
                type="email"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">New Password</label>
              <input
                type="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 rounded-lg font-medium bg-gray-100 dark:bg-dark-tertiary text-black dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-lg font-medium bg-black dark:bg-dark-text text-white dark:text-dark-bg hover:bg-gray-800 dark:hover:bg-dark-tertiary transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-black dark:bg-dark-text rounded-full flex items-center justify-center hover:bg-gray-800 dark:hover:bg-dark-tertiary transition-colors"
      >
        <span className="text-sm font-bold text-white dark:text-dark-bg">{displayUsername?.[0]?.toUpperCase() || 'U'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-2 z-50" style={{ top: '100%' }}>
          {/* Theme Toggle with Dropdown */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-dark-text-tertiary">Theme</p>
              <button
                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                className="flex items-center gap-1 bg-gray-100 dark:bg-dark-tertiary px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-200 dark:hover:bg-dark-border transition-colors text-gray-700 dark:text-dark-text-secondary"
              >
                {theme === 'light' && 'Light'}
                {theme === 'dark' && 'Dark'}
                {theme === 'system' && 'System'}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            
            {showThemeDropdown && (
              <div className="absolute top-0 right-full mr-1 w-32 bg-white dark:bg-dark-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 z-50">
                <button
                  onClick={() => { setTheme('light'); setShowThemeDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Light
                </button>
                <button
                  onClick={() => { setTheme('dark'); setShowThemeDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Dark
                </button>
                <button
                  onClick={() => { setTheme('system'); setShowThemeDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  System
                </button>
              </div>
            )}
          </div>

          {/* Font Toggle with Dropdown */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-dark-text-tertiary">Font</p>
              <button
                onClick={() => setShowFontDropdown(!showFontDropdown)}
                className="flex items-center gap-1 bg-gray-100 dark:bg-dark-tertiary px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-200 dark:hover:bg-dark-border transition-colors text-gray-700 dark:text-dark-text-secondary"
              >
                {font === 'arial' && 'Arial'}
                {font === 'montserrat' && 'Montserrat'}
                {font === 'quicksand' && 'Quicksand'}
                {font === 'inter' && 'Inter'}
                {font === 'comfortaa' && 'Comfortaa'}
                {font === 'jetbrains-mono' && 'JetBrains Mono'}
                {font === 'pixel-sans' && 'Pixel Sans'}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            
            {showFontDropdown && (
              <div className="absolute top-0 right-full mr-1 w-40 bg-white dark:bg-dark-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 z-50 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setFont('arial'); setShowFontDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Arial
                </button>
                <button
                  onClick={() => { setFont('montserrat'); setShowFontDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Montserrat
                </button>
                <button
                  onClick={() => { setFont('quicksand'); setShowFontDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Quicksand
                </button>
                <button
                  onClick={() => { setFont('inter'); setShowFontDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Inter
                </button>
                <button
                  onClick={() => { setFont('comfortaa'); setShowFontDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Comfortaa
                </button>
                <button
                  onClick={() => { setFont('jetbrains-mono'); setShowFontDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  JetBrains Mono
                </button>
                <button
                  onClick={() => { setFont('pixel-sans'); setShowFontDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  Pixel Sans
                </button>
              </div>
            )}
          </div>

          {/* Account Settings */}
          <button
            onClick={() => {
              // Load current values before opening settings
              const savedUsername = localStorage.getItem('username') || user?.username || '';
              const savedEmail = localStorage.getItem('email') || user?.email || '';
              setTempUsername(savedUsername);
              setTempEmail(savedEmail);
              setShowSettings(true);
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
          >
            Account Settings
          </button>

          {/* Logout */}
          <button
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}