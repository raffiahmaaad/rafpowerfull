import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useInactivityLogout } from "../hooks/useInactivityLogout";
import { InactivityWarningModal } from "../components/common/InactivityWarningModal";

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    turnstileToken?: string
  ) => Promise<{ success: boolean; message?: string }>;
  register: (
    email: string,
    password: string,
    name?: string,
    turnstileToken?: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL =
  import.meta.env.VITE_API_URL || "https://ghostmail-worker.rafxyz.workers.dev";

// Inactivity timeout: 5 menit (300000ms), warning 1 menit sebelum
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("ghostmail_auth_token");
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
        setToken(authToken);
      } else {
        localStorage.removeItem("ghostmail_auth_token");
        setToken(null);
      }
    } catch (err) {
      localStorage.removeItem("ghostmail_auth_token");
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
    turnstileToken?: string
  ) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      const data = await response.json();

      if (data.success && data.token) {
        localStorage.setItem("ghostmail_auth_token", data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, message: data.message || "Login failed" };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const register = async (
    email: string,
    password: string,
    name?: string,
    turnstileToken?: string
  ) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, turnstileToken }),
      });
      const data = await response.json();

      if (data.success && data.token) {
        localStorage.setItem("ghostmail_auth_token", data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, message: data.message || "Registration failed" };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem("ghostmail_auth_token");
    setToken(null);
    setUser(null);
  };

  // Auto-logout for inactive users
  const { showWarning, remainingTime, dismissWarning } = useInactivityLogout({
    onLogout: logout,
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    warningMs: WARNING_BEFORE_LOGOUT_MS,
    enabled: !!user, // Hanya aktif jika user sudah login
  });

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
    >
      {children}
      {/* Inactivity Warning Modal */}
      <InactivityWarningModal
        isOpen={showWarning}
        remainingTime={remainingTime}
        onStayLoggedIn={dismissWarning}
        onLogoutNow={logout}
        userType="user"
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
