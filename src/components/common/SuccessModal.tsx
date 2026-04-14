import React, { useEffect } from 'react';
import { Check } from 'lucide-react';

interface SuccessModalProps {
    isOpen: boolean;
    message: string;
    onClose: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, message, onClose }) => {
    useEffect(() => {
        if (isOpen) {
            // Auto close after 3 seconds if user doesn't click
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm transform transition-all animate-in zoom-in-95 duration-200 p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">저장 완료!</h3>
                <p className="text-gray-600 mb-6 font-medium whitespace-pre-wrap">{message}</p>

                <button
                    onClick={onClose}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition-transform active:scale-95"
                >
                    확인
                </button>
            </div>
        </div>
    );
};

export default SuccessModal;
