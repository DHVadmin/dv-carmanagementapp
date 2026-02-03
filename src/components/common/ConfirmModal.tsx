import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
    confirmText?: string;
    isDestructive?: boolean;
    showCancel?: boolean;
}

import ReactDOM from 'react-dom';

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onClose, confirmText = '삭제', isDestructive = true, showCancel = true }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" style={{ pointerEvents: 'auto' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm transform transition-all animate-in zoom-in-95 duration-200 p-6 flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100' : 'bg-blue-100'}`}>
                    <AlertTriangle className={`w-8 h-8 ${isDestructive ? 'text-red-600' : 'text-blue-600'}`} strokeWidth={2.5} />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 mb-6 font-medium whitespace-pre-wrap">{message}</p>

                <div className="flex w-full space-x-3">
                    {showCancel && (
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-lg transition-colors"
                        >
                            취소
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-3 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95 text-white ${isDestructive
                            ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};


export default ConfirmModal;
