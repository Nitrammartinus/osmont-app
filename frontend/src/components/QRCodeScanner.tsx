import React, { useEffect, useRef } from 'react';
import { X } from './Icons';
import { Html5Qrcode, Html5QrcodeScanType } from 'html5-qrcode';

interface QRCodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScanSuccess, onClose }) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const readerId = "qr-reader";

    useEffect(() => {
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };

        const html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string, decodedResult: any) => {
                        onScanSuccess(decodedText);
                    },
                    (errorMessage: string) => {
                        // ignore
                    }
                );
            } catch (err) {
                console.error("Failed to start QR scanner", err);
                alert("Could not start camera. Please grant camera permissions and refresh the page.");
                onClose();
            }
        };
        
        startScanner();

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop()
                    .catch((err: any) => console.error("Failed to stop scanner", err));
            }
        };
    }, [onScanSuccess, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10 p-1 bg-white/50 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Scan QR Code</h3>
                <div id={readerId} className="w-full rounded-lg overflow-hidden border-2 border-gray-300"></div>
                <p className="text-sm text-gray-500 mt-4 text-center">Point your camera at a QR code.</p>
            </div>
        </div>
    );
};

export default QRCodeScanner;