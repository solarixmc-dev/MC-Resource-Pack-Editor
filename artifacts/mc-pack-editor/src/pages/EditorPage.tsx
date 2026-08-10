import EditorApp from "../EditorApp";
import { Link } from "wouter";

export default function EditorPage() {
  return (
    <>
      {/* Back button */}
      <div className="fixed top-4 left-4 z-50">
        <Link
          href="/"
          className="flex items-center gap-2 bg-white/90 backdrop-blur-sm text-black px-4 py-2 rounded-lg shadow-md hover:bg-white transition-colors border border-gray-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Home</span>
        </Link>
      </div>
      <EditorApp />
    </>
  );
}
