import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState({
    id: 1,
    name: 'Kids',
    email: 'kids@udhayam.com',
    role: 'admin'
  });
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadUserAndSettings();
  }, []);

  async function loadUserAndSettings() {
    try {
      setLoading(true);
      const [meRes, settingsRes] = await Promise.all([
        api.getMe().catch(() => null),
        api.getSettings().catch(() => null)
      ]);

      if (meRes?.user) {
        setUser(meRes.user);
      }
      if (settingsRes?.settings) {
        setSettings(settingsRes.settings);
      }
    } catch (err) {
      console.warn('Init error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const res = await api.login(username, password);
    if (res.token) {
      localStorage.setItem('udqm_token', res.token);
      setUser(res.user);
    }
    return res;
  }

  async function logout() {
    try {
      await api.logout();
    } catch (e) {}
    localStorage.removeItem('udqm_token');
    setUser(null);
  }

  function updateLocalSettings(newSettings) {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }

  const value = {
    user,
    role: 'admin',
    isAdmin: true,
    loading,
    settings,
    login,
    logout,
    refreshSettings: loadUserAndSettings,
    updateLocalSettings
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
