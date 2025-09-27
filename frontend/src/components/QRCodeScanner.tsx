import React, { useEffect } from 'react';
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
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };

        const startScanner = () => {
             html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    if (html5QrCode && html5QrCode.isScanning) {
                        html5QrCode.stop().then(() => {
                             onScanSuccess(decodedText);
                        }).catch(err => {
                            console.error("Error stopping scanner after success:", err);
                            onScanSuccess(decodedText); // Proceed even if stop fails
                        });
                    }
                },
                (errorMessage: string) => {
                    // ignorovať chyby pri hľadaní kódu
                }
            ).catch((err) => {
                console.error("Nepodarilo sa spustiť QR skener", err);
                alert("Nepodarilo sa spustiť kameru. Prosím, povoľte prístup ku kamere a obnovte stránku.");
                onClose();
            });
        };
        
        startScanner();

        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch((err: any) => console.error("Nepodarilo sa zastaviť skener pri čistení", err));
            }
        };
    }, [onScanSuccess, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10 p-1 bg-white/50 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Naskenovať QR Kód</h3>
                <div className="w-full rounded-lg overflow-hidden relative">
                    <div id={readerId}></div>
                </div>
                <p className="text-sm text-gray-500 mt-4 text-center">Zamierte kameru na QR kód.</p>
            </div>
        </div>
    );
};

export default QRCodeScanner;
