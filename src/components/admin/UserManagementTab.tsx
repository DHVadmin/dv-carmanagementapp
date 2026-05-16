import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { ShieldAlert, User } from 'lucide-react';

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    role?: 'admin' | 'user' | 'approver' | 'approver_담당' | 'approver_실장' | 'approver_국장' | 'approver_원장';
    lastLogin?: { toDate: () => Date } | null;
    createdAt?: { toDate: () => Date } | null;
}

export const UserManagementTab: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    const ROLE_LABELS: Record<string, string> = {
        'user': '사용자',
        'admin': '최고시스템 관리자',
        'subadmin': '서브관리자(결재권 없음)',
        'admin_담당': '개발자+담당자(관리+결재)',
        'approver_담당': '결재권자(담당)', /* For backward comp */
        'approver_실장': '결재권자(실장)',
        'approver_국장': '결재권자(국장)',
        'approver_원장': '결재권자(원장)',
        'approver': '결재권자(구분없음)'
    };

    // Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        message: string;
        targetUid: string;
        targetRole: string;
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

    const initiateRoleChange = (uid: string, currentRole: string | undefined, newRole: string) => {
        if (currentRole === newRole) return;

        const roleToLabel = (r: string) => ROLE_LABELS[r] || '일반';
        const msg = `이 사용자의 권한을 '${roleToLabel(currentRole || 'user')}'에서 '${roleToLabel(newRole)}'(으)로 변경하시겠습니까?`;

        setConfirmModal({
            isOpen: true,
            message: msg,
            targetUid: uid,
            targetRole: newRole
        });
    };

    const handleConfirmChange = async () => {
        const { targetUid, targetRole } = confirmModal;
        const newRole = targetRole;

        // Close modal immediately
        setConfirmModal(prev => ({ ...prev, isOpen: false }));

        // 1. Snapshot previous state for rollback
        const previousUsers = [...users];

        // 2. Optimistic Update (Immediate UI Change)
        setUsers(prev => prev.map(u =>
            u.uid === targetUid
                ? { ...u, role: newRole as any }
                : u
        ));

        try {
            await updateDoc(doc(db, 'users', targetUid), { role: newRole });
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
                                <th className="p-4">최근 접속</th>
                                <th className="p-4 text-center">권한 설정</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((user) => {
                                const currentRole = (user.role || 'user').toLowerCase();
                                const isSystemAdmin = ['admin', 'subadmin', 'admin_담당'].includes(currentRole);
                                const isApproverOnly = currentRole.startsWith('approver_');
                                
                                return (
                                <tr key={user.uid} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-gray-900">{user.displayName}</td>
                                    <td className="p-4 text-gray-600">{user.email}</td>
                                    <td className="p-4 text-gray-500 text-xs">
                                        {user.lastLogin?.toDate ? user.lastLogin.toDate().toLocaleString() : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <select
                                            value={user.role || 'user'}
                                            onChange={(e) => initiateRoleChange(user.uid, user.role, e.target.value)}
                                            className={`border rounded-lg px-3 py-1.5 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50 cursor-pointer ${
                                                isSystemAdmin ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                isApproverOnly ? 'bg-green-50 text-green-700 border-green-200' :
                                                'bg-white text-gray-700 border-gray-300'
                                            }`}
                                        >
                                            <option value="user">사용자</option>
                                            <option value="admin">최고시스템 관리자</option>
                                            <option value="subadmin">서브관리자(결재권 없음)</option>
                                            <option value="admin_담당">개발자+담당자(관리+결재)</option>
                                            <option value="approver_실장">결재권자(실장)</option>
                                            <option value="approver_국장">결재권자(국장)</option>
                                            <option value="approver_원장">결재권자(원장)</option>
                                            {currentRole === 'approver_담당' && <option value="approver_담당">결재권자(담당) - 레거시</option>}
                                            {currentRole === 'approver' && <option value="approver">결재권자(구분없음)</option>}
                                        </select>
                                    </td>
                                </tr>
                            )})}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">
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
                <p>• '관리자' 및 '결재권자' 권한을 가진 사용자는 앱의 관리자 모드에 접근할 수 있습니다.</p>
                <p>• 결재가 "담당 ➔ 실장 ➔ 국장 ➔ 원장" 순으로 진행되므로 각 직급에 맞게 권한을 설정해주세요.</p>
            </div>

            {/* Custom Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl mx-4">
                        <h3 className="font-bold text-lg mb-2">권한 변경 확인</h3>
                        <p className="text-gray-600 mb-6 whitespace-pre-wrap flex items-start">
                            <ShieldAlert className="mr-2 text-blue-600 shrink-0 mt-0.5" size={20} /> 
                            <span>{confirmModal.message}</span>
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleConfirmChange}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm"
                            >
                                변경 적용
                            </button>
                            <button
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200 transition shadow-sm border border-gray-200"
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
