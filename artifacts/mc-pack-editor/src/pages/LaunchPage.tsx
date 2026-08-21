import { Link } from "wouter";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Progress } from "../components/ui/progress";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";

// Animated video placeholder components
function VideoPlaceholder({ type }: { type: 'editor' | 'pack' | 'library' | 'scratch' | 'analyzer' | 'preview' }) {
  const colors = {
    editor: ['#3b82f6', '#8b5cf6', '#a855f7'],
    pack: ['#10b981', '#14b8a6', '#06b6d4'],
    library: ['#f59e0b', '#f97316', '#ef4444'],
    scratch: ['#fbbf24', '#f59e0b', '#f97316'],
    analyzer: ['#8b5cf6', '#a855f7', '#ec4899'],
    preview: ['#ec4899', '#f43f5e', '#ef4444']
  };

  const videoFiles = {
    editor: '/videos/texture-editor.mp4',
    pack: '/videos/pack-management.mp4',
    library: '/videos/local-library.mp4',
    scratch: '/videos/create-scratch.mp4',
    analyzer: '/videos/pack-analyzer.mp4',
    preview: '/videos/3d-preview.mp4'
  };

  const videoFiles2 = {
    editor: '/videos/texture-editor2.mp4',
    pack: '/videos/pack-management2.mp4',
    library: '/videos/local-library2.mp4',
    scratch: '/videos/create-scratch2.mp4',
    analyzer: '/videos/pack-analyzer.mp4',
    preview: '/videos/3d-preview.mp4'
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideo, setCurrentVideo] = useState<0 | 1>(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 2;
      console.log('Video ref updated, playing video:', getCurrentVideoSrc());
      videoRef.current.play().catch((error) => {
        console.log('Auto-play failed:', error);
      });
    }
  }, [currentVideo, type]);

  const handleVideoEnd = () => {
    console.log('Video ended, type:', type, 'currentVideo:', currentVideo);
    if (type === 'scratch') {
      if (currentVideo === 0) {
        console.log('Switching to video 2');
        setCurrentVideo(1);
      } else {
        console.log('Switching back to video 1');
        setCurrentVideo(0);
      }
    } else {
      // For other videos, just loop from beginning
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    }
  };

  const getCurrentVideoSrc = () => {
    if (type === 'scratch' && currentVideo === 1 && videoFiles2.scratch) {
      return videoFiles2.scratch;
    }
    return videoFiles[type];
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <video
        key={`${type}-${currentVideo}`}
        ref={videoRef}
        autoPlay
        muted
        loop={type !== 'scratch'}
        playsInline
        onEnded={handleVideoEnd}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.8 }}
        onError={(e) => {
          console.log('Video failed to load:', e);
          e.currentTarget.style.display = 'none';
        }}
      >
        <source src={getCurrentVideoSrc()} type="video/mp4" />
      </video>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ title, description, icon, color, delay, onClick, isActive, index }: { title: string; description: string; icon: string; color: string; delay: number; onClick?: () => void; isActive?: boolean; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.02, y: -3 }}
      animate={{ scale: [1, 1.03, 1] }}
      transition={{
        duration: 0.6,
        delay,
        scale: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index ? index * 0.3 : 0
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Feature card clicked:', title);
        if (onClick) onClick();
      }}
      className="cursor-pointer relative z-10"
    >
      <Card className="h-full border-2 transition-all duration-300 shadow-lg hover:shadow-2xl hover:border-[#C2B280]">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-lg border-2 bg-black dark:bg-white border-[#C2B280]">
              <svg className="w-6 h-6 text-[#C2B280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2 text-black dark:text-white">{title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Animated Stat Component
function AnimatedStat({ value, label, delay }: { value: string; label: string; delay: number }) {
  const renderValue = () => {
    if (value === '∞') {
      return (
        <svg className="w-20 h-10 text-[#C2B280]" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M25 25 C 25 10, 40 10, 50 25 C 60 40, 75 40, 75 25 C 75 10, 60 10, 50 25 C 40 40, 25 40, 25 25" />
        </svg>
      );
    }
    let textSize = 'text-5xl';
    if (value.length > 3) {
      textSize = 'text-3xl';
    }
    if (value.length > 8) {
      textSize = 'text-2xl';
    }
    return <span className={textSize}>{value}</span>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: delay + 0.2, type: "spring" }}
        className="font-bold text-[#C2B280] mb-2 flex items-center justify-center"
      >
        {renderValue()}
      </motion.div>
      <div className="text-gray-600 dark:text-gray-400">{label}</div>
    </motion.div>
  );
}

// FAQ Item Component
function FAQItem({ question, answer, isOpen, onClick, delay }: { question: string; answer: string; isOpen: boolean; onClick: () => void; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden relative z-10"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('FAQ clicked:', question);
          onClick();
        }}
        className="w-full px-6 py-4 flex items-center justify-between text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer pointer-events-auto relative z-20"
      >
        <span className="font-semibold text-lg text-black dark:text-white pr-4">{question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 border-[#C2B280] rounded-lg"
        >
          <svg className="w-4 h-4 text-[#C2B280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 relative z-20">
          {answer}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LaunchPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    { title: 'Texture Editor', description: 'Edit textures with pixel-perfect precision and brush tools', icon: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586 M11 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0' },
    { title: 'Pack Management', description: 'Merge multiple packs, organize by folders, and export with custom metadata', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01 20.73 6.96 M12 22.08 12 12' },
    { title: 'Local Library', description: 'Save your exported packs locally and reload them anytime', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
    { title: 'Create from Scratch', description: 'Start with default textures and overlay toggle for any pack', icon: 'M12 5v14M5 12h14' },
    { title: 'Pack Analyzer', description: 'Analyze resource packs with detailed insights into textures, formats, and structure', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { title: '3D Preview', description: 'See your textures in 3D with interactive preview mode', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  ];

  const handleSetActiveFeature = (index: number) => {
    console.log('Setting active feature to:', index);
    setActiveFeature(index);
    // Scroll to demo section
    const demoSection = document.getElementById('demo-section');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const faqs = [
    { id: 'item-1', question: 'Is TextureLab free to use?', answer: 'Yes! TextureLab is completely free to use. You can create, edit, and export as many resource packs as you want without any cost.' },
    { id: 'item-2', question: 'What Minecraft versions are supported?', answer: 'TextureLab supports multiple Minecraft versions, with particular focus on 1.8.8 and later versions. We\'re constantly adding support for newer versions.' },
    { id: 'item-3', question: 'Can I use my existing resource packs?', answer: 'Absolutely! You can import existing resource packs, edit them, and export the modified versions. TextureLab works with standard .zip and .mcpack files.' },
    { id: 'item-4', question: 'Is my data stored locally?', answer: 'Yes, all your resource packs and edits are stored locally in your browser using IndexedDB. Your data never leaves your device unless you choose to export it.' },
    { id: 'item-5', question: 'What does the Pack Analyzer do?', answer: 'The Pack Analyzer provides detailed insights into your resource packs, including texture counts, format information, folder structure analysis, and compatibility checks for different Minecraft versions.' },
    { id: 'item-6', question: 'Can I collaborate with others on resource packs?', answer: 'Currently, TextureLab is designed for individual use. You can export your packs and share them with others, but real-time collaboration features are planned for future updates.' },
    { id: 'item-7', question: 'What file formats can I export to?', answer: 'TextureLab exports to standard .zip resource pack files that are compatible with Minecraft. You can also export to .mcpack format for easier sharing on some platforms.' },
    { id: 'item-8', question: 'Does TextureLab support keyboard shortcuts?', answer: 'Yes! TextureLab supports common keyboard shortcuts like Ctrl/Cmd+Z for undo and Ctrl/Cmd+Shift+Z for redo when editing textures.' },
  ];

  const handleFAQToggle = (id: string) => {
    console.log('FAQ toggle:', id, 'current open:', openFAQ);
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex flex-col relative overflow-hidden">
      {/* Geometric Background Pattern */}
      <div className="absolute inset-0 pointer-events-none z-0">
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
        <motion.div 
          className="absolute top-20 left-10 w-64 h-64 border-2 border-[#C2B280]/20 dark:border-[#C2B280]/30 rounded-full pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-40 right-20 w-96 h-96 border-2 border-[#C2B280]/15 dark:border-[#C2B280]/25 rounded-full pointer-events-none"
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        {/* Two squares in top area - lower than circles, spaced out */}
        <motion.div 
          className="absolute top-40 left-1/4 w-36 h-36 border-2 border-[#C2B280]/18 dark:border-[#C2B280]/40 rotate-45 z-0 pointer-events-none"
          animate={{ rotate: 45 + 360, y: [0, -20, 0] }}
          transition={{ rotate: { duration: 30, repeat: Infinity, ease: "linear" }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
        />
        <motion.div 
          className="absolute top-56 right-1/3 w-32 h-32 border-2 border-gray-300/30 dark:border-[#C2B280]/50 rotate-60 z-0 pointer-events-none"
          animate={{ rotate: 60 - 360, y: [0, 15, 0] }}
          transition={{ rotate: { duration: 35, repeat: Infinity, ease: "linear" }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
        />
        <motion.div 
          className="absolute bottom-40 left-1/4 w-48 h-48 border-2 border-gray-300/40 dark:border-[#C2B280]/40 rotate-45 z-0 pointer-events-none"
          animate={{ rotate: 45 + 360, x: [0, 10, 0] }}
          transition={{ rotate: { duration: 28, repeat: Infinity, ease: "linear" }, x: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
        />
        <motion.div 
          className="absolute bottom-20 right-1/3 w-32 h-32 border-2 border-[#C2B280]/40 dark:border-[#C2B280]/60 rotate-12 z-0 pointer-events-none"
          animate={{ rotate: 12 - 360, x: [0, -15, 0] }}
          transition={{ rotate: { duration: 32, repeat: Infinity, ease: "linear" }, x: { duration: 7, repeat: Infinity, ease: "easeInOut" } }}
        />
        {/* Small triangles */}
        <motion.div 
          className="absolute top-1/3 right-1/4 w-0 h-0 border-l-[20px] border-r-[20px] border-b-[35px] border-l-transparent border-r-transparent border-b-[#C2B280]/40 dark:border-[#C2B280]/60 z-0 pointer-events-none"
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ rotate: { duration: 40, repeat: Infinity, ease: "linear" }, scale: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
        />
        <motion.div 
          className="absolute bottom-1/3 left-1/5 w-0 h-0 border-l-[15px] border-r-[15px] border-b-[26px] border-l-transparent border-r-transparent border-b-gray-300/40 dark:border-[#C2B280]/50 z-0 pointer-events-none"
          animate={{ rotate: -360, scale: [1, 0.9, 1] }}
          transition={{ rotate: { duration: 45, repeat: Infinity, ease: "linear" }, scale: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[21px] border-l-transparent border-r-transparent border-b-[#C2B280]/30 dark:border-[#C2B280]/50 z-0 pointer-events-none"
          animate={{ rotate: 360, y: [0, -10, 0] }}
          transition={{ rotate: { duration: 50, repeat: Infinity, ease: "linear" }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
        />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 pointer-events-auto">
      {/* Hero Section */}
      <div className="relative h-screen flex items-center justify-center px-4 py-24 pointer-events-auto">
        <div className="max-w-5xl w-full text-center relative z-20">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-6 mb-16">
              <motion.div 
                className="w-24 h-24 bg-black dark:bg-dark-text rounded-2xl flex items-center justify-center shadow-2xl"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <span className="text-white dark:text-dark-bg text-4xl font-bold">MC</span>
              </motion.div>
              <h1 className="text-7xl font-bold text-black dark:text-dark-text tracking-tight">TextureLab</h1>
            </div>
            <motion.h2 
              className="text-5xl text-gray-600 dark:text-dark-text-secondary mt-8 mb-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -20 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              <span className="border-b-4 border-[#C2B280] pb-2">The</span> ultimate Minecraft <span className="text-[#C2B280] font-bold text-5xl">Texture Editor</span>
            </motion.h2>
            <motion.p 
              className="text-gray-600 dark:text-dark-text-secondary text-lg mt-6 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: isVisible ? 1 : 0 }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              Create, edit, and customize Minecraft resource packs — all in your browser.
            </motion.p>
          </motion.div>

          {/* Get Started Button */}
          <motion.div 
            className="text-center mt-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/editor"
                className="inline-block px-20 py-6 rounded-full font-semibold text-2xl shadow-2xl hover:shadow-3xl text-white dark:text-black"
                style={{
                  background: isHovering
                    ? (isDarkMode
                      ? 'radial-gradient(circle at ' + mousePosition.x + '% ' + mousePosition.y + '%, #ffffff 0%, #aaaaaa 25%, #ffffff 60%)'
                      : 'radial-gradient(circle at ' + mousePosition.x + '% ' + mousePosition.y + '%, #aaaaaa 0%, #000000 25%, #000000 60%)')
                    : (isDarkMode ? '#ffffff' : '#000000'),
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setMousePosition({ x, y });
                }}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => {
                  setIsHovering(false);
                  setMousePosition({ x: 50, y: 50 });
                }}
              >
                Get Started
              </Link>
            </motion.div>
          </motion.div>

          {/* Scroll Arrow */}
          <motion.div 
            className={`text-center mt-16 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <button
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              className="animate-bounce inline-block cursor-pointer hover:scale-110 transition-transform"
            >
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Features Section with Cards */}
      <div className="py-24 px-4 md:px-8 bg-white dark:bg-dark-bg relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-bold text-black dark:text-dark-text mb-4">
              Powerful <span className="text-[#C2B280]">Features</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Everything you need to create amazing Minecraft resource packs
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                color=""
                delay={0.1 * (index + 1)}
                onClick={() => handleSetActiveFeature(index)}
                isActive={activeFeature === index}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20 px-4 bg-gradient-to-r from-[#C2B280]/10 to-[#C2B280]/20 dark:from-[#C2B280]/20 dark:to-[#C2B280]/30 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
            <AnimatedStat value="100%" label="In Your Browser" delay={0.1} />
            <AnimatedStat value="#1st Ever" label="Atlas Region Editing" delay={0.2} />
            <AnimatedStat value="∞" label="Customizations" delay={0.3} />
            <AnimatedStat value="$0" label="Forever Free" delay={0.4} />
          </div>
        </div>
      </div>

      {/* Interactive Demo Section */}
      <div id="demo-section" className="py-24 px-4 bg-white dark:bg-dark-bg relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-bold text-black dark:text-dark-text mb-4">
              See It In <span className="text-[#C2B280]">Action</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Experience the power of TextureLab with our interactive demos
            </p>
          </motion.div>

          {/* Navigation Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-8 relative z-10">
            {features.map((feature, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Button clicked:', index, feature.title);
                  handleSetActiveFeature(index);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 cursor-pointer pointer-events-auto ${
                  activeFeature === index
                    ? 'bg-[#C2B280] text-black shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {feature.title}
              </button>
            ))}
          </div>

          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative pointer-events-none"
          >
            <VideoPlaceholder type={['editor', 'pack', 'library', 'scratch', 'analyzer', 'preview'][activeFeature] as any} />
          </motion.div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-24 px-4 bg-gray-50 dark:bg-gray-900 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-bold text-black dark:text-dark-text mb-4">
              Frequently Asked <span className="text-[#C2B280]">Questions</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Everything you need to know about TextureLab
            </p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <FAQItem
                key={faq.id}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === faq.id}
                onClick={() => handleFAQToggle(faq.id)}
                delay={0.1 * (index + 1)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 px-4 bg-gradient-to-r from-[#C2B280] to-[#C2B280]/80 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-5xl font-bold text-black mb-6">
              Get started to join in the modern pack editing experience
            </h2>
            <Link
              href="/editor"
              className="inline-block px-12 py-4 bg-black text-white rounded-full font-semibold text-xl hover:bg-gray-800 transition-all duration-300 shadow-2xl hover:scale-105 cursor-pointer pointer-events-auto"
              onClick={(e) => {
                console.log('Get Started clicked');
              }}
            >
              Get Started Now
            </Link>
          </motion.div>
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
    </div>
  );
}
