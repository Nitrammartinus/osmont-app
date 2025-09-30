
import React, { useEffect } from 'react';
import { X } from './Icons';
import { Html5Qrcode } from 'html5-qrcode';

interface QRCodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScanSuccess, onClose }) => {
    const readerId = "qr-reader";

    useEffect(() => {
        let html5QrCode: Html5Qrcode | undefined;
        const config = {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdge * 0.7);
                return {
                    width: qrboxSize,
                    height: qrboxSize,
                };
            },
            rememberLastUsedCamera: true,
        };

        const startScanner = async () => {
            try {
                html5QrCode = new Html5Qrcode(readerId);
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string, decodedResult: any) => {
                        onScanSuccess(decodedText);
                    },
                    (errorMessage: string) => {
                        // ignore error
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
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch((err: any) => console.error("Nepodarilo sa zastaviť skener", err));
            }
        };
    }, [onScanSuccess, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-xl p-4 w-full max-w-lg relative aspect-video">
                <button onClick={onClose} className="absolute top-2 right-2 text-white hover:text-gray-300 z-10 p-2 bg-black/30 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <div id={readerId} className="w-full h-full rounded-lg overflow-hidden aspect-video"></div>
            </div>
        </div>
    );
};

export default QRCodeScanner;
