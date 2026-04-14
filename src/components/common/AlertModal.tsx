import React, { useEffect } from 'react';
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

interface AlertModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'error' | 'success';
    // Optional detailed checklist or info
    details?: string[];
    onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({ isOpen, title, message, type, details, onClose }) => {
    useEffect(() => {
        if (isOpen) {
            // Auto-focus logic or screen reader announcements could go here
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'warning': return <AlertTriangle className="w-8 h-8 text-amber-500" />;
            case 'error': return <XCircle className="w-8 h-8 text-rose-500" />;
            case 'success': return <CheckCircle className="w-8 h-8 text-emerald-500" />;
        }
    };

    const getColorClasses = () => {
        switch (type) {
            case 'warning': return 'bg-amber-50 border-amber-100 text-amber-900';
            case 'error': return 'bg-rose-50 border-rose-100 text-rose-900';
            case 'success': return 'bg-emerald-50 border-emerald-100 text-emerald-900';
        }
    };

    const getButtonClasses = () => {
        switch (type) {
            case 'warning': return 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-200';
            case 'error': return 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-200';
            case 'success': return 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-200';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className={`w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border-t-4 ${type === 'warning' ? 'border-amber-500' : type === 'error' ? 'border-rose-500' : 'border-emerald-500'
                }`}>
                <div className="p-6">
                    <div className="flex items-start mb-4">
                        <div className={`p-3 rounded-full shrink-0 ${getColorClasses()} mr-4`}>
                            {getIcon()}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{message}</p>

                            {details && details.length > 0 && (
                                <ul className="mt-3 bg-gray-50 rounded-lg p-3 space-y-1">
                                    {details.map((detail, idx) => (
                                        <li key={idx} className="text-xs text-gray-500 flex items-start">
                                            <span className="mr-1.5">•</span>
                                            {detail}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className={`px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-colors shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 ${getButtonClasses()}`}
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
