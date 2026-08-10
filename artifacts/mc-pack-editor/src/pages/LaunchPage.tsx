import { Link } from "wouter";
import { useAuth } from "../contexts/AuthContext";

export default function LaunchPage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-4xl w-full">
          {/* Logo */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white text-2xl font-bold">MC</span>
              </div>
              <h1 className="text-5xl font-bold text-black">Studio</h1>
            </div>
            <h2 className="text-3xl text-gray-600 mt-6">
              <span className="border-b-2 border-[#C2B280] pb-1">The</span> ultimate lighting-quick editing Minecraft<br />
              <span className="text-[#C2B280] font-bold text-4xl">Texture Editor</span>
            </h2>
          </div>

          {/* Get Started Button */}
          <div className="text-center mb-16">
            <Link
              href={isLoggedIn ? "/editor" : "/auth"}
              className="inline-block bg-black text-white px-12 py-4 rounded-full font-semibold text-lg hover:bg-gray-800 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Get Started
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-sand transition-colors">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">Texture Editor</h3>
              <p className="text-gray-600 text-sm">
                Edit textures with pixel-perfect precision, brush tools, and atlas support
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-sand transition-colors">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">Pack Management</h3>
              <p className="text-gray-600 text-sm">
                Merge multiple packs, organize by folders, and export with custom metadata
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-sand transition-colors">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">Local Library</h3>
              <p className="text-gray-600 text-sm">
                Save your exported packs locally and reload them anytime
              </p>
            </div>
          </div>

          {/* Quick Start Guide */}
          <div className="bg-gray-50 rounded-xl p-8 border-2 border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-6">Quick Start Guide</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-sand rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">Import Resource Pack</h4>
                  <p className="text-gray-600 text-sm">
                    Drag & drop your ZIP file or use the "Create from Scratch" button
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 bg-sand rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">Browse Textures</h4>
                  <p className="text-gray-600 text-sm">
                    Navigate through folders like blocks, items, and environment
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 bg-sand rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">Edit & Customize</h4>
                  <p className="text-gray-600 text-sm">
                    Use the editor to modify textures with brushes and colors
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 bg-sand rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">Export Your Pack</h4>
                  <p className="text-gray-600 text-sm">
                    Save your creation to your local library or download as ZIP
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600 text-sm">
            © 2026 MC Studio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
