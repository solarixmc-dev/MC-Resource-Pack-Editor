import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  username: string;
  email: string;
  password: string; // In production, this should be hashed
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: User) => void;
  signup: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper functions for localStorage
const USERS_KEY = 'mc-pack-editor-users';
const getUsers = (): User[] => {
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const findUserByUsername = (username: string): User | undefined => {
  const users = getUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
};

const findUserByEmail = (email: string): User | undefined => {
  const users = getUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [resetCodes, setResetCodes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Check localStorage on mount
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedUsername = localStorage.getItem('username');
    const savedEmail = localStorage.getItem('email');
    const savedUserId = localStorage.getItem('userId');
    
    if (loggedIn && savedUsername) {
      // Verify the user still exists in our user database
      const existingUser = findUserByUsername(savedUsername);
      if (existingUser) {
        setIsLoggedIn(true);
        setUser({
          id: savedUserId || existingUser.id,
          username: existingUser.username,
          email: existingUser.email
        });
      } else {
        // User no longer exists, clear session
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        localStorage.removeItem('userId');
      }
    }
  }, []);

  const signup = async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Check if username already exists
    if (findUserByUsername(username)) {
      return { success: false, error: 'Username taken' };
    }
    
    // Check if email already exists
    if (findUserByEmail(email)) {
      return { success: false, error: 'Email registered' };
    }
    
    // Create new user
    const newUser: User = {
      id: crypto.randomUUID(),
      username: username,
      email: email,
      password: password // In production, hash this!
    };
    
    // Save to user database
    const users = getUsers();
    users.push(newUser);
    saveUsers(users);
    
    // Auto-login after signup
    setIsLoggedIn(true);
    setUser(newUser);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', newUser.username);
    localStorage.setItem('email', newUser.email);
    localStorage.setItem('userId', newUser.id);
    
    return { success: true };
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Find user by username
    const existingUser = findUserByUsername(username);
    
    if (!existingUser) {
      return { success: false, error: 'Account not found' };
    }
    
    // Check password
    if (existingUser.password !== password) {
      return { success: false, error: 'Wrong password' };
    }
    
    // Login successful
    setIsLoggedIn(true);
    setUser(existingUser);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', existingUser.username);
    localStorage.setItem('email', existingUser.email);
    localStorage.setItem('userId', existingUser.id);
    
    return { success: true };
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
    
    // Update in user database
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === updatedUser.id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      saveUsers(users);
    }
  };

  const requestPasswordReset = async (email: string): Promise<string> => {
    // Check if user exists with this email
    const existingUser = findUserByEmail(email);
    if (!existingUser) {
      throw new Error('Email not found');
    }
    
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the code for this email (in a real app, this would be sent via email)
    setResetCodes(prev => new Map(prev).set(email, code));
    
    // For demo purposes, we'll log the code and show it in an alert
    console.log(`Password reset code for ${email}: ${code}`);
    alert(`Password reset code: ${code} (In production, this would be sent to your email)`);
    
    return code;
  };

  const resetPassword = async (email: string, code: string, newPassword: string): Promise<boolean> => {
    // Verify the code
    const storedCode = resetCodes.get(email);
    if (storedCode === code) {
      // Update the password in user database
      const users = getUsers();
      const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
      if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        saveUsers(users);
      }
      
      // Clean up the code
      setResetCodes(prev => {
        const newMap = new Map(prev);
        newMap.delete(email);
        return newMap;
      });
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, updateUser, signup, requestPasswordReset, resetPassword }}>
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
