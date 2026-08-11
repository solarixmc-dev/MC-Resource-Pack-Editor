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
    <nav className="bg-white dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border pl-0 pr-0">
      <div className="w-full px-0">
        <div className="flex items-center justify-between h-16 relative">
          {/* Logo - absolutely positioned to left edge */}
          <Link href="/" className="absolute left-6 flex items-center gap-2">
            <div className="w-10 h-10 bg-black dark:bg-dark-text rounded-lg flex items-center justify-center">
              <span className="text-white dark:text-dark-bg text-lg font-bold">MC</span>
            </div>
            <span className="text-xl font-bold text-black dark:text-dark-text">TextureLab</span>
          </Link>

          {/* Navigation Links - centered */}
          <div className="flex items-center gap-8 mx-auto">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="group relative py-2 text-base font-medium transition-colors text-gray-600 dark:text-dark-text-secondary hover:text-black dark:hover:text-dark-text"
                >
                  {item.label}
                  {/* Underline animation */}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-[#C2B280] transition-all duration-300 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              );
            })}
          </div>

          {/* Login Button or Profile Dropdown - absolutely positioned to right edge */}
          <div className="absolute right-6 flex-shrink-0">
            {isLoggedIn ? (
              <ProfileDropdown />
            ) : (
              <Link
                href="/auth"
                className="bg-black dark:bg-dark-text text-white dark:text-dark-bg px-6 py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-dark-tertiary transition-colors text-sm"
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
