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
        let scannerRunning = true;

        const startScanner = async () => {
            try {
                if (!scannerRunning) return;
                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                            const qrboxSize = Math.floor(minEdge * 0.7);
                            return { width: qrboxSize, height: qrboxSize };
                        },
                        // FIX: Removed unsupported 'supportedScanTypes' property.
                    },
                    (decodedText: string) => {
                        if (scannerRunning) {
                            onScanSuccess(decodedText);
                        }
                    },
                    (errorMessage: string) => {
                        // ignorovať
                    }
                );
            } catch (err) {
                 if (scannerRunning) {
                    console.error("Nepodarilo sa spustiť QR skener", err);
                    alert("Nepodarilo sa spustiť kameru. Prosím, povoľte prístup ku kamere a obnovte stránku.");
                    onClose();
                 }
            }
        };
        
        startScanner();

        return () => {
            scannerRunning = false;
            // Use .isScanning to prevent errors if the scanner never started
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch((err: any) => console.error("Nepodarilo sa zastaviť skener", err));
            }
        };
    }, [onScanSuccess, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10 p-1 bg-white/50 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Naskenovať QR kód</h3>
                <div id={readerId} className="w-full aspect-video rounded-lg overflow-hidden"></div>
                <p className="text-sm text-gray-500 mt-4 text-center">Namierte kameru na QR kód.</p>
            </div>
        </div>
    );
};

export default QRCodeScanner;
