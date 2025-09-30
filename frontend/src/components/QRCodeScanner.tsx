import React, { useEffect, useRef } from 'react';
import { X } from './Icons';
import { Html5Qrcode, Html5QrcodeScanType } from 'html5-qrcode';

interface QRCodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScanSuccess, onClose }) => {
    const readerId = "qr-reader";

    useEffect(() => {
        const html5QrCode = new Html5Qrcode(readerId);
        
        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                            const qrboxSize = Math.floor(minEdge * 0.7);
                            return { width: qrboxSize, height: qrboxSize };
                        },
                    },
                    (decodedText: string, decodedResult: any) => {
                        onScanSuccess(decodedText);
                    },
                    (errorMessage: string) => {
                        // ignore
                    }
                );
            } catch (err) {
                console.error("Nepodarilo sa spustiť QR skener", err);
                alert("Nepodarilo sa spustiť kameru. Prosím, povoľte prístup ku kamere a obnovte stránku.");
                onClose();
            }
        };
        
        startScanner();

        return () => {
            html5QrCode.stop().catch((err: any) => console.error("Nepodarilo sa zastaviť skener", err));
        };
    }, [onScanSuccess, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-xl p-4 w-full max-w-lg relative aspect-video">
                <button onClick={onClose} className="absolute top-2 right-2 text-white hover:text-gray-300 z-20 p-2 bg-black/30 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <div id={readerId} className="w-full h-full rounded-lg overflow-hidden"></div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <p className="text-white bg-black/50 px-4 py-2 rounded-lg">Umiestnite QR kód do rámika</p>
                </div>
            </div>
        </div>
    );
};

export default QRCodeScanner;
