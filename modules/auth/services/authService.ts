// modules/auth/services/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser // Import Firebase User type
} from 'firebase/auth';
import { LoginData, SignupData } from '../validation/authSchema';
import { auth } from '../../../FirebaseConfig'; // Import initialized auth

// Define our App User structure (can be different from FirebaseUser)
export interface AppUser {
    uid: string;
    email: string | null;
    displayName: string | null;
}

// Function to map FirebaseUser to our AppUser
const mapFirebaseUser = (user: FirebaseUser): AppUser => ({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
});

// Define the type for profile update data
interface ProfileUpdateData {
    displayName?: string;
    photoURL?: string;
}


const authService = {
  login: async (data: LoginData): Promise<AppUser> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      return mapFirebaseUser(userCredential.user);
    } catch (error: any) {
      console.error("Firebase Login Error:", error.code, error.message);
      throw new Error(error.message || 'Login failed'); // Re-throw for store/UI
    }
  },

  signup: async (data: Omit<SignupData, 'confirmPassword'>): Promise<AppUser> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      // Update the profile with the name immediately after creation
      await updateProfile(userCredential.user, { displayName: data.name });
      // Return the updated user
      return mapFirebaseUser(userCredential.user);
    } catch (error: any) {
      console.error("Firebase Signup Error:", error.code, error.message);
      throw new Error(error.message || 'Signup failed');
    }
  },

  logout: async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error("Firebase Logout Error:", error.message);
      throw new Error(error.message || 'Logout failed');
    }
  },

  // We'll use onAuthStateChanged in the store, but you could have a getCurrentUser here
  getCurrentUser: (): FirebaseUser | null => {
      return auth.currentUser;
  },

  // New function to update user profile
  updateUserProfileData: async (data: ProfileUpdateData): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("No user currently signed in to update profile.");
    }
    try {
        await updateProfile(currentUser, data);
        // After updating, Firebase's onAuthStateChanged listener (in _layout.tsx)
        // should ideally pick up the changes and update the Zustand store.
        // Or, the caller can manually refresh the user state in the store.
    } catch (error: any) {
        console.error("Firebase Update Profile Error:", error.code, error.message);
        throw new Error(error.message || 'Failed to update profile.');
    }
  }
};

export { mapFirebaseUser }; // Export mapFirebaseUser if needed elsewhere
export default authService;