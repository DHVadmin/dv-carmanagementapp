import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ReasonModalProps {
    isOpen: boolean;
    title: string;
    message?: string;
    onSubmit: (reason: string) => void;
    onClose: () => void;
}

const ReasonModal: React.FC<ReasonModalProps> = ({ isOpen, title, message, onSubmit, onClose }) => {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isOpen) setReason('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {message && <p className="text-gray-600 mb-4 text-sm">{message}</p>}
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none h-32 text-sm"
                        placeholder="사유를 입력해주세요..."
                        autoFocus
                    />
                </div>

                <div className="flex p-4 bg-gray-50 gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => {
                            if (!reason.trim()) {
                                alert('사유를 입력해주세요.');
                                return;
                            }
                            onSubmit(reason);
                            onClose();
                        }}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-200"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReasonModal;
