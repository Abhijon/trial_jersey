import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, check if we already have a token and confirm it's
  // still valid by asking the server who it belongs to.
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("trail_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("trail_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("trail_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  async function signup(name, email, password) {
    const res = await api.post("/auth/signup", { name, email, password });
    return res.data; // { message, email, requiresOtp: true }
  }

  async function verifySignupOtp(email, otp) {
    const res = await api.post("/auth/verify-signup-otp", { email, otp });
    if (res.data.token) {
      localStorage.setItem("trail_token", res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  }

  async function resendSignupOtp(email) {
    const res = await api.post("/auth/resend-signup-otp", { email });
    return res.data;
  }

  async function forgotPassword(email) {
    const res = await api.post("/auth/forgot-password", { email });
    return res.data;
  }

  async function resendResetOtp(email) {
    const res = await api.post("/auth/resend-reset-otp", { email });
    return res.data;
  }

  async function resetPassword(email, otp, newPassword, confirmPassword) {
    const res = await api.post("/auth/reset-password", {
      email,
      otp,
      newPassword,
      confirmPassword,
    });
    return res.data;
  }

  function logout() {
    localStorage.removeItem("trail_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        verifySignupOtp,
        resendSignupOtp,
        forgotPassword,
        resendResetOtp,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
