import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/client';

const AuthContext = createContext(null);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const getSupabasePasswordSession = async (email, password) => {
  const supabaseRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const supabaseData = await supabaseRes.json();
  if (!supabaseRes.ok) {
    throw new Error(supabaseData.error_description || supabaseData.msg || supabaseData.error || 'Supabase sign-in failed.');
  }

  return supabaseData;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const loginWithSupabase = async (email, password) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase authentication is not configured.');
    }

    const supabaseData = await getSupabasePasswordSession(email, password);

    const res = await API.post('/auth/supabase', { access_token: supabaseData.access_token });
    const { token, user: userData } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const signupWithSupabase = async ({
    email,
    password,
    name,
    role,
    signup_code,
    student_id,
    department,
    enrollment_year,
    cqpi,
  }) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase authentication is not configured.');
    }

    const supabaseRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        data: { name, role, student_id, department, enrollment_year, cqpi },
      }),
    });

    const supabaseData = await supabaseRes.json();
    if (!supabaseRes.ok) {
      throw new Error(supabaseData.error_description || supabaseData.msg || supabaseData.error || 'Supabase signup failed.');
    }

    let accessToken = supabaseData.session?.access_token;
    if (!accessToken && supabaseData.user) {
      const session = await getSupabasePasswordSession(email, password);
      accessToken = session.access_token;
    }

    if (!accessToken) {
      throw new Error('Signup created your Supabase account. Please confirm your email, then sign in.');
    }

    const res = await API.post('/auth/signup', {
      access_token: accessToken,
      name,
      role,
      signup_code,
      student_id,
      department,
      enrollment_year,
      cqpi,
    });
    const { token, user: userData } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await API.get('/auth/me');
      const updated = res.data.user;
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch (err) {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithSupabase, signupWithSupabase, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
