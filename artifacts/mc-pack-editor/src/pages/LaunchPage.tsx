import { Link } from "wouter";
import { useEffect, useState } from "react";

// Animated video placeholder components
function VideoPlaceholder({ type }: { type: 'editor' | 'pack' | 'library' | 'atlas' | 'colors' | 'preview' }) {
  const colors = {
    editor: ['#3b82f6', '#8b5cf6', '#a855f7'],
    pack: ['#10b981', '#14b8a6', '#06b6d4'],
    library: ['#f59e0b', '#f97316', '#ef4444'],
    atlas: ['#ec4899', '#f43f5e', '#fb7185'],
    colors: ['#8b5cf6', '#a855f7', '#6366f1'],
    preview: ['#14b8a6', '#06b6d4', '#0891b2']
  };

  const videoFiles = {
    editor: '/videos/texture-editor.mp4',
    pack: '/videos/pack-management.mp4',
    library: '/videos/local-library.mp4',
    atlas: '/videos/texture-atlas.mp4',
    colors: '/videos/color-codes.mp4',
    preview: '/videos/texture-preview.mp4'
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
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    setIsVisible(true);

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.3
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const index = parseInt(entry.target.getAttribute('data-index') || '0');
        if (entry.isIntersecting) {
          setVisibleSections(prev => new Set([...prev, index]));
        }
      });
    }, observerOptions);

    document.querySelectorAll('[data-section]').forEach(section => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex flex-col relative overflow-hidden">
      {/* Geometric Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="w-full h-full opacity-[0.12] dark:opacity-[0.18]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
            <pattern id="diagonal" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="30" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" className="text-gray-400 dark:text-gray-600"/>
          <rect width="100%" height="100%" fill="url(#diagonal)" className="text-gray-300 dark:text-gray-700"/>
        </svg>
        {/* Decorative geometric shapes */}
        <div className="absolute top-20 left-10 w-64 h-64 border-2 border-[#C2B280]/20 rounded-full animate-spin-slow"></div>
        <div className="absolute top-40 right-20 w-96 h-96 border-2 border-[#C2B280]/15 rounded-full animate-spin-slow-reverse"></div>
        <div className="absolute bottom-40 left-1/4 w-48 h-48 border-2 border-gray-300/40 dark:border-gray-600/40 rotate-45 animate-spin-slow"></div>
        <div className="absolute bottom-20 right-1/3 w-32 h-32 border-2 border-[#C2B280]/20 rotate-12 animate-spin-slow-reverse"></div>
        {/* Small triangles */}
        <div className="absolute top-1/3 right-1/4 w-0 h-0 border-l-[20px] border-r-[20px] border-b-[35px] border-l-transparent border-r-transparent border-b-[#C2B280]/15 animate-spin-slow"></div>
        <div className="absolute bottom-1/3 left-1/5 w-0 h-0 border-l-[15px] border-r-[15px] border-b-[26px] border-l-transparent border-r-transparent border-b-gray-300/30 dark:border-gray-600/30 animate-spin-slow-reverse"></div>
        <div className="absolute top-1/2 left-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[21px] border-l-transparent border-r-transparent border-b-[#C2B280]/10 animate-spin-slow"></div>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10">
      {/* Hero Section */}
      <div className="relative h-screen flex items-center justify-center px-4 py-24">
        <div className="max-w-4xl w-full text-center">
          {/* Logo */}
          <div className={`transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
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
          <div className={`text-center mt-16 transition-all duration-1000 ease-out delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <Link
              href="/editor"
              className="inline-block bg-black dark:bg-white text-white dark:text-black px-16 py-5 rounded-full font-semibold text-xl hover:bg-gray-800 dark:hover:bg-gray-200 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>

      {/* Features Full-Screen Sections */}
      {[
        { type: 'editor' as const, title: 'Texture Editor', description: 'Edit textures with pixel-perfect precision and brush tools', icon: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586 M11 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0' },
        { type: 'pack' as const, title: 'Pack Management', description: 'Merge multiple packs, organize by folders, and export with custom metadata', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01 20.73 6.96 M12 22.08 12 12' },
        { type: 'library' as const, title: 'Local Library', description: 'Save your exported packs locally and reload them anytime', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
        { type: 'atlas' as const, title: 'Texture Atlas Support', description: 'Work with texture atlases and atlas regions for optimized textures', icon: 'M3 3h18v18H3V3z M3 9h18 M9 21V9' },
        { type: 'colors' as const, title: 'Color Code Support', description: 'Full Minecraft formatting codes support for colors and text styles', icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z M12 2.69V22 M12 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0' },
        { type: 'preview' as const, title: 'Texture Preview', description: 'Generate preview loadouts with key items to see textures in your pack\'s sky', icon: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M2.5 7c0 1.5.5 3 4.5 9 3 3.5-4.5 4.5-3 3 4.5 9 3 3.5-4.5 4.5-3 3 4.5 9 3' },
      ].map((feature, index) => (
        <div
          key={feature.type}
          data-section
          data-index={index}
          className={`relative h-screen w-full overflow-hidden transition-all duration-1000 ${visibleSections.has(index) ? 'opacity-100' : 'opacity-0'}`}
        >
          <VideoPlaceholder type={feature.type} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>
          <div className="relative z-10 flex items-center h-full px-8 md:px-16">
            <div className="max-w-2xl">
              <div className="w-20 h-20 bg-[#C2B280] rounded-xl flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-10 h-10 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d={feature.icon} />
                </svg>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{feature.title}</h2>
              <p className="text-xl text-gray-200">{feature.description}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-dark-border py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600 dark:text-dark-text-secondary text-base">
            © 2026 MC TextureLab. All rights reserved.
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
}
