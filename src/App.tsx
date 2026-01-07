import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Layout } from "../components/Layout";
import { HomePage } from "../components/home/HomePage";
import { VaultMailInbox } from "../components/tempmail/VaultMailInbox";
import { LoginPage } from "../components/auth/LoginPage";
import { RegisterPage } from "../components/auth/RegisterPage";
import { Dashboard } from "../components/dashboard/Dashboard";
import { AdminPanel } from "../components/admin/AdminPanel";
import { AdminLogin } from "../components/admin/AdminLogin";
import { ImageTools } from "../components/imagetools/ImageTools";
import { CCGenerator } from "../components/cctools/CCGenerator";
import { PDFTools } from "../components/pdftools/PDFTools";
import { AddressGenerator } from "../components/generatortools/AddressGenerator";
import { ToolDisabledPage } from "../components/common/ToolDisabledPage";
import { InactivityWarningModal } from "../components/common/InactivityWarningModal";
import { AuthProvider, useAuth } from "../context/AuthContext";
import {
  ToolsConfigProvider,
  useToolsConfig,
  ToolId,
} from "../context/ToolsConfigContext";
import { useInactivityLogout } from "../hooks/useInactivityLogout";
import { Toaster } from "react-hot-toast";

// Admin inactivity timeout: 15 menit
const ADMIN_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const ADMIN_WARNING_BEFORE_LOGOUT_MS = 60 * 1000;

// Protected Tool Route Component
interface ProtectedToolRouteProps {
  toolId: ToolId;
  toolName: string;
  children: React.ReactNode;
}

const ProtectedToolRoute: React.FC<ProtectedToolRouteProps> = ({
  toolId,
  toolName,
  children,
}) => {
  const { user } = useAuth();
  const { canAccessTool, loading } = useToolsConfig();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-cyber-primary font-medium">Loading...</div>
      </div>
    );
  }

  const { canAccess, reason } = canAccessTool(toolId, !!user);

  if (!canAccess) {
    // reason is guaranteed to be 'disabled' or 'login_required' when !canAccess
    return (
      <ToolDisabledPage
        reason={reason as "disabled" | "login_required"}
        toolName={toolName}
      />
    );
  }

  return <>{children}</>;
};

// TempMail Layout Wrapper
const TempMailLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <main className="flex-grow flex flex-col relative z-10">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        {children}
      </div>
    </main>
  );
};

// Main App Content with Router
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://ghostmail-worker.rafxyz.workers.dev";

  // Admin logout function
  const handleAdminLogout = async () => {
    try {
      await fetch(`${API_URL}/api/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      /* ignore */
    }
    setIsAdminAuthenticated(false);
    navigate("/");
  };

  // Auto-logout for inactive admin
  const {
    showWarning: showAdminWarning,
    remainingTime: adminRemainingTime,
    dismissWarning: dismissAdminWarning,
  } = useInactivityLogout({
    onLogout: handleAdminLogout,
    timeoutMs: ADMIN_INACTIVITY_TIMEOUT_MS,
    warningMs: ADMIN_WARNING_BEFORE_LOGOUT_MS,
    enabled: isAdminAuthenticated, // Hanya aktif jika admin sudah login
  });

  // Get current view type for Layout
  const getCurrentView = (): string => {
    const path = location.pathname;
    if (path === "/") return "home";
    if (
      path.startsWith("/tempmail") ||
      path.startsWith("/mailbox") ||
      path.startsWith("/login") ||
      path.startsWith("/register")
    )
      return "tempmail";
    if (path.startsWith("/imagetools")) return "imagetools";
    if (path.startsWith("/pdftools")) return "pdftools";
    if (path.startsWith("/cctools")) return "cctools";
    if (path.startsWith("/generators")) return "generators";
    if (path.startsWith("/dashboard")) return "dashboard";
    if (path.startsWith("/admin")) return "admin";
    return "home";
  };

  const handleViewChange = (view: string) => {
    switch (view) {
      case "home":
        navigate("/");
        break;
      case "tempmail":
        navigate("/tempmail");
        break;
      case "imagetools":
        navigate("/imagetools");
        break;
      case "pdftools":
        navigate("/pdftools");
        break;
      case "cctools":
        navigate("/cctools");
        break;
      case "generators":
        navigate("/generators");
        break;
      case "dashboard":
        navigate("/dashboard");
        break;
      default:
        navigate("/");
    }
  };

  const handleLoginSuccess = () => {
    navigate("/dashboard");
  };

  const handleLogout = () => {
    navigate("/");
  };

  const handleGoToGenerateFromDashboard = () => {
    navigate("/tempmail");
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="text-cyber-primary font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Layout
        onViewChange={handleViewChange}
        currentView={getCurrentView() as any}
        isLoggedIn={!!user}
      >
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1c1c2e",
              color: "#fff",
              border: "1px solid #00f0ff",
              fontFamily: "Inter, sans-serif",
            },
            className: "!font-sans",
          }}
        />

        <Routes>
          {/* Home */}
          <Route
            path="/"
            element={<HomePage onNavigate={handleViewChange} />}
          />

          {/* TempMail Routes */}
          <Route
            path="/tempmail"
            element={
              <ProtectedToolRoute toolId="tempmail" toolName="TempMail">
                <TempMailLayout>
                  <VaultMailInbox />
                </TempMailLayout>
              </ProtectedToolRoute>
            }
          />

          {/* Auth Routes */}
          <Route
            path="/login"
            element={
              <TempMailLayout>
                <LoginPage
                  onSwitchToRegister={() => navigate("/register")}
                  onSuccess={handleLoginSuccess}
                />
              </TempMailLayout>
            }
          />
          <Route
            path="/register"
            element={
              <TempMailLayout>
                <RegisterPage
                  onSwitchToLogin={() => navigate("/login")}
                  onSuccess={handleLoginSuccess}
                />
              </TempMailLayout>
            }
          />

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              user ? (
                <Dashboard
                  onLogout={handleLogout}
                  onGenerateEmail={handleGoToGenerateFromDashboard}
                />
              ) : (
                <TempMailLayout>
                  <LoginPage
                    onSwitchToRegister={() => navigate("/register")}
                    onSuccess={handleLoginSuccess}
                  />
                </TempMailLayout>
              )
            }
          />

          {/* Image Tools */}
          <Route
            path="/imagetools/*"
            element={
              <ProtectedToolRoute toolId="imagetools" toolName="Image Tools">
                <main className="flex-grow flex flex-col items-center justify-start p-4 relative z-10 pt-8">
                  <ImageTools onBack={() => navigate("/")} />
                </main>
              </ProtectedToolRoute>
            }
          />

          {/* PDF Tools */}
          <Route
            path="/pdftools/*"
            element={
              <ProtectedToolRoute toolId="pdftools" toolName="PDF Tools">
                <main className="flex-grow flex flex-col items-center justify-start p-4 relative z-10 pt-8">
                  <PDFTools onBack={() => navigate("/")} />
                </main>
              </ProtectedToolRoute>
            }
          />

          {/* CC Tools */}
          <Route
            path="/cctools"
            element={
              <ProtectedToolRoute toolId="cctools" toolName="CC Tools">
                <main className="flex-grow flex flex-col items-center justify-start p-4 relative z-10 pt-8">
                  <CCGenerator onBack={() => navigate("/")} />
                </main>
              </ProtectedToolRoute>
            }
          />

          {/* Generator Tools */}
          <Route
            path="/generators"
            element={
              <ProtectedToolRoute toolId="generators" toolName="Address Tools">
                <main className="flex-grow flex flex-col items-center justify-start p-4 relative z-10 pt-8">
                  <AddressGenerator onBack={() => navigate("/")} />
                </main>
              </ProtectedToolRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              isAdminAuthenticated ? (
                <AdminPanel onLogout={handleAdminLogout} />
              ) : (
                <main className="flex-grow flex flex-col items-center justify-center p-4 relative z-10">
                  <AdminLogin onSuccess={() => setIsAdminAuthenticated(true)} />
                </main>
              )
            }
          />

          {/* Fallback - redirect to home */}
          <Route
            path="*"
            element={<HomePage onNavigate={handleViewChange} />}
          />
        </Routes>
      </Layout>

      {/* Admin Inactivity Warning Modal */}
      <InactivityWarningModal
        isOpen={showAdminWarning}
        remainingTime={adminRemainingTime}
        onStayLoggedIn={dismissAdminWarning}
        onLogoutNow={handleAdminLogout}
        userType="admin"
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToolsConfigProvider>
          <AppRoutes />
        </ToolsConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
