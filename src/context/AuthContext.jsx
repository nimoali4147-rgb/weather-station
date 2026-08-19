import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/firebase/config";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider, 
  signInWithPopup,
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        try {
          // Fetch User Role from Firestore collection 'users'
          const userRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            setRole("user");
          }
        } catch (err) {
          // Gracefully handle Firestore rule failure without crashing React
          console.error("Firestore Role Read Error:", err.message);
          setRole("user");
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1. Email/Password Signup with Firestore User Role Creation
  const signup = async (email, password, role = "user") => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document in Firestore
      await setDoc(doc(db, "users", res.user.uid), {
        email: res.user.email,
        role: role,
        createdAt: new Date().toISOString()
      });

      return res;
    } catch (err) {
      console.error("Signup Error:", err.message);
      throw err; // Forward error to caller (e.g. Signup Form)
    }
  };

  // 2. Email/Password Login
  const login = async (email, password) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Login Error:", err.message);
      throw err;
    }
  };

  // 3. Google OAuth Sign-In with Automated Role Check
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Optional: Force account selection prompt to prevent closed popup loops
      provider.setCustomParameters({ prompt: 'select_account' });

      const res = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", res.user.uid);
      
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: res.user.email,
          role: "user",
          createdAt: new Date().toISOString()
        });
      }

      return res;
    } catch (err) {
      console.error("Google Auth Error:", err.message);
      throw err;
    }
  };

  // 4. Logout
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout Error:", err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, signup, login, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};