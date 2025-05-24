// modules/auth/store/useAuthStore.ts
import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import authService from '../services/authService';
import { LoginData, SignupData } from '../validation/authSchema';

// Update AppUser interface if you haven't already
export interface AppUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL?: string | null; // Add photoURL
}

const mapFirebaseUser = (user: FirebaseUser | null): AppUser | null => {
    if (!user) return null;
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL, // Map photoURL
    };
};

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean; // For individual async actions like login/signup
  error: string | null;
  isInitialized: boolean; // True after onAuthStateChanged fires for the first time
  login: (data: LoginData) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  _setUser: (fbUser: FirebaseUser | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({ // Added get
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,

  _setUser: (fbUser) => {
      const appUser = mapFirebaseUser(fbUser);
      console.log("Store: Setting user via _setUser to", appUser?.email || null);
      set({
          user: appUser,
          isAuthenticated: !!appUser,
          isInitialized: true, // Mark as initialized
          isLoading: false, // Ensure loading is false after auth state is known
          error: null // Clear any previous auth errors on state change
        });
  },

  login: async (data) => {
    if (get().isLoading) return; // Prevent multiple login attempts
    set({ isLoading: true, error: null });
    try {
      await authService.login(data);
      // onAuthStateChanged in _layout.tsx will handle setting the user state
      // isLoading will be reset by _setUser or in the catch block
    } catch (e: any) {
      console.error("Login action error:", e.message);
      set({ error: e.message || 'Login failed', isLoading: false });
      throw e;
    }
  },

  signup: async (data) => {
    if (get().isLoading) return; // Prevent multiple signup attempts
    set({ isLoading: true, error: null });
    try {
      await authService.signup(data);
      // onAuthStateChanged in _layout.tsx will handle setting the user state
    } catch (e: any) {
      console.error("Signup action error:", e.message);
      set({ error: e.message || 'Signup failed', isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    if (get().isLoading) return; // Prevent multiple logout attempts
    set({ isLoading: true, error: null }); // Set error to null during logout attempt
    try {
        await authService.logout();
        // onAuthStateChanged in _layout.tsx will handle setting the user state to null
        // and isLoading will be set to false by _setUser.
    } catch (e: any) {
         console.error("Logout action error:", e.message);
         set({ error: e.message || 'Logout failed', isLoading: false });
         throw e;
    }
  },

  clearError: () => set({ error: null }),
}));