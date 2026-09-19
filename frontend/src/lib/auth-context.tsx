"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "./types";
import { fetchMyProfile, loginUser } from "./api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  loginGoogle: (payload: { credential?: string; email?: string; name?: string; picture?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  loginGoogle: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("hungph_blog_token");
    if (savedToken) {
      setToken(savedToken);
      fetchMyProfile(savedToken)
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem("hungph_blog_token");
          setToken(null);
          setUser(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, pass: string) => {
    const data = await loginUser(identifier, pass);
    localStorage.setItem("hungph_blog_token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const loginGoogle = async (payload: { credential?: string; email?: string; name?: string; picture?: string }) => {
    const { loginWithGoogle } = await import("./api");
    const data = await loginWithGoogle(payload);
    localStorage.setItem("hungph_blog_token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("hungph_blog_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
