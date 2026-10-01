import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const refresh = useCallback(async () => {
    if (!getToken()) return setUser(null);
    try {
      setUser(await api('/users/me'));
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const authenticate = async (path, body) => {
    const { token, user: u } = await api(path, { method: 'POST', body, auth: false });
    setToken(token);
    setUser(u);
    return u;
  };

  const value = {
    user,
    loading,
    setUser,
    refresh,
    login: (email, password) => authenticate('/users/login', { email, password }),
    register: (data) => authenticate('/users/register', data),
    logout: () => { setToken(null); setUser(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
