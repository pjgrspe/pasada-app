// modules/auth/hooks/useAuth.ts
import { useAuthStore } from '../store/useAuthStore';

/**
 * Custom hook for accessing authentication state and actions.
 */
export const useAuth = () => {
    const state = useAuthStore();
    return state;
};