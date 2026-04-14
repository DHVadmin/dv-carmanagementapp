import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface MaintenanceWrapperProps {
    children: React.ReactNode;
    maintenance: { enabled: boolean; message: string } | null;
}

export const MaintenanceWrapper: React.FC<MaintenanceWrapperProps> = ({ children, maintenance }) => {
    const { user, isAdmin, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    if (loading) return null;

    // Allow access to Login page even during maintenance
    if (location.pathname === '/login') {
        return <>{children}</>;
    }

    // If maintenance is on, and user is NOT admin/approver, show screen
    if (maintenance?.enabled && !isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">시스템 점검 중입니다</h1>
                    <p className="text-gray-600 mb-6 whitespace-pre-wrap leading-relaxed">
                        {maintenance.message || "보다 안정적인 서비스를 위해\n시스템 점검을 진행하고 있습니다.\n\n잠시 후 다시 접속해 주세요."}
                    </p>
                    <div className="text-xs text-gray-400 mb-6">
                        관리자 문의: admin@together63.kr
                    </div>

                    {!user && (
                        <button
                            onClick={() => navigate('/login')}
                            className="px-4 py-2 bg-gray-800 text-white text-sm font-bold rounded-lg hover:bg-gray-700 transition"
                        >
                            관리자 로그인
                        </button>
                    )}

                    {user && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="text-sm text-gray-500 mb-2">관리자 계정이신가요?</p>
                            <p className="text-xs text-gray-400 mb-4">관리자 권한이 있는 계정은 점검 중에도 접속 가능합니다.</p>
                            <button
                                onClick={() => {
                                    signOut(auth);
                                    navigate('/login');
                                }}
                                className="px-4 py-2 bg-gray-800 text-white text-sm font-bold rounded-lg hover:bg-gray-700 transition"
                            >
                                로그아웃 및 관리자 로그인
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return <>{children}</>;
};
