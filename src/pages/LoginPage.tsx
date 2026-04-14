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
                    setError('?‘ê·¼ ê¶Œí•œ???†ìŠµ?ˆë‹¤. @together63.kr ê³„ì •?¼ë¡œë§?ë¡œê·¸?¸í•  ???ˆìŠµ?ˆë‹¤.');
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
            setError('@together63.kr ?´ë©”?¼ë§Œ ?¬ìš©?????ˆìŠµ?ˆë‹¤.');
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
                setError('?´ë? ?¬ìš© ì¤‘ì¸ ?´ë©”?¼ì…?ˆë‹¤.');
            } else if (err.code === 'auth/invalid-email') {
                setError('? íš¨?˜ì? ?Šì? ?´ë©”???•ì‹?…ë‹ˆ??');
            } else if (err.code === 'auth/weak-password') {
                setError('ë¹„ë?ë²ˆí˜¸??6???´ìƒ?´ì–´???©ë‹ˆ??');
            } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('?´ë©”???ëŠ” ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.');
            } else {
                setError('?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ' + err.message);
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 relative">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        ?™í–‰ë¹Œë¦¬ì§€ ì°¨ëŸ‰ê´€ë¦?<span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full align-middle">v5.5.3</span>
                    </h2>
                    <div className="mt-8 text-center text-gray-500 text-xs">
                        <p>Â© 2024 Donghaeng Village. All rights reserved.</p>

                    </div>
                </div>

                {error && <p className="text-red-500 text-sm mb-6 text-center bg-red-50 p-3 rounded-lg">{error}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">?´ë¦„</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="?¤ëª… ?…ë ¥"
                                required={isSignUp}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">?´ë©”??/label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">ë¹„ë?ë²ˆí˜¸</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="6???´ìƒ ?…ë ¥"
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
                        {isLoading ? 'ì²˜ë¦¬ ì¤?..' : (isSignUp ? '?Œì›ê°€?? : 'ë¡œê·¸??)}
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
                            ? '?´ë? ê³„ì •???ˆìœ¼? ê??? ë¡œê·¸?¸í•˜ê¸?
                            : 'ê³„ì •???†ìœ¼? ê??? ?Œì›ê°€?…í•˜ê¸?}
                    </button>

                    <button
                        onClick={() => setShowInstallGuide(true)}
                        className="text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1 mx-auto"
                    >
                        <HelpCircle size={14} /> ???¤ì¹˜ ë°©ë²•
                    </button>
                </div>


            </div>

            {/* Install Guide Modal */}
            {showInstallGuide && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowInstallGuide(false)}>
                    <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">???¤ì¹˜ ë°©ë²•</h3>
                            <button onClick={() => setShowInstallGuide(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
                                    <span className="text-xl">?</span> ?„ì´??(Safari)
                                </h4>
                                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                                    <li>Safari ë¸Œë¼?°ì? ?˜ë‹¨??<Share className="inline w-4 h-4 mx-1" /> <strong>ê³µìœ  ë²„íŠ¼</strong>???„ë¥´?¸ìš”.</li>
                                    <li>ë©”ë‰´ë¥??´ë ¤??<PlusSquare className="inline w-4 h-4 mx-1" /> <strong>'???”ë©´??ì¶”ê?'</strong>ë¥?? íƒ?˜ì„¸??</li>
                                    <li>?°ì¸¡ ?ë‹¨??<strong>'ì¶”ê?'</strong>ë¥??„ë¥´ë©??¤ì¹˜ ?„ë£Œ!</li>
                                </ol>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
                                    <span className="text-xl">?¤–</span> ?ˆë“œë¡œì´??(Chrome)
                                </h4>
                                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                                    <li>Chrome ë¸Œë¼?°ì? ?°ì¸¡ ?ë‹¨??<MoreVertical className="inline w-4 h-4 mx-1" /> <strong>ë©”ë‰´ ë²„íŠ¼</strong>???„ë¥´?¸ìš”.</li>
                                    <li><Download className="inline w-4 h-4 mx-1" /> <strong>'???¤ì¹˜'</strong> ?ëŠ” <strong>'???”ë©´??ì¶”ê?'</strong>ë¥?? íƒ?˜ì„¸??</li>
                                    <li>?ˆë‚´???°ë¼ ?¤ì¹˜?˜ë©´ ?„ë£Œ!</li>
                                </ol>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowInstallGuide(false)}
                            className="w-full mt-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg transition-colors"
                        >
                            ?«ê¸°
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;
