import React, { useEffect, useRef } from 'react';
import { X } from './Icons';
import { Html5Qrcode } from 'html5-qrcode';
import { useTimeTracker } from '../hooks/useTimeTracker';

interface QRCodeScannerProps {
    onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
    const { processQRCode } = useTimeTracker();
    const readerId = "qr-reader";

    useEffect(() => {
        const html5QrCode = new Html5Qrcode(readerId);
        
        const startScanner = async () => {
            try {
                // FIX: Removed invalid 'rememberLastUsedCamera' property from the config object.
                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText: string) => {
                        html5QrCode.stop();
                        onClose();
                        processQRCode(decodedText);
                    },
                    (errorMessage: string) => { /* ignore */ }
                );
            } catch (err) {
                console.error("Failed to start QR scanner", err);
                alert("Nepodarilo sa spustiť kameru. Prosím, povoľte prístup ku kamere a obnovte stránku.");
                onClose();
            }
        };
        
        startScanner();

        return () => {
            html5QrCode.stop().catch(err => console.error("Failed to stop scanner cleanly.", err));
        };
    }, [onClose, processQRCode]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10 p-1 bg-white/50 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Naskenujte QR Kód</h3>
                <div id="qr-reader-container" className="w-full">
                    <div id={readerId} className="w-full"></div>
                </div>
                <p className="text-sm text-gray-500 mt-4 text-center">Umiestnite QR kód do rámčeka.</p>
            </div>
        </div>
    );
};

export default QRCodeScanner;
