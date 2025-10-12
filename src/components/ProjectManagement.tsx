import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, ChevronLeft, Download } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const ProjectManagement: React.FC = () => {
    const { projects, toggleProjectStatus, costCenters, addProject, updateProject, deleteProject } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', budget: 0, deadline: '', estimated_hours: undefined, cost_center_id: undefined });
    const [showQRCodeData, setShowQRCodeData] = useState<{ project: Project, content: string } | null>(null);
    
    const handleAddProject = async () => {
        if (!newProject.name || !newProject.deadline || newProject.cost_center_id === undefined) {
            alert('Názov, deadline a stredisko sú povinné.');
            return;
        }
        await addProject({
            name: newProject.name,
            budget: newProject.budget || undefined,
            deadline: newProject.deadline,
            estimated_hours: newProject.estimated_hours || undefined,
            cost_center_id: newProject.cost_center_id,
        });
        setNewProject({ name: '', budget: 0, deadline: '', estimated_hours: undefined, cost_center_id: undefined });
    };

    const handleUpdateProject = async () => {
        if (!editingProject) return;
        await updateProject(editingProject);
        setEditingProject(null);
    };

    const generateQRCode = (project: Project) => {
        setShowQRCodeData({ project, content: `PROJECT_ID:${project.id}` });
    };

    const getCostCenterName = (id: number | undefined) => {
        if (id === undefined) return 'N/A';
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
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCodeData.project.name}</p>
                     <div className="bg-gray-100 p-4 inline-block rounded-lg mb-4">
                        <QRCodeCanvas id={qrId} value={showQRCodeData.content} size={200} />
                    </div>
                     <button
                        onClick={() => {
                            const canvas = document.getElementById(qrId) as HTMLCanvasElement;
                            if (!canvas) return;

                            const PADDING = 20;
                            const FONT_SIZE = 16;
                            const TEXT_MARGIN_TOP = 10;
                            
                            const compositeCanvas = document.createElement('canvas');
                            const ctx = compositeCanvas.getContext('2d');
                            if (!ctx) return;

                            compositeCanvas.width = canvas.width + PADDING * 2;
                            compositeCanvas.height = canvas.height + PADDING * 2 + FONT_SIZE + TEXT_MARGIN_TOP;
                            
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
                            
                            ctx.drawImage(canvas, PADDING, PADDING);
                            
                            ctx.fillStyle = 'black';
                            ctx.font = `bold ${FONT_SIZE}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.fillText(showQRCodeData.project.name, compositeCanvas.width / 2, canvas.height + PADDING + TEXT_MARGIN_TOP + FONT_SIZE / 2);

                            const pngUrl = compositeCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
                            let downloadLink = document.createElement("a");
                            downloadLink.href = pngUrl;
                            downloadLink.download = `qr_kod_projekt_${showQRCodeData.project.name.replace(/\s+/g, '_')}.png`;
                            document.body.appendChild(downloadLink);
                            downloadLink.click();
                            document.body.removeChild(downloadLink);
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 mr-2" /> Stiahnuť PNG
                    </button>
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
                        <input type="text" placeholder="Názov Projektu" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                        <input type="number" placeholder="Rozpočet (€)" value={editingProject.budget || ''} onChange={e => setEditingProject({...editingProject, budget: e.target.value ? Number(e.target.value) : null })} className="w-full p-2 border rounded-lg" />
                        <input type="date" value={editingProject.deadline?.split('T')[0] || ''} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded-lg" />
                        <select value={editingProject.cost_center_id} onChange={e => setEditingProject({...editingProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded-lg">
                           <option value="">Vyberte stredisko</option>
                           {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <input type="number" placeholder="Odhadované hodiny" value={editingProject.estimated_hours || ''} onChange={e => setEditingProject({...editingProject, estimated_hours: e.target.value ? Number(e.target.value) : null })} className="w-full p-2 border rounded-lg" />
                         <div className="flex space-x-2">
                            <button onClick={handleUpdateProject} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Uložiť</button>
                            <button onClick={() => setEditingProject(null)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Zrušiť</button>
                         </div>
                     </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><FolderPlus className="w-5 h-5 mr-2 text-green-600" />Pridať Nový Projekt</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Názov Projektu" value={newProject.name || ''} onChange={e => setNewProject({...newProject, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                    <input type="number" placeholder="Rozpočet (€)" value={newProject.budget || ''} onChange={e => setNewProject({...newProject, budget: e.target.value ? Number(e.target.value) : undefined})} className="w-full p-2 border rounded-lg" />
                    <input type="date" value={newProject.deadline || ''} onChange={e => setNewProject({...newProject, deadline: e.target.value})} className="w-full p-2 border rounded-lg" />
                    <select value={newProject.cost_center_id || ''} onChange={e => setNewProject({...newProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded-lg">
                       <option value="" disabled>Vyberte stredisko</option>
                       {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="number" placeholder="Odhadované hodiny" value={newProject.estimated_hours || ''} onChange={e => setNewProject({...newProject, estimated_hours: e.target.value ? Number(e.target.value) : undefined})} className="w-full p-2 border rounded-lg" />
                </div>
                <button onClick={handleAddProject} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Pridať Projekt</button>
            </div>
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
                                <button onClick={() => setEditingProject(project)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleProjectStatus(project.id)} title={project.closed ? "Otvoriť" : "Uzatvoriť"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                <button onClick={() => deleteProject(project.id)} title="Vymazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagement;