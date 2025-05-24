// modules/auth/store/useAuthStore.ts
import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth'; // Only need FirebaseUser type here
import authService, { AppUser } from '../services/authService';
import { LoginData, SignupData } from '../validation/authSchema';
// We don't need 'auth' or 'onAuthStateChanged' here anymore

// Function to map FirebaseUser to our AppUser
const mapFirebaseUser = (user: FirebaseUser | null): AppUser | null => {
    if (!user) return null;
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
    };
};

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  login: (data: LoginData) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  _setUser: (fbUser: FirebaseUser | null) => void; // Keep this internal setter
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false, // Start as false, _layout will handle initial loading feel
  error: null,
  isInitialized: false, // Start as not initialized

  _setUser: (fbUser) => {
      const appUser = mapFirebaseUser(fbUser);
      console.log("Store: Setting user to", appUser?.email || null);
      set({ user: appUser, isAuthenticated: !!appUser, isInitialized: true, isLoading: false });
  },

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await authService.login(data);
      // onAuthStateChanged will handle setting the user state
    } catch (e: any) {
      set({ error: e.message || 'Login failed', isLoading: false });
      throw e;
    }
  },

  signup: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await authService.signup(data);
      // onAuthStateChanged will handle setting the user state
    } catch (e: any) {
      set({ error: e.message || 'Signup failed', isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
        await authService.logout();
        // onAuthStateChanged will handle setting the user state to null
    } catch (e: any) {
         set({ error: e.message || 'Logout failed', isLoading: false });
         throw e;
    }
  },

  clearError: () => set({ error: null }),
}));

// --- REMOVED onAuthStateChanged from here ---