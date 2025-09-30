import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, Download, Building2 } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const ProjectManagement: React.FC = () => {
    const { projects, toggleProjectStatus, costCenters } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showQRCode, setShowQRCode] = useState<{ project: Project, content: string } | null>(null);

    const generateQRCode = (project: Project) => {
        setShowQRCode({ project, content: `PROJECT_ID:${project.id}` });
    };

    if (showQRCode) {
        const qrId = `qr-canvas-project-${showQRCode.project.id}`;
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.project.name}</p>
                    <div className="bg-white p-4 inline-block rounded-lg border">
                        <QRCodeCanvas id={qrId} value={showQRCode.content} size={200} />
                    </div>
                     <div className="mt-4 space-y-2">
                         <button
                            onClick={() => {
                                const canvas = document.getElementById(qrId) as HTMLCanvasElement;
                                const link = document.createElement('a');
                                link.href = canvas.toDataURL("image/png");
                                link.download = `qr_kod_projekt_${showQRCode.project.name.replace(/\s+/g, '_')}.png`;
                                link.click();
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                            <Download className="w-4 h-4 mr-2" /> Stiahnuť PNG
                        </button>
                        <button onClick={() => setShowQRCode(null)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg">Zavrieť</button>
                    </div>
                </div>
            </div>
        );
    }

    if (editingProject) {
        return (
            <div className="max-w-2xl mx-auto">
                 <div className="bg-white rounded-2xl shadow-xl p-6">
                     <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Edit className="w-5 h-5 mr-2 text-green-600" />Upraviť Projekt: {editingProject.name}</h3>
                     <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Názov Projektu</label>
                            <input type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded mt-1" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Rozpočet (€)</label>
                            <input type="number" value={editingProject.budget} onChange={e => setEditingProject({...editingProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded mt-1" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Deadline</label>
                            <input type="date" value={editingProject.deadline.split('T')[0]} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Stredisko</label>
                            <select value={editingProject.cost_center_id} onChange={e => setEditingProject({...editingProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded mt-1">
                                {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Odhadované Hodiny</label>
                            <input type="number" value={editingProject.estimated_hours || ''} onChange={e => setEditingProject({...editingProject, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded mt-1" />
                         </div>
                         <div className="flex space-x-2 pt-4 border-t">
                            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Uložiť</button>
                            <button onClick={() => setEditingProject(null)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Zrušiť</button>
                         </div>
                     </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Form for adding a new project can be added here if needed */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Projekty ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                             <div className='flex-1'>
                                <p className="font-medium">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Uzatvorený' : 'Otvorený'}</span></p>
                                <p className="text-sm text-gray-600">Rozpočet: {project.budget.toLocaleString()} € | Deadline: {new Date(project.deadline).toLocaleDateString()}</p>
                                <div className="mt-2 flex flex-wrap gap-1 items-center">
                                    <Building2 className="w-4 h-4 text-gray-500"/>
                                    <span className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full">{project.cost_center_name || 'Neznáme'}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1 self-end sm:self-center">
                                <button onClick={() => generateQRCode(project)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingProject(project)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
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
