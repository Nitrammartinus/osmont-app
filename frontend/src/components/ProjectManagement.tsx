
import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project, CostCenter } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, Download } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const ProjectManagement: React.FC = () => {
    const { projects, costCenters, toggleProjectStatus } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showQRCode, setShowQRCode] = useState<{ project: Project, content: string } | null>(null);

    const downloadQRCode = (projectId: string) => {
        const canvas = document.getElementById(`qr-code-${projectId}`) as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
            let downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `project_qr_${projectId}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };
    
    // Placeholder functions, budú nahradené
    const handleUpdateProject = () => {};
    const handleDeleteProject = (id:string) => {};
    const handleAddProject = () => {};
    const setNewProject = (p:any) => {};
    const newProject = {} as Partial<Project>;


    if (showQRCode) {
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.project.name}</p>
                    <div className="bg-white p-4 inline-block border rounded-lg">
                        <QRCodeCanvas id={`qr-code-${showQRCode.project.id}`} value={showQRCode.content} size={200} />
                    </div>
                     <div className="mt-4 space-y-2">
                        <button onClick={() => downloadQRCode(showQRCode.project.id)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                            <Download className="w-4 h-4 mr-2" /> Stiahnuť PNG
                        </button>
                        <button onClick={() => setShowQRCode(null)} className="w-full bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Zavrieť</button>
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
                            <label className="block text-sm font-medium text-gray-700">Názov projektu</label>
                            <input type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Rozpočet (€)</label>
                            <input type="number" value={editingProject.budget} onChange={e => setEditingProject({...editingProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Deadline</label>
                            <input type="date" value={editingProject.deadline.split('T')[0]} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Stredisko</label>
                            <select value={editingProject.cost_center_id} onChange={e => setEditingProject({...editingProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded-md">
                                {costCenters.map(center => <option key={center.id} value={center.id}>{center.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Odhadované hodiny</label>
                            <input type="number" value={editingProject.estimated_hours ?? ''} onChange={e => setEditingProject({...editingProject, estimated_hours: e.target.value === '' ? undefined : Number(e.target.value)})} className="w-full p-2 border rounded-md" />
                        </div>
                         <div className="flex space-x-2 pt-2">
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
                    {/* formulár na pridanie projektu */}
                </div>
                <button onClick={handleAddProject} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Pridať Projekt</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Projekty ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map((project: Project) => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                             <div className="flex-grow">
                                <p className="font-medium flex items-center">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Uzatvorený' : 'Otvorený'}</span></p>
                                <p className="text-sm text-gray-600">Rozpočet: {project.budget.toLocaleString()} € | Deadline: {new Date(project.deadline).toLocaleDateString()}</p>
                                <p className="text-xs text-gray-500 mt-1">{project.cost_center_name}</p>
                            </div>
                            <div className="flex items-center space-x-1 self-end sm:self-center">
                                <button onClick={() => setShowQRCode({ project, content: `PROJECT_ID:${project.id}` })} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingProject(project)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleProjectStatus(project.id)} title={project.closed ? "Otvoriť" : "Uzamknúť"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagement;
