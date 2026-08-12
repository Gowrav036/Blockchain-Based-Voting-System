import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('voting_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('voting_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('voting_user', JSON.stringify(userData));
    if (token) {
      localStorage.setItem('voting_jwt', token);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('voting_user');
    localStorage.removeItem('voting_jwt');
  };

  const isAdmin = () => user?.role === 'admin';
  const isUser = () => user?.role === 'user';

  return (
    <AuthContext.Provider value={{ user, pendingUser, setPendingUser, login, logout, loading, isAdmin, isUser }}>
      {children}
    </AuthContext.Provider>
  );
};
