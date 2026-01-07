import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';

// Types
export type ToolAccess = 'public' | 'authenticated';

export interface ToolConfig {
  enabled: boolean;
  access: ToolAccess;
}

export interface ToolsConfig {
  tempmail: ToolConfig;
  imagetools: ToolConfig;
  pdftools: ToolConfig;
  cctools: ToolConfig;
  generators: ToolConfig;
}

export type ToolId = keyof ToolsConfig;

// Default config - all tools enabled and public
const DEFAULT_CONFIG: ToolsConfig = {
  tempmail: { enabled: true, access: 'public' },
  imagetools: { enabled: true, access: 'public' },
  pdftools: { enabled: true, access: 'public' },
  cctools: { enabled: true, access: 'public' },
  generators: { enabled: true, access: 'public' },
};

// Context interface
interface ToolsConfigContextType {
  config: ToolsConfig;
  loading: boolean;
  error: string | null;
  isToolEnabled: (toolId: ToolId) => boolean;
  canAccessTool: (toolId: ToolId, isLoggedIn: boolean) => { canAccess: boolean; reason: 'ok' | 'disabled' | 'login_required' };
  refreshConfig: () => Promise<void>;
}

// Create context
const ToolsConfigContext = createContext<ToolsConfigContextType | undefined>(undefined);

// Provider component
interface ToolsConfigProviderProps {
  children: ReactNode;
}

export const ToolsConfigProvider: React.FC<ToolsConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<ToolsConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch config from API
  const fetchConfig = async () => {
    try {
      // Try to load from localStorage first for faster initial render
      const cached = localStorage.getItem('toolsConfig');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setConfig(parsed.config);
        } catch (e) {
          // Invalid cache, ignore
        }
      }

      // Fetch from API
      const response = await fetch(`${API_URL}/api/config/tools`);
      const data = await response.json();

      if (data.success) {
        setConfig(data.config);
        // Cache in localStorage
        localStorage.setItem('toolsConfig', JSON.stringify({ config: data.config, timestamp: Date.now() }));
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch tools config');
      }
    } catch (err) {
      console.error('Failed to fetch tools config:', err);
      setError('Network error');
      // Use cached or default config
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Check if a tool is enabled
  const isToolEnabled = (toolId: ToolId): boolean => {
    return config[toolId]?.enabled ?? true;
  };

  // Check if user can access a tool
  const canAccessTool = (toolId: ToolId, isLoggedIn: boolean): { canAccess: boolean; reason: 'ok' | 'disabled' | 'login_required' } => {
    const toolConfig = config[toolId];

    if (!toolConfig) {
      return { canAccess: true, reason: 'ok' };
    }

    if (!toolConfig.enabled) {
      return { canAccess: false, reason: 'disabled' };
    }

    if (toolConfig.access === 'authenticated' && !isLoggedIn) {
      return { canAccess: false, reason: 'login_required' };
    }

    return { canAccess: true, reason: 'ok' };
  };

  const refreshConfig = async () => {
    setLoading(true);
    await fetchConfig();
  };

  const value: ToolsConfigContextType = {
    config,
    loading,
    error,
    isToolEnabled,
    canAccessTool,
    refreshConfig,
  };

  return (
    <ToolsConfigContext.Provider value={value}>
      {children}
    </ToolsConfigContext.Provider>
  );
};

// Custom hook
export const useToolsConfig = (): ToolsConfigContextType => {
  const context = useContext(ToolsConfigContext);
  if (context === undefined) {
    throw new Error('useToolsConfig must be used within a ToolsConfigProvider');
  }
  return context;
};

export default ToolsConfigContext;
