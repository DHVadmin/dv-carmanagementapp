import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import VehicleListPage from './pages/VehicleListPage';
import DrivingLogPage from './pages/DrivingLogPage';
import AdminPage from './pages/AdminPage';
import { MaintenanceWrapper } from './components/MaintenanceWrapper';

function App() {
    const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);

    useEffect(() => {
        // Real-time listener for maintenance settings
        const docRef = doc(db, 'settings', 'global');
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const newData = doc.data().maintenance;
                setMaintenance(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(newData)) {
                        return newData;
                    }
                    return prev;
                });
            }
        });

        // Cleanup listener on unmount
        return () => unsubscribe();
    }, []);

    return (
        <Router>
            <AuthProvider>
                <MaintenanceWrapper maintenance={maintenance}>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <VehicleListPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/log/:vehicleId"
                            element={
                                <ProtectedRoute>
                                    <DrivingLogPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin"
                            element={
                                <AdminRoute>
                                    <AdminPage />
                                </AdminRoute>
                            }
                        />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </MaintenanceWrapper>
            </AuthProvider>
        </Router>
    );
}

export default App;
