import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const settingsRes = await api.getSettings().catch(() => null);
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
      sessionStorage.setItem('udqm_token', res.token);
      setUser(res.user);
    }
    return res;
  }

  async function logout() {
    try {
      await api.logout();
    } catch (e) {}
    sessionStorage.removeItem('udqm_token');
    localStorage.removeItem('udqm_token');
    setUser(null);
  }

  async function changePassword(currentPassword, newPassword) {
    const res = await api.changePassword(currentPassword, newPassword);
    return res;
  }

  function updateLocalSettings(newSettings) {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }

  const value = {
    user,
    role: user?.role || 'admin',
    isAdmin: (user?.role || 'admin') === 'admin',
    loading,
    settings,
    login,
    logout,
    changePassword,
    refreshSettings: loadSettings,
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
