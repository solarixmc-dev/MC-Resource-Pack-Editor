import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Link } from "wouter";

export default function ProfileDropdown() {
  const { user, logout, updateUser } = useAuth();
  const { theme, setTheme, font, setFont } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [tempUsername, setTempUsername] = useState(user?.username || '');
  const [tempEmail, setTempEmail] = useState(user?.email || '');
  const [tempPassword, setTempPassword] = useState('');

  const handleSaveSettings = () => {
    if (user) {
      updateUser({
        username: tempUsername,
        email: tempEmail
      });
    }
    setShowSettings(false);
  };

  const fonts = [
    { value: 'arial', label: 'Arial' },
    { value: 'montserrat', label: 'Montserrat' },
    { value: 'quicksand', label: 'Quicksand' },
    { value: 'jetbrains-mono', label: 'JetBrains Mono' },
    { value: 'pixel-sans', label: 'Pixel Sans (VT323)' }
  ] as const;

  if (showSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-black mb-4">Account Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">Username</label>
              <input
                type="text"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#C2B280] text-black"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">Email</label>
              <input
                type="email"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#C2B280] text-black"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">New Password</label>
              <input
                type="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#C2B280] text-black"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-black hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-lg font-medium bg-black text-white hover:bg-gray-800 transition-colors"
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
        className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors text-sm"
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <span className="text-sm font-bold">{user?.username?.[0]?.toUpperCase() || 'U'}</span>
        </div>
        <span>{user?.username || 'User'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* Theme Toggle with Dropdown */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Theme</p>
              <button
                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                {theme === 'light' && '☀️ Light'}
                {theme === 'dark' && '🌙 Dark'}
                {theme === 'system' && '💻 System'}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            
            {showThemeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => { setTheme('light'); setShowThemeDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  ☀️ Light
                </button>
                <button
                  onClick={() => { setTheme('dark'); setShowThemeDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  🌙 Dark
                </button>
                <button
                  onClick={() => { setTheme('system'); setShowThemeDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  💻 System
                </button>
              </div>
            )}
          </div>

          {/* Font Selector */}
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Font</p>
            <select
              value={font}
              onChange={(e) => setFont(e.target.value as any)}
              className="w-full px-3 py-1.5 border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#C2B280] text-sm text-black"
            >
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Account Settings */}
          <button
            onClick={() => {
              setShowSettings(true);
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Account Settings
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
