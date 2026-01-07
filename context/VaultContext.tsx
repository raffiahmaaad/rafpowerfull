import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  deriveKey,
  deriveAuthKey,
  encryptData,
  decryptData,
  generateSalt,
  createEmptyVault,
  type VaultData,
  type VaultEntry,
  generateEntryId,
} from "../lib/vault-crypto";
import { useAuth } from "./AuthContext";

const API_URL =
  import.meta.env.VITE_API_URL || "https://ghostmail-worker.rafxyz.workers.dev";

// Auto-lock timeout: 5 minutes of inactivity
const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

interface VaultContextType {
  // State
  isLoading: boolean;
  hasVault: boolean;
  isUnlocked: boolean;
  vaultData: VaultData | null;
  error: string | null;
  autoLockRemaining: number | null;
  hasSecondaryPassword: boolean;

  // Actions
  setupVault: (masterPassword: string) => Promise<boolean>;
  unlockVault: (masterPassword: string) => Promise<boolean>;
  lockVault: () => void;
  addEntry: (
    entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">
  ) => Promise<boolean>;
  updateEntry: (id: string, entry: Partial<VaultEntry>) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  changeMasterPassword: (
    oldPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  deleteVault: (masterPassword: string) => Promise<boolean>;
  resetActivity: () => void;

  // Secondary Password Actions
  setupSecondaryPassword: (password: string) => Promise<boolean>;
  verifySecondaryPassword: (password: string) => Promise<boolean>;
  changeSecondaryPassword: (
    oldPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  removeSecondaryPassword: (password: string) => Promise<boolean>;
}

const VaultContext = createContext<VaultContextType | null>(null);

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within VaultProvider");
  }
  return context;
};

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token } = useAuth();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [hasVault, setHasVault] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoLockRemaining, setAutoLockRemaining] = useState<number | null>(
    null
  );

  // Refs for encryption key and metadata (never stored, only in memory)
  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const saltRef = useRef<string | null>(null);
  const authKeyHashRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const autoLockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset activity timestamp
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Clear all sensitive data from memory
  const clearMemory = useCallback(() => {
    encryptionKeyRef.current = null;
    authKeyHashRef.current = null;
    setVaultData(null);
    setIsUnlocked(false);
    if (autoLockTimerRef.current) {
      clearInterval(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
    setAutoLockRemaining(null);
  }, []);

  // Lock vault
  const lockVault = useCallback(() => {
    clearMemory();
  }, [clearMemory]);

  // Auto-lock timer
  useEffect(() => {
    if (isUnlocked) {
      autoLockTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastActivityRef.current;
        const remaining = AUTO_LOCK_TIMEOUT_MS - elapsed;

        if (remaining <= 0) {
          lockVault();
        } else {
          setAutoLockRemaining(Math.ceil(remaining / 1000));
        }
      }, 1000);

      return () => {
        if (autoLockTimerRef.current) {
          clearInterval(autoLockTimerRef.current);
        }
      };
    }
  }, [isUnlocked, lockVault]);

  // Check if vault exists on mount
  useEffect(() => {
    const checkVault = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/vault`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.success) {
          setHasVault(data.hasVault);
          if (data.hasVault) {
            saltRef.current = data.salt;
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    checkVault();
  }, [token]);

  // Setup new vault
  const setupVault = useCallback(
    async (masterPassword: string): Promise<boolean> => {
      if (!token) return false;
      setError(null);

      try {
        const salt = generateSalt();
        const key = await deriveKey(masterPassword, salt);
        const authKeyHash = await deriveAuthKey(masterPassword, salt);

        const emptyVault = createEmptyVault();
        const { ciphertext, iv } = await encryptData(emptyVault, key);

        const res = await fetch(`${API_URL}/api/vault/setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            encryptedData: ciphertext,
            iv,
            salt,
            authKeyHash,
          }),
        });

        const data = await res.json();

        if (data.success) {
          encryptionKeyRef.current = key;
          saltRef.current = salt;
          authKeyHashRef.current = authKeyHash;
          setVaultData(emptyVault);
          setHasVault(true);
          setIsUnlocked(true);
          lastActivityRef.current = Date.now();
          return true;
        } else {
          setError(data.message);
          return false;
        }
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [token]
  );

  // Unlock vault
  const unlockVault = useCallback(
    async (masterPassword: string): Promise<boolean> => {
      if (!token || !saltRef.current) return false;
      setError(null);

      try {
        const key = await deriveKey(masterPassword, saltRef.current);
        const authKeyHash = await deriveAuthKey(
          masterPassword,
          saltRef.current
        );

        // Verify password with server
        const verifyRes = await fetch(`${API_URL}/api/vault/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ authKeyHash }),
        });

        const verifyData = await verifyRes.json();

        if (!verifyData.success || !verifyData.verified) {
          setError("Invalid master password");
          return false;
        }

        // Get encrypted vault data
        const res = await fetch(`${API_URL}/api/vault`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!data.success || !data.hasVault) {
          setError("Failed to load vault");
          return false;
        }

        // Decrypt vault data
        const decrypted = await decryptData<VaultData>(
          data.encryptedData,
          data.iv,
          key
        );

        encryptionKeyRef.current = key;
        authKeyHashRef.current = authKeyHash;
        setVaultData(decrypted);
        setIsUnlocked(true);
        lastActivityRef.current = Date.now();
        return true;
      } catch (err: any) {
        setError("Failed to decrypt vault. Check your master password.");
        return false;
      }
    },
    [token]
  );

  // Save vault to server
  const saveVault = useCallback(
    async (newVaultData: VaultData): Promise<boolean> => {
      if (!token || !encryptionKeyRef.current || !authKeyHashRef.current) {
        return false;
      }

      try {
        const { ciphertext, iv } = await encryptData(
          newVaultData,
          encryptionKeyRef.current
        );

        const res = await fetch(`${API_URL}/api/vault`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            encryptedData: ciphertext,
            iv,
            authKeyHash: authKeyHashRef.current,
          }),
        });

        const data = await res.json();
        return data.success;
      } catch {
        return false;
      }
    },
    [token]
  );

  // Add entry
  const addEntry = useCallback(
    async (
      entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">
    ): Promise<boolean> => {
      if (!vaultData) return false;
      resetActivity();

      const now = Date.now();
      const newEntry: VaultEntry = {
        ...entry,
        id: generateEntryId(),
        createdAt: now,
        updatedAt: now,
      };

      const newVaultData: VaultData = {
        ...vaultData,
        entries: [...vaultData.entries, newEntry],
        lastModified: now,
      };

      const success = await saveVault(newVaultData);
      if (success) {
        setVaultData(newVaultData);
      }
      return success;
    },
    [vaultData, saveVault, resetActivity]
  );

  // Update entry
  const updateEntry = useCallback(
    async (id: string, updates: Partial<VaultEntry>): Promise<boolean> => {
      if (!vaultData) return false;
      resetActivity();

      const now = Date.now();
      const newVaultData: VaultData = {
        ...vaultData,
        entries: vaultData.entries.map((e) =>
          e.id === id ? { ...e, ...updates, updatedAt: now } : e
        ),
        lastModified: now,
      };

      const success = await saveVault(newVaultData);
      if (success) {
        setVaultData(newVaultData);
      }
      return success;
    },
    [vaultData, saveVault, resetActivity]
  );

  // Delete entry
  const deleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      if (!vaultData) return false;
      resetActivity();

      const now = Date.now();
      const newVaultData: VaultData = {
        ...vaultData,
        entries: vaultData.entries.filter((e) => e.id !== id),
        lastModified: now,
      };

      const success = await saveVault(newVaultData);
      if (success) {
        setVaultData(newVaultData);
      }
      return success;
    },
    [vaultData, saveVault, resetActivity]
  );

  // Change master password
  const changeMasterPassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      if (!token || !vaultData || !saltRef.current) return false;
      resetActivity();

      try {
        const oldAuthKeyHash = await deriveAuthKey(
          oldPassword,
          saltRef.current
        );

        // Generate new salt and keys
        const newSalt = generateSalt();
        const newKey = await deriveKey(newPassword, newSalt);
        const newAuthKeyHash = await deriveAuthKey(newPassword, newSalt);

        // Re-encrypt vault with new key
        const { ciphertext, iv } = await encryptData(vaultData, newKey);

        const res = await fetch(`${API_URL}/api/vault/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            oldAuthKeyHash,
            newEncryptedData: ciphertext,
            newIv: iv,
            newSalt,
            newAuthKeyHash,
          }),
        });

        const data = await res.json();

        if (data.success) {
          encryptionKeyRef.current = newKey;
          saltRef.current = newSalt;
          authKeyHashRef.current = newAuthKeyHash;
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token, vaultData, resetActivity]
  );

  // Delete vault
  const deleteVault = useCallback(
    async (masterPassword: string): Promise<boolean> => {
      if (!token || !saltRef.current) return false;

      try {
        const authKeyHash = await deriveAuthKey(
          masterPassword,
          saltRef.current
        );

        const res = await fetch(`${API_URL}/api/vault`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            authKeyHash,
            confirmDelete: true,
          }),
        });

        const data = await res.json();

        if (data.success) {
          clearMemory();
          saltRef.current = null;
          setHasVault(false);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token, clearMemory]
  );

  // ============ SECONDARY PASSWORD SYSTEM (SERVER-SIDE) ============

  const [hasSecondaryPassword, setHasSecondaryPassword] = useState(false);

  // Check for existing secondary password from server when vault loads
  useEffect(() => {
    const checkSecondaryPassword = async () => {
      if (!token || !hasVault) return;

      try {
        const res = await fetch(`${API_URL}/api/vault/secondary-password`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setHasSecondaryPassword(data.hasSecondaryPassword);
        }
      } catch {
        // Silently fail - secondary password is optional
      }
    };

    checkSecondaryPassword();
  }, [token, hasVault]);

  // Setup secondary password (saves to server)
  const setupSecondaryPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!token || password.length < 10) return false;

      try {
        const salt = generateSalt();
        const hash = await deriveAuthKey(password, salt);

        const res = await fetch(`${API_URL}/api/vault/secondary-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ hash, salt }),
        });

        const data = await res.json();
        if (data.success) {
          setHasSecondaryPassword(true);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token]
  );

  // Verify secondary password (fetches salt from server, computes hash locally)
  const verifySecondaryPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!token) return false;

      try {
        // Get salt and stored hash from server
        const res = await fetch(`${API_URL}/api/vault/secondary-password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "verify" }),
        });

        const data = await res.json();
        if (!data.success) return false;

        // Compute hash locally and compare
        const hash = await deriveAuthKey(password, data.salt);
        return hash === data.storedHash;
      } catch {
        return false;
      }
    },
    [token]
  );

  // Change secondary password (server-side)
  const changeSecondaryPassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      if (!token || newPassword.length < 10) return false;

      try {
        // First get current salt to compute old hash
        const verifyRes = await fetch(
          `${API_URL}/api/vault/secondary-password`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action: "verify" }),
          }
        );

        const verifyData = await verifyRes.json();
        if (!verifyData.success) return false;

        const oldHash = await deriveAuthKey(oldPassword, verifyData.salt);

        // Verify old password matches
        if (oldHash !== verifyData.storedHash) return false;

        // Generate new hash and salt
        const newSalt = generateSalt();
        const newHash = await deriveAuthKey(newPassword, newSalt);

        // Update on server
        const res = await fetch(`${API_URL}/api/vault/secondary-password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "change",
            currentHash: oldHash,
            newHash,
            newSalt,
          }),
        });

        return (await res.json()).success;
      } catch {
        return false;
      }
    },
    [token]
  );

  // Remove secondary password (server-side)
  const removeSecondaryPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!token) return false;

      try {
        // Get salt to compute hash
        const verifyRes = await fetch(
          `${API_URL}/api/vault/secondary-password`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action: "verify" }),
          }
        );

        const verifyData = await verifyRes.json();
        if (!verifyData.success) return false;

        const confirmHash = await deriveAuthKey(password, verifyData.salt);

        // Delete from server
        const res = await fetch(`${API_URL}/api/vault/secondary-password`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ confirmHash }),
        });

        const data = await res.json();
        if (data.success) {
          setHasSecondaryPassword(false);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token]
  );

  return (
    <VaultContext.Provider
      value={{
        isLoading,
        hasVault,
        isUnlocked,
        vaultData,
        error,
        autoLockRemaining,
        hasSecondaryPassword,
        setupVault,
        unlockVault,
        lockVault,
        addEntry,
        updateEntry,
        deleteEntry,
        changeMasterPassword,
        deleteVault,
        resetActivity,
        setupSecondaryPassword,
        verifySecondaryPassword,
        changeSecondaryPassword,
        removeSecondaryPassword,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};
