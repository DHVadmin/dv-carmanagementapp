import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { Shield, ShieldOff, User } from 'lucide-react';

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    role?: 'admin' | 'user' | 'approver';
    lastLogin?: { toDate: () => Date } | null;
    createdAt?: { toDate: () => Date } | null;
}



export const UserManagementTab: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        message: string;
        targetUid: string;
        targetRole: 'admin' | 'user' | 'approver' | '';
    }>({ isOpen: false, message: '', targetUid: '', targetRole: '' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
            const querySnapshot = await getDocs(q);
            const userList = querySnapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            })) as UserData[];
            setUsers(userList);
        } catch (error) {
            console.error("Error fetching users:", error);
            alert("사용자 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const initiateToggleRole = (uid: string, currentRole?: string) => {
        // Cycle: User -> Admin -> Approver -> User
        let newRole: 'admin' | 'user' | 'approver' = 'admin';
        let msg = "이 사용자에게 '관리자' 권한을 부여하시겠습니까?\n(기본 관리 기능: 차량, 로그, 사용자 관리)";

        const role = currentRole?.toLowerCase();

        if (role === 'admin') {
            newRole = 'approver';
            msg = "이 사용자에게 '결재권자' 권한을 부여하시겠습니까?\n(관리자 기능 + 관내출장 승인 권한)";
        } else if (role === 'approver') {
            newRole = 'user';
            msg = "이 사용자의 모든 관리 권한을 해제하시겠습니까?";
        }

        setConfirmModal({
            isOpen: true,
            message: msg,
            targetUid: uid,
            targetRole: newRole // Pass the FUTURE role here
        });
    };

    const handleConfirmToggle = async () => {
        const { targetUid, targetRole } = confirmModal;
        const newRole = targetRole;

        // Close modal immediately
        setConfirmModal(prev => ({ ...prev, isOpen: false }));

        // 1. Snapshot previous state for rollback
        const previousUsers = [...users];

        // 2. Optimistic Update (Immediate UI Change)
        setUsers(prev => prev.map(u =>
            u.uid === targetUid
                ? { ...u, role: newRole as "admin" | "user" | "approver" }
                : u
        ));

        try {
            console.log(`[ToggleRole] Updating doc users/${targetUid} to role: ${newRole}`);
            await updateDoc(doc(db, 'users', targetUid), { role: newRole });
            console.log("[ToggleRole] Success.");
        } catch (error) {
            console.error("Error updating role:", error);
            alert("권한 변경 실패: " + error);
            // 3. Rollback on Error
            setUsers(previousUsers);
        }
    };

    if (loading) return <div className="text-center py-10">Loading users...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center text-gray-800">
                    <User className="mr-2" size={24} />
                    사용자 관리
                </h2>
                <button onClick={fetchUsers} className="text-sm text-blue-600 hover:underline">
                    새로고침
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                            <tr>
                                <th className="p-4">이름</th>
                                <th className="p-4">이메일</th>
                                <th className="p-4">권한</th>
                                <th className="p-4">최근 접속</th>
                                <th className="p-4 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.uid} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-gray-900">{user.displayName}</td>
                                    <td className="p-4 text-gray-600">{user.email}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${((user.role as string) === 'admin' || (user.role as string) === 'Admin') ? 'bg-purple-100 text-purple-700' :
                                            ((user.role as string) === 'approver' || (user.role as string) === 'Approver') ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {((user.role as string) === 'admin' || (user.role as string) === 'Admin') ? '관리자' :
                                                ((user.role as string) === 'approver' || (user.role as string) === 'Approver') ? '결재권자' : '일반'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-xs">
                                        {user.lastLogin?.toDate ? user.lastLogin.toDate().toLocaleString() : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => initiateToggleRole(user.uid, user.role)}
                                            className={`flex items-center justify-center w-full px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${(user.role?.toLowerCase() === 'admin') ? 'bg-purple-50 text-purple-600 hover:bg-purple-100' :
                                                (user.role?.toLowerCase() === 'approver') ? 'bg-red-50 text-red-600 hover:bg-red-100' :
                                                    'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                }`}
                                        >
                                            {(user.role?.toLowerCase() === 'admin') ? (
                                                <><Shield size={14} className="mr-1" /> 결재권한 추가</>
                                            ) : (user.role?.toLowerCase() === 'approver') ? (
                                                <><ShieldOff size={14} className="mr-1" /> 해제</>
                                            ) : (
                                                <><Shield size={14} className="mr-1" /> 관리자로</>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">
                                        등록된 사용자가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800">
                <p className="font-bold mb-1">ℹ️ 도움말</p>
                <p>• '관리자' 권한을 가진 사용자는 앱의 관리자 모드에 접근할 수 있습니다.</p>
                <p>• 권한 변경 후 해당 사용자가 앱을 새로고침하거나 재로그인하면 변경 사항이 적용됩니다.</p>
            </div>

            {/* Custom Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl mx-4">
                        <h3 className="font-bold text-lg mb-2">권한 변경 확인</h3>
                        <p className="text-gray-600 mb-6 whitespace-pre-wrap flex items-center">
                            <Shield className="mr-2 text-blue-600" size={20} /> {confirmModal.message}
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleConfirmToggle}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition"
                            >
                                확인
                            </button>
                            <button
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-300 transition"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
