import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../contexts/AuthContext";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { login, requestPasswordReset, resetPassword, signup } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const result = await login(username, password);
      if (result.success) {
        window.location.href = "/";
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const result = await signup(username, email, password);
      if (result.success) {
        window.location.href = "/";
      } else {
        setError(result.error || "Signup failed");
      }
    } catch (err) {
      setError("Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    
    try {
      await requestPasswordReset(email);
      setMessage("Code sent to email");
    } catch (err) {
      setError("Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const success = await resetPassword(email, resetCode, newPassword);
      if (success) {
        setMessage("Password reset successfully");
        setTimeout(() => {
          setIsForgotPassword(false);
          setIsLogin(true);
          setMessage("");
        }, 2000);
      } else {
        setError("Invalid code");
      }
    } catch (err) {
      setError("Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                <span className="text-white dark:text-black text-xl font-bold">MC</span>
              </div>
              <h1 className="text-3xl font-bold text-black dark:text-dark-text">TextureLab</h1>
            </div>
          </div>

          {/* Forgot Password Card */}
          <div className="bg-gray-50 dark:bg-dark-secondary rounded-xl p-8 border-2 border-gray-200 dark:border-dark-border">
            <h2 className="text-xl font-bold text-black dark:text-dark-text mb-6">Reset Password</h2>
            
            {message && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 text-sm">
                {message}
              </div>
            )}
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
                {error}
              </div>
            )}

            {!message ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
                    Reset Code
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                    maxLength={6}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary"
                    placeholder="•••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setIsLogin(true);
                  setError("");
                  setMessage("");
                }}
                className="text-sm text-gray-600 dark:text-dark-text-secondary hover:text-black dark:hover:text-white"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <span className="text-white dark:text-black text-xl font-bold">MC</span>
            </div>
            <h1 className="text-3xl font-bold text-black dark:text-dark-text">TextureLab</h1>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-gray-50 dark:bg-dark-secondary rounded-xl p-8 border-2 border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-center mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                isLogin ? "text-black dark:text-dark-text border-b-2 border-black dark:border-white" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                !isLogin ? "text-black dark:text-dark-text border-b-2 border-black dark:border-white" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-slate-700"
                placeholder="username"
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-slate-700"
                  placeholder="you@example.com"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] text-black dark:text-dark-text bg-white dark:bg-dark-tertiary"
                placeholder="•••••••••"
              />
            </div>

            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 dark:text-dark-text-secondary hover:text-black dark:hover:text-white"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
