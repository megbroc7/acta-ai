import { useState, useEffect } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContextValue';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('access_token')));

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await api.post('/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);

    const userRes = await api.get('/auth/me');
    setUser(userRes.data);
    return userRes.data;
  };

  const register = async (email, password, fullName) => {
    await api.post('/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
