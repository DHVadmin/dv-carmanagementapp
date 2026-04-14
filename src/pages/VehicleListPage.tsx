import React, { useEffect, useState } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Vehicle } from '../types';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Car, User as UserIcon, BookOpen, X } from 'lucide-react';
import { UserGuideManual } from '../manuals/UserGuideManual';
import { useAuth } from '../context/AuthContext';
import MyRequestsModal from '../components/common/MyRequestsModal';

const VehicleListPage: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [myRequestsModalOpen, setMyRequestsModalOpen] = useState(false);
    const navigate = useNavigate();
    const { user, isAdmin, userRole } = useAuth();

    useEffect(() => {
        fetchVehicles();
    }, []);

    const fetchVehicles = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'vehicles'));
            const vehicleList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Vehicle[];
            setVehicles(vehicleList);
        } catch (error) {
            console.error("Error fetching vehicles:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        auth.signOut();
    };

    const seedData = async () => {
        setSeeding(true);
        try {
            const mockVehicles: Omit<Vehicle, 'id'>[] = [
                {
                    name: '그랜저 IG',
                    plateNumber: '12가 3456',
                    lastMileage: 54000,
                    fuelType: 'Gasoline',
                    insurance: {
                        company: '삼성화재',
                        contact: '1588-5114',
                        expiryDate: '2025-12-31'
                    }
                },
                {
                    name: '카니발',
                    plateNumber: '34나 5678',
                    lastMileage: 12050,
                    fuelType: 'Diesel',
                    insurance: {
                        company: 'DB손해보험',
                        contact: '1588-0100',
                        expiryDate: '2025-06-30'
                    }
                }
            ];

            for (const v of mockVehicles) {
                await addDoc(collection(db, 'vehicles'), v);
            }
            await fetchVehicles();
            alert('테스트 데이터가 생성되었습니다!');
        } catch (e) {
            console.error('Error seeding data:', e);
            alert('데이터 생성 실패 (권한 문제일 수 있습니다): ' + e);
        } finally {
            setSeeding(false);
        }
    };

    // Determine Role Display
    const getRoleDisplayName = () => {
        if (!userRole) return '사용자';
        if (userRole === 'admin') return '관리자';
        if (userRole === 'approver') return '결재권자';
        return '사용자';
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header with User Info */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-md mx-auto px-4 py-4">
                    <div className="flex justify-between items-center mb-3">
                        <h1 className="text-lg font-bold text-gray-800">동행빌리지 차량관리 <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full align-middle">v5.5.2</span></h1>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setIsGuideOpen(true)}
                                className="flex flex-col items-center justify-center text-gray-600 bg-gray-100 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-colors mr-1 h-full min-h-[44px]"
                            >
                                <BookOpen size={16} className="mb-0.5" />
                                <span className="whitespace-nowrap">가이드</span>
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => navigate('/admin')}
                                    className="flex flex-col items-center justify-center text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors mr-1 h-full min-h-[44px]"
                                >
                                    <UserIcon size={16} className="mb-0.5" />
                                    <span className="whitespace-nowrap">관리자</span>
                                </button>
                            )}
                            <button
                                onClick={() => setMyRequestsModalOpen(true)}
                                className="flex flex-col items-center justify-center text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-gray-50 transition-colors h-full min-h-[44px]"
                            >
                                <BookOpen size={16} className="mb-0.5" />
                                <span className="whitespace-nowrap">나의 요청</span>
                            </button>
                            <button onClick={handleLogout} className="text-gray-500 p-2 hover:bg-gray-100 rounded-full ml-1">
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>

                    {/* User Info Card */}
                    <div className="bg-blue-50 rounded-lg p-3 flex items-start space-x-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <UserIcon size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <span className="font-bold text-gray-900">{user?.displayName || '사용자'}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${userRole === 'admin' ? 'bg-purple-100 text-purple-800' : userRole === 'approver' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {getRoleDisplayName()}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">ID: {user?.email}</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-md mx-auto px-4 py-6">
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-xl font-bold text-gray-900">차량 선택</h2>
                    {vehicles.length === 0 && (
                        <button
                            onClick={seedData}
                            disabled={seeding}
                            className="text-sm text-blue-600 flex items-center disabled:opacity-50"
                        >
                            <Plus size={14} className="mr-1" />
                            {seeding ? '생성 중...' : '테스트 데이터 생성'}
                        </button>
                    )}
                </div>

                {vehicles.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed">
                        <p className="mb-2">등록된 차량이 없습니다.</p>
                        <button
                            onClick={seedData}
                            disabled={seeding}
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                            {seeding ? '데이터 생성 중...' : '테스트 데이터 생성하기'}
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {vehicles.map((vehicle) => (
                            <div
                                key={vehicle.id}
                                onClick={() => navigate(`/log/${vehicle.id}`)}
                                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-transform cursor-pointer hover:border-blue-300 flex justify-between items-center"
                            >
                                <div className="space-y-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{vehicle.name}</h3>
                                        <p className="text-gray-500 text-sm">{vehicle.plateNumber}</p>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {vehicle.fuelType}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    {vehicle.imageUrl ? (
                                        <div className="w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-gray-100">
                                            <img src={vehicle.imageUrl} alt={vehicle.name} className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300">
                                            <Car size={32} />
                                        </div>
                                    )}
                                    <p className="text-sm font-bold text-gray-700">
                                        {(vehicle.lastMileage || 0).toLocaleString()} km
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* User Guide Modal */}
            {isGuideOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-800">📱 앱 사용자 가이드</h3>
                            <button onClick={() => setIsGuideOpen(false)} className="text-gray-500 hover:text-gray-700 p-1 bg-gray-200 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                            <UserGuideManual />
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-right">
                            <button
                                onClick={() => setIsGuideOpen(false)}
                                className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* My Requests Modal */}
            <MyRequestsModal
                isOpen={myRequestsModalOpen}
                onClose={() => setMyRequestsModalOpen(false)}
                userEmail={user?.email || ''}
            />
        </div>
    );
};

export default VehicleListPage;
