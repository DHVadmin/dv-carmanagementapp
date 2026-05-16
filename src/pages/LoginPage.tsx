import React, { useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Share, MoreVertical, Download, X, HelpCircle, PlusSquare } from 'lucide-react';

const LoginPage: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showInstallGuide, setShowInstallGuide] = useState(false);

    const navigate = useNavigate();
    const { user, loading } = useAuth();

    // Check for existing session
    useEffect(() => {
        if (!loading && user) {
            const checkUser = async () => {
                if (user.email && !user.email.endsWith('@together63.kr')) {
                    await auth.signOut();
                    setError('접근 권한이 없습니다. @together63.kr 계정으로만 로그인할 수 있습니다.');
                } else {
                    navigate('/');
                }
            };
            checkUser();
        }
    }, [user, loading, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Minimal validation
        if (!email.endsWith('@together63.kr')) {
            setError('@together63.kr 이메일만 사용할 수 있습니다.');
            setIsLoading(false);
            return;
        }

        try {
            if (isSignUp) {
                // Sign Up Logic
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Update Display Name
                await updateProfile(userCredential.user, { displayName: name });
            } else {
                // Login Logic
                await signInWithEmailAndPassword(auth, email, password);
            }
            // Navigate handled by useEffect
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError('이미 사용 중인 이메일입니다.');
            } else if (err.code === 'auth/invalid-email') {
                setError('유효하지 않은 이메일 형식입니다.');
            } else if (err.code === 'auth/weak-password') {
                setError('비밀번호는 6자 이상이어야 합니다.');
            } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            } else {
                setError('오류가 발생했습니다: ' + err.message);
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 relative">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        동행빌리지 차량관리 <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full align-middle">v5.6.7</span>
                    </h2>
                    <div className="mt-8 text-center text-gray-500 text-xs">
                        <p>© 2024 Donghaeng Village. All rights reserved.</p>

                    </div>
                </div>

                {error && <p className="text-red-500 text-sm mb-6 text-center bg-red-50 p-3 rounded-lg">{error}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="실명 입력"
                                required={isSignUp}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="example@together63.kr"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="6자 이상 입력"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-md transition-all transform active:scale-95
                            ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                            }`}
                    >
                        {isLoading ? '처리 중...' : (isSignUp ? '회원가입' : '로그인')}
                    </button>
                </form>

                <div className="mt-6 text-center space-y-4">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                            setEmail('');
                            setPassword('');
                            setName('');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium block w-full"
                    >
                        {isSignUp
                            ? '이미 계정이 있으신가요? 로그인하기'
                            : '계정이 없으신가요? 회원가입하기'}
                    </button>

                    <button
                        onClick={() => setShowInstallGuide(true)}
                        className="text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1 mx-auto"
                    >
                        <HelpCircle size={14} /> 앱 설치 방법
                    </button>
                </div>


            </div>

            {/* Install Guide Modal */}
            {showInstallGuide && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowInstallGuide(false)}>
                    <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">앱 설치 방법</h3>
                            <button onClick={() => setShowInstallGuide(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
                                    <span className="text-xl">🍎</span> 아이폰 (Safari)
                                </h4>
                                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                                    <li>Safari 브라우저 하단의 <Share className="inline w-4 h-4 mx-1" /> <strong>공유 버튼</strong>을 누르세요.</li>
                                    <li>메뉴를 내려서 <PlusSquare className="inline w-4 h-4 mx-1" /> <strong>'홈 화면에 추가'</strong>를 선택하세요.</li>
                                    <li>우측 상단의 <strong>'추가'</strong>를 누르면 설치 완료!</li>
                                </ol>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
                                    <span className="text-xl">🤖</span> 안드로이드 (Chrome)
                                </h4>
                                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                                    <li>Chrome 브라우저 우측 상단의 <MoreVertical className="inline w-4 h-4 mx-1" /> <strong>메뉴 버튼</strong>을 누르세요.</li>
                                    <li><Download className="inline w-4 h-4 mx-1" /> <strong>'앱 설치'</strong> 또는 <strong>'홈 화면에 추가'</strong>를 선택하세요.</li>
                                    <li>안내에 따라 설치하면 완료!</li>
                                </ol>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowInstallGuide(false)}
                            className="w-full mt-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;
