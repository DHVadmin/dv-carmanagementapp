import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    userRole: string | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false, userRole: null });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                try {
                    const userRef = doc(db, 'users', currentUser.uid);
                    const userSnap = await getDoc(userRef);

                    let isSystemAdmin = currentUser.email === 'admin@together63.kr';
                    let fetchedRole = isSystemAdmin ? 'admin' : 'user';

                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        fetchedRole = data.role || 'user';
                        if (fetchedRole === 'admin' || fetchedRole === 'approver') isSystemAdmin = true;

                        // Update last login and fresh info
                        await setDoc(userRef, {
                            email: currentUser.email,
                            displayName: currentUser.displayName || '사용자',
                            photoURL: currentUser.photoURL,
                            lastLogin: serverTimestamp()
                        }, { merge: true });
                    } else {
                        // Create new user
                        await setDoc(userRef, {
                            email: currentUser.email,
                            displayName: currentUser.displayName || '사용자',
                            photoURL: currentUser.photoURL,
                            role: fetchedRole,
                            createdAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        });
                    }
                    setIsAdmin(isSystemAdmin);
                    setUserRole(fetchedRole);
                } catch (error) {
                    console.error("Auth Sync Error:", error);
                    setIsAdmin(currentUser.email === 'admin@together63.kr');
                    setUserRole(currentUser.email === 'admin@together63.kr' ? 'admin' : 'user');
                }
            } else {
                setIsAdmin(false);
                setUserRole(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, userRole }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
