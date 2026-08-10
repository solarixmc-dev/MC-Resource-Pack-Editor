import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (email: string, username?: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check localStorage on mount
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedUsername = localStorage.getItem('username');
    const savedEmail = localStorage.getItem('email');
    const savedUserId = localStorage.getItem('userId');
    
    if (loggedIn && savedUsername) {
      setIsLoggedIn(true);
      setUser({
        id: savedUserId || crypto.randomUUID(),
        username: savedUsername,
        email: savedEmail || ''
      });
    }
  }, []);

  const login = (email: string, username?: string) => {
    const userId = crypto.randomUUID();
    setIsLoggedIn(true);
    setUser({
      id: userId,
      username: username || email.split('@')[0],
      email
    });
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', username || email.split('@')[0]);
    localStorage.setItem('email', email);
    localStorage.setItem('userId', userId);
  };

  const logout = () => {
    // Clean up user's pack library
    const userId = localStorage.getItem('userId');
    if (userId) {
      localStorage.removeItem(`mc-pack-editor-library-${userId}`);
    }
    
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('username', updatedUser.username);
    localStorage.setItem('email', updatedUser.email);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
