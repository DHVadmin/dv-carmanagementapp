import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!user || !isAdmin) {
        // Redirect non-admins to home
        return <Navigate to="/" />;
    }

    return <>{children}</>;
};
