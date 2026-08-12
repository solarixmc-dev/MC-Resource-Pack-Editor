import { Link } from "wouter";
import { useEffect, useState, useRef } from "react";

// Animated video placeholder components
function VideoPlaceholder({ type }: { type: 'editor' | 'pack' | 'library' | 'atlas' | 'preview' }) {
  const colors = {
    editor: ['#3b82f6', '#8b5cf6', '#a855f7'],
    pack: ['#10b981', '#14b8a6', '#06b6d4'],
    library: ['#f59e0b', '#f97316', '#ef4444'],
    atlas: ['#ec4899', '#f43f5e', '#fb7185'],
    preview: ['#14b8a6', '#06b6d4', '#0891b2']
  };

  const videoFiles = {
    editor: '/videos/texture-editor.mp4',
    pack: '/videos/pack-management.mp4',
    library: '/videos/local-library.mp4',
    atlas: '/videos/texture-atlas.mp4',
    preview: '/videos/texture-preview.mp4'
  };

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 2;
    }
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <video
        ref={videoRef}
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
        animation: 'gradientRotate 7.5s ease infinite',
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
        setVisibleSections(prev => {
          const newSet = new Set(prev);
          if (entry.isIntersecting) {
            newSet.add(index);
          } else {
            newSet.delete(index);
          }
          return newSet;
        });
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
        {/* Top area shapes */}
        <div className="absolute top-10 left-10 w-48 h-48 border-2 border-[#C2B280]/20 rounded-full animate-spin-slow"></div>
        <div className="absolute top-20 right-16 w-72 h-72 border-2 border-[#C2B280]/15 rounded-full animate-spin-slow-reverse"></div>
        <div className="absolute top-1/4 left-1/4 w-36 h-36 border-2 border-gray-300/30 dark:border-gray-600/30 rotate-45 animate-spin-slow"></div>
        <div className="absolute top-1/3 right-1/3 w-24 h-24 border-2 border-[#C2B280]/18 rotate-12 animate-spin-slow-reverse"></div>
        <div className="absolute top-1/2 left-1/6 w-40 h-40 border-2 border-[#C2B280]/12 rounded-lg rotate-6 animate-spin-slow"></div>
        {/* Squares in top area */}
        <div className="absolute top-1/5 left-1/3 w-32 h-32 border-2 border-[#C2B280]/15 rotate-12 animate-spin-slow"></div>
        <div className="absolute top-1/4 right-1/5 w-28 h-28 border-2 border-gray-300/25 dark:border-gray-600/25 rotate-45 animate-spin-slow-reverse"></div>
        <div className="absolute top-1/6 left-1/4 w-24 h-24 border-2 border-[#C2B280]/12 rotate-30 animate-spin-slow"></div>
        {/* Pentagons in top area */}
        <div className="absolute top-1/4 left-1/2 w-32 h-32 border-2 border-[#C2B280]/15 animate-spin-slow" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
        <div className="absolute top-1/3 right-1/6 w-28 h-28 border-2 border-gray-300/25 dark:border-gray-600/25 animate-spin-slow-reverse" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
        <div className="absolute top-1/6 right-1/4 w-24 h-24 border-2 border-[#C2B280]/12 animate-spin-slow" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
        {/* Small triangles in top area */}
        <div className="absolute top-1/4 right-1/5 w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-[#C2B280]/12 animate-spin-slow"></div>
        <div className="absolute top-1/3 left-1/6 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-gray-300/25 dark:border-gray-600/25 animate-spin-slow-reverse"></div>
        {/* Bottom area shapes */}
        <div className="absolute bottom-32 left-1/4 w-48 h-48 border-2 border-gray-300/40 dark:border-gray-600/40 rotate-45 animate-spin-slow"></div>
        <div className="absolute bottom-24 right-1/3 w-32 h-32 border-2 border-[#C2B280]/20 rotate-12 animate-spin-slow-reverse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-40 h-40 border-2 border-[#C2B280]/15 rounded-full animate-spin-slow"></div>
        <div className="absolute bottom-1/4 left-1/6 w-28 h-28 border-2 border-gray-300/35 dark:border-gray-600/35 rotate-30 animate-spin-slow-reverse"></div>
        {/* Squares in bottom area */}
        <div className="absolute bottom-1/4 left-1/3 w-36 h-36 border-2 border-[#C2B280]/18 rotate-45 animate-spin-slow-reverse"></div>
        <div className="absolute bottom-1/5 right-1/4 w-32 h-32 border-2 border-gray-300/30 dark:border-gray-600/30 rotate-12 animate-spin-slow"></div>
        {/* Pentagons in bottom area */}
        <div className="absolute bottom-1/3 left-1/3 w-36 h-36 border-2 border-[#C2B280]/18 animate-spin-slow-reverse" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
        <div className="absolute bottom-1/4 right-1/6 w-32 h-32 border-2 border-gray-300/30 dark:border-gray-600/30 animate-spin-slow" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
        {/* Small triangles in bottom area */}
        <div className="absolute bottom-1/3 left-1/5 w-0 h-0 border-l-[15px] border-r-[15px] border-b-[26px] border-l-transparent border-r-transparent border-b-gray-300/30 dark:border-gray-600/30 animate-spin-slow-reverse"></div>
        <div className="absolute bottom-1/4 right-1/5 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[21px] border-l-transparent border-r-transparent border-b-[#C2B280]/10 animate-spin-slow"></div>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10">
      {/* Hero Section */}
      <div className="relative h-screen flex items-center justify-center px-4 py-24">
        <div className="max-w-5xl w-full text-center">
          {/* Logo */}
          <div className={`transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-6 mb-16">
              <div className="w-24 h-24 bg-black dark:bg-dark-text rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="text-white dark:text-dark-bg text-4xl font-bold">MC</span>
              </div>
              <h1 className="text-7xl font-bold text-black dark:text-dark-text tracking-tight">TextureLab</h1>
            </div>
            <h2 className="text-5xl text-gray-600 dark:text-dark-text-secondary mt-8 mb-4">
              <span className="border-b-4 border-[#C2B280] pb-2">The</span> ultimate Minecraft <span className="text-[#C2B280] font-bold text-5xl">Texture Editor</span>
            </h2>
            <p className="text-gray-600 dark:text-dark-text-secondary text-lg mt-6 leading-relaxed">
              Create, edit, and customize Minecraft resource packs — all in your browser.
            </p>
          </div>

          {/* Get Started Button */}
          <div className={`text-center mt-12 transition-all duration-1000 ease-out delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <Link
              href="/editor"
              className="inline-block bg-black dark:bg-white text-white dark:text-black px-20 py-6 rounded-full font-semibold text-2xl hover:bg-gray-800 dark:hover:bg-gray-200 hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-3xl"
            >
              Get Started
            </Link>
          </div>

          {/* Scroll Arrow */}
          <div className={`text-center mt-8 transition-all duration-1000 ease-out delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <button
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              className="animate-bounce inline-block cursor-pointer hover:scale-110 transition-transform"
            >
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Features Full-Screen Sections */}
      {[
        { type: 'editor' as const, title: 'Texture Editor', description: 'Edit textures with pixel-perfect precision and brush tools', icon: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586 M11 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0' },
        { type: 'pack' as const, title: 'Pack Management', description: 'Merge multiple packs, organize by folders, and export with custom metadata', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01 20.73 6.96 M12 22.08 12 12' },
        { type: 'library' as const, title: 'Local Library', description: 'Save your exported packs locally and reload them anytime', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
        { type: 'atlas' as const, title: 'Texture Atlas Support', description: 'Work with texture atlases and atlas regions for optimized textures', icon: 'M3 3h18v18H3V3z M3 9h18 M9 21V9' },
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
