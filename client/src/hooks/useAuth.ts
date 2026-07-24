import { useState, useEffect } from "react";
import type { User } from "@shared/schema";

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: Error | null;
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
          cache: "no-store", // 🔥 IMPORTANT
        });

        if (response.ok) {
          const user = await response.json();
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            error: null,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: null,
          });
        }
      } catch (error) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
      }
    };

    checkAuthStatus();
  }, []);

  return authState;
}
