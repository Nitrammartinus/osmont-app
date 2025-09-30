import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, ChevronLeft, Download } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const ProjectManagement: React.FC = () => {
    const { projects, toggleProjectStatus, costCenters } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showQRCodeData, setShowQRCodeData] = useState<{ project: Project, content: string } | null>(null);
    
    // This component does not add/edit projects, only toggles status
    // Add/edit functionality can be added if required

    const generateQRCode = (project: Project) => {
        setShowQRCodeData({ project, content: `PROJECT_ID:${project.id}` });
    };

    const getCostCenterName = (id: number) => {
        return costCenters.find(c => c.id === id)?.name || 'Neznáme';
    }

    if (showQRCodeData) {
        const qrId = `qr-canvas-${showQRCodeData.project.id}`;
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCodeData(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na Zoznam Projektov
                </button>
                <div className="text-center">
                     <div className="bg-gray-100 p-4 inline-block rounded-lg mb-4">
                        <QRCodeCanvas id={qrId} value={showQRCodeData.content} size={200} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCodeData.project.name}</p>
                     <button
                        onClick={() => {
                            const canvas = document.getElementById(qrId) as HTMLCanvasElement;
                            if (canvas) {
                                const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
                                let downloadLink = document.createElement("a");
                                downloadLink.href = pngUrl;
                                downloadLink.download = `qr_kod_projekt_${showQRCodeData.project.name.replace(/\s+/g, '_')}.png`;
                                document.body.appendChild(downloadLink);
                                downloadLink.click();
                                document.body.removeChild(downloadLink);
                            }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 mr-2" /> Stiahnuť PNG
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Projekty ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between">
                             <div className='mb-2 sm:mb-0'>
                                <p className="font-medium">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Uzatvorený' : 'Otvorený'}</span></p>
                                <p className="text-sm text-gray-600">Stredisko: {getCostCenterName(project.cost_center_id)}</p>
                            </div>
                            <div className="flex items-center space-x-2 self-start sm:self-center">
                                <button onClick={() => generateQRCode(project)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => toggleProjectStatus(project.id)} title={project.closed ? "Otvoriť" : "Uzatvoriť"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagement;
