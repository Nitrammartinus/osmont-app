import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from './Icons';
import { Html5Qrcode, Html5QrcodeScanType } from 'html5-qrcode';

interface QRCodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScanSuccess, onClose }) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const readerId = "qr-reader";
    const navigate = useNavigate();

    useEffect(() => {
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
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };

        const html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string) => {
                        onScanSuccess(decodedText);
                    },
                    (errorMessage: string) => {
                        // ignore error
                    }
                );
            } catch (err) {
                console.error("Chyba pri spúšťaní QR skenera", err);
                alert("Nepodarilo sa spustiť kameru. Prosím, povoľte prístup ku kamere a obnovte stránku.");
                onClose();
            }
        };
        
        Html5Qrcode.getCameras().then(cameras => {
            if (cameras && cameras.length) {
                startScanner();
            } else {
                 alert("Nenašla sa žiadna kamera. Pripojte kameru a skúste to znova.");
                 onClose();
            }
        }).catch(err => {
             console.error("Chyba pri prístupe ku kamere", err);
             alert("Prístup ku kamere bol zamietnutý. Prosím, povoľte ho v nastaveniach prehliadača.");
             onClose();
        });

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop()
                    .catch((err: any) => console.error("Nepodarilo sa zastaviť skener", err));
            }
        };
    }, [onScanSuccess, onClose, navigate]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10 p-1 bg-white/50 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Naskenujte QR Kód</h3>
                <div id={readerId} className="w-full rounded-lg overflow-hidden"></div>
                <p className="text-sm text-gray-500 mt-4 text-center">Umiestnite QR kód do rámčeka.</p>
            </div>
        </div>
    );
};

export default QRCodeScanner;
