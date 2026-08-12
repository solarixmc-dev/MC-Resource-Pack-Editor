import { Link } from "wouter";
import { useEffect, useState } from "react";

// Animated video placeholder components
function VideoPlaceholder({ type }: { type: 'editor' | 'pack' | 'library' }) {
  const colors = {
    editor: ['#3b82f6', '#8b5cf6', '#a855f7'],
    pack: ['#10b981', '#14b8a6', '#06b6d4'],
    library: ['#f59e0b', '#f97316', '#ef4444']
  };

  const videoFiles = {
    editor: '/videos/texture-editor.mp4',
    pack: '/videos/pack-management.mp4',
    library: '/videos/local-library.mp4'
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <video 
        autoPlay 
        muted 
        loop 
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.8 }}
        onError={(e) => {
          console.log('Video failed to load:', e);
          e.currentTarget.style.display = 'none';
        }}
      >
        <source src={videoFiles[type]} type="video/mp4" />
      </video>
      <div className="absolute inset-0 animate-gradient-xy" style={{
        background: `linear-gradient(45deg, ${colors[type][0]}66, ${colors[type][1]}66, ${colors[type][2]}66, ${colors[type][0]}66)`,
        backgroundSize: '400% 400%',
        animation: 'gradientRotate 15s ease infinite',
        opacity: 0.3
      }}></div>
    </div>
  );
}

export default function LaunchPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const handleScroll = () => {
      setHasScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex flex-col relative">
      {/* Content Overlay */}
      <div className="relative z-10">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-4xl w-full">
          {/* Logo */}
          <div className={`text-center mb-20 transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-4 mb-8">
              <div className="w-20 h-20 bg-black dark:bg-dark-text rounded-lg flex items-center justify-center">
                <span className="text-white dark:text-dark-bg text-3xl font-bold">MC</span>
              </div>
              <h1 className="text-6xl font-bold text-black dark:text-dark-text">TextureLab</h1>
            </div>
            <h2 className="text-4xl text-gray-600 dark:text-dark-text-secondary mt-12">
              <span className="border-b-2 border-[#C2B280] pb-1">The</span> ultimate Minecraft <span className="text-[#C2B280] font-bold text-4xl">Texture Editor</span>
            </h2>
            <p className="text-gray-600 dark:text-dark-text-secondary text-xl mt-12">
              Create, edit, organize, and customize Minecraft resource packs — all in your browser.
            </p>
          </div>

          {/* Get Started Button */}
          <div className={`text-center mb-24 transition-all duration-1000 ease-out delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <Link
              href="/editor"
              className="inline-block bg-black dark:bg-white text-white dark:text-black px-16 py-5 rounded-full font-semibold text-xl hover:bg-gray-800 dark:hover:bg-gray-200 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-4xl mx-auto px-4">
          {hasScrolled && (
            <div className={`flex flex-col gap-8 mb-16 transition-all duration-1000 ease-out delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              {/* Texture Editor Card */}
              <div className="relative bg-gray-50 dark:bg-dark-secondary rounded-xl overflow-hidden border-2 border-gray-200 dark:border-dark-border hover:border-[#C2B280] transition-colors group h-64">
                <VideoPlaceholder type="editor" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>
                <div className="relative z-10 flex items-center p-8 h-full">
                  <div className="w-14 h-14 bg-[#C2B280] rounded-lg flex items-center justify-center mr-6 flex-shrink-0">
                    <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19l7-7 3 3-7 7-3-3z" />
                      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                      <path d="M2 2l7.586 7.586" />
                      <circle cx="11" cy="11" r="2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Texture Editor</h3>
                    <p className="text-gray-200 text-base">
                      Edit textures with pixel-perfect precision, brush tools, and atlas support
                    </p>
                  </div>
                </div>
              </div>

              {/* Pack Management Card */}
              <div className="relative bg-gray-50 dark:bg-dark-secondary rounded-xl overflow-hidden border-2 border-gray-200 dark:border-dark-border hover:border-[#C2B280] transition-colors group h-64">
                <VideoPlaceholder type="pack" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>
                <div className="relative z-10 flex items-center p-8 h-full">
                  <div className="w-14 h-14 bg-[#C2B280] rounded-lg flex items-center justify-center mr-6 flex-shrink-0">
                    <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Pack Management</h3>
                    <p className="text-gray-200 text-base">
                      Merge multiple packs, organize by folders, and export with custom metadata
                    </p>
                  </div>
                </div>
              </div>

              {/* Local Library Card */}
              <div className="relative bg-gray-50 dark:bg-dark-secondary rounded-xl overflow-hidden border-2 border-gray-200 dark:border-dark-border hover:border-[#C2B280] transition-colors group h-64">
                <VideoPlaceholder type="library" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>
                <div className="relative z-10 flex items-center p-8 h-full">
                  <div className="w-14 h-14 bg-[#C2B280] rounded-lg flex items-center justify-center mr-6 flex-shrink-0">
                    <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Local Library</h3>
                    <p className="text-gray-200 text-base">
                      Save your exported packs locally and reload them anytime
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Start Guide */}
          {hasScrolled && (
            <div className={`bg-gray-50 dark:bg-dark-secondary rounded-xl p-10 border-2 border-gray-200 dark:border-dark-border transition-all duration-1000 ease-out delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-3xl font-bold text-black dark:text-dark-text mb-8">Quick Start Guide</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-5">
                <div className="w-10 h-10 bg-[#C2B280] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold text-lg">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-black dark:text-dark-text mb-2 text-lg">Import Resource Pack</h4>
                  <p className="text-gray-600 dark:text-dark-text-secondary text-base">
                    Drag & drop your ZIP file or use the "Create from Scratch" button
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="w-10 h-10 bg-[#C2B280] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold text-lg">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-black dark:text-dark-text mb-2 text-lg">Browse Textures</h4>
                  <p className="text-gray-600 dark:text-dark-text-secondary text-base">
                    Navigate through folders like blocks, items, and environment
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="w-10 h-10 bg-[#C2B280] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold text-lg">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-black dark:text-dark-text mb-2 text-lg">Edit & Customize</h4>
                  <p className="text-gray-600 dark:text-dark-text-secondary text-base">
                    Use the editor to modify textures with brushes and colors
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="w-10 h-10 bg-[#C2B280] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold text-lg">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-black dark:text-dark-text mb-2 text-lg">Export Your Pack</h4>
                  <p className="text-gray-600 dark:text-dark-text-secondary text-base">
                    Save your creation to your local library or download as ZIP
                  </p>
                </div>
              </div>
            </div>
          </div>
          )}
      </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-dark-border py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600 dark:text-dark-text-secondary text-base">
            © 2026 MC TextureLab. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
