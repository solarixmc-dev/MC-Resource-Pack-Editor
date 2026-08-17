import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function PortfolioPage() {
  const { theme } = useTheme();
  const darkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (titleRef.current) {
        const rect = titleRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setMousePosition({ x, y });
      }
    };

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => {
      setIsHovering(false);
      setMousePosition({ x: 50, y: 50 });
    };

    const titleElement = titleRef.current;
    if (titleElement) {
      titleElement.addEventListener('mousemove', handleMouseMove);
      titleElement.addEventListener('mouseenter', handleMouseEnter);
      titleElement.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (titleElement) {
        titleElement.removeEventListener('mousemove', handleMouseMove);
        titleElement.removeEventListener('mouseenter', handleMouseEnter);
        titleElement.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  const getGradientStyle = () => {
    if (!isHovering) {
      return {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: 'none'
      };
    }
    
    const x = mousePosition.x;
    const y = mousePosition.y;
    
    return {
      background: `radial-gradient(circle at ${x}% ${y}%, #f093fb 0%, #f5576c 25%, #4facfe 50%, #00f2fe 75%, #43e97b 100%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: isHovering ? '0 0 80px rgba(240, 147, 251, 0.5), 0 0 120px rgba(245, 87, 108, 0.3)' : 'none',
      filter: isHovering ? 'brightness(1.2)' : 'brightness(1)'
    };
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-dark-bg' : 'bg-white'} overflow-hidden`}>
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-blue-900/30" />
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-gradient-to-r from-purple-500/30 to-pink-500/30 dark:from-purple-700/40 dark:to-pink-700/40 blur-3xl animate-float"
                style={{
                  width: `${200 + i * 50}px`,
                  height: `${200 + i * 50}px`,
                  left: `${20 + i * 15}%`,
                  top: `${10 + i * 12}%`,
                  animationDelay: `${i * 0.5}s`
                }}
              />
            ))}
          </div>
        </div>

        {/* Solarix Title */}
        <div className="relative z-10 text-center">
          <div
            ref={titleRef}
            className="relative inline-block cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <h1
              className="text-9xl md:text-[12rem] font-black tracking-tight transition-all duration-300"
              style={getGradientStyle()}
            >
              Solarix
            </h1>
            {/* Glow effect on hover */}
            {isHovering && (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/50 to-pink-500/50 blur-3xl -z-10 rounded-full animate-pulse" />
            )}
          </div>
          
          <p className={`mt-8 text-2xl font-medium ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'} transition-all duration-300 ${isHovering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Minecraft Content Creator
          </p>
          
          <div className={`mt-12 flex gap-4 justify-center transition-all duration-300 ${isHovering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <button className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-semibold hover:scale-105 transition-all duration-300 shadow-lg">
              View My Work
            </button>
            <button className="px-8 py-3 border-2 border-black dark:border-white text-black dark:text-white rounded-full font-semibold hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-300">
              Contact
            </button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg className="w-8 h-8 text-purple-500 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Skin Viewer Section */}
      <div className={`py-20 px-8 ${darkMode ? 'bg-dark-secondary' : 'bg-gray-50'}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-4xl font-bold text-center mb-4 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>
            My Minecraft Skin
          </h2>
          <p className={`text-center text-lg mb-12 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
            Walking animation preview
          </p>
          
          <div className="flex justify-center">
            <div className="relative w-64 h-96 bg-gradient-to-b from-sky-400 to-sky-600 rounded-2xl shadow-2xl overflow-hidden">
              {/* Skin animation placeholder */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-24 h-32 bg-amber-800 rounded-t-lg animate-walk">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-amber-600 rounded-full"></div>
                <div className="absolute top-20 left-2 w-6 h-12 bg-amber-700 rounded-full animate-arm-left"></div>
                <div className="absolute top-20 right-2 w-6 h-12 bg-amber-700 rounded-full animate-arm-right"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Downloads Section */}
      <div className={`py-20 px-8 ${darkMode ? 'bg-dark-bg' : 'bg-white'}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-4xl font-bold text-center mb-4 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>
            Downloads
          </h2>
          <p className={`text-center text-lg mb-12 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
            Minecraft settings and client configurations
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Download Card 1 */}
            <div className={`p-6 rounded-xl border-2 ${darkMode ? 'bg-dark-secondary border-dark-border hover:border-purple-500' : 'bg-white border-gray-200 hover:border-purple-500'} transition-all duration-300 hover:scale-105 cursor-pointer`}>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l4-4m-4 4h16" />
                </svg>
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Minecraft Settings</h3>
              <p className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'} mb-4`}>
                Opt-in chat, render distance, and performance settings
              </p>
              <button className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
                Download
              </button>
            </div>

            {/* Download Card 2 */}
            <div className={`p-6 rounded-xl border-2 ${darkMode ? 'bg-dark-secondary border-dark-border hover:border-blue-500' : 'bg-white border-gray-200 hover:border-blue-500'} transition-all duration-300 hover:scale-105 cursor-pointer`}>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Client Configs</h3>
              <p className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'} mb-4`}>
                Mod loader configurations and optimization settings
              </p>
              <button className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
                Download
              </button>
            </div>

            {/* Download Card 3 */}
            <div className={`p-6 rounded-xl border-2 ${darkMode ? 'bg-dark-secondary border-dark-border hover:border-green-500' : 'bg-white border-gray-200 hover:border-green-500'} transition-all duration-300 hover:scale-105 cursor-pointer`}>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Shader Presets</h3>
              <p className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'} mb-4`}>
                Custom shader configurations for visual enhancements
              </p>
              <button className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`py-8 border-t ${darkMode ? 'border-dark-border bg-dark-secondary' : 'border-gray-200 bg-gray-50'}`}>
        <div className="max-w-6xl mx-auto text-center">
          <p className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
            © 2026 Solarix. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
