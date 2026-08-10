import { Link, useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import ProfileDropdown from "./ProfileDropdown";

export default function Navigation() {
  const [location] = useLocation();
  const { isLoggedIn } = useAuth();

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/editor", label: "Texture Editor" },
    { path: "/library", label: "Pack Library" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">MC</span>
            </div>
            <span className="text-xl font-bold text-black">Studio</span>
          </Link>

          {/* Navigation Links - centered */}
          <div className="flex items-center gap-8">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="group relative py-2 text-sm font-medium transition-colors text-gray-600 hover:text-black"
                >
                  {item.label}
                  {/* Underline animation */}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-sand transition-all duration-300 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              );
            })}
          </div>

          {/* Login Button or Profile Dropdown */}
          <div className="flex-shrink-0">
            {isLoggedIn ? (
              <ProfileDropdown />
            ) : (
              <Link
                href="/auth"
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors text-sm"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
