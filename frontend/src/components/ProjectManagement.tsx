import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, ChevronLeft, Download, Building2 } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const ProjectManagement: React.FC = () => {
    const { projects, costCenters, addProject, updateProject, deleteProject, toggleProjectStatus } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: undefined });
    const [showQRCode, setShowQRCode] = useState<{ project: Project, content: string } | null>(null);

    const handleAddProject = async () => {
        if (!newProject.name || !newProject.budget || !newProject.deadline || !newProject.cost_center_id) {
            alert('Prosím, vyplňte všetky polia pre nový projekt.');
            return;
        }
        await addProject({
            name: newProject.name,
            budget: Number(newProject.budget),
            deadline: newProject.deadline,
            cost_center_id: Number(newProject.cost_center_id),
            estimated_hours: Number(newProject.estimated_hours) || undefined,
        });
        setNewProject({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: undefined });
    };

    const handleUpdateProject = async () => {
        if (!editingProject) return;
        const projectToUpdate = {
            ...editingProject,
            estimated_hours: Number(editingProject.estimated_hours) || undefined,
        }
        await updateProject(projectToUpdate);
        setEditingProject(null);
    };
    
    const generateQRCode = (project: Project) => {
        setShowQRCode({ project, content: `PROJECT_ID:${project.id}` });
    };

    const formatDateForInput = (dateString: string) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    if (showQRCode) {
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na zoznam projektov
                </button>
                <div className="text-center">
                    <div className="p-4 bg-white inline-block rounded-lg border">
                       <QRCodeCanvas id={`qr-${showQRCode.project.id}`} value={showQRCode.content} size={256} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mt-4">QR kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.project.name}</p>
                    <button
                        onClick={() => {
                             const canvas = document.getElementById(`qr-${showQRCode.project.id}`) as HTMLCanvasElement;
                            if (canvas) {
                                const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
                                let downloadLink = document.createElement("a");
                                downloadLink.href = pngUrl;
                                downloadLink.download = `project_qr_${showQRCode.project.name.replace(/\s+/g, '_')}.png`;
                                document.body.appendChild(downloadLink);
                                downloadLink.click();
                                document.body.removeChild(downloadLink);
                            }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 mr-2" /> Stiahnuť
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
                         <div>
                            <label className="text-sm font-medium text-gray-700">Názov projektu</label>
                            <input type="text" placeholder="Názov projektu" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded mt-1" />
                         </div>
                         <div>
                            <label className="text-sm font-medium text-gray-700">Rozpočet (€)</label>
                            <input type="number" placeholder="Rozpočet" value={editingProject.budget} onChange={e => setEditingProject({...editingProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded mt-1" />
                         </div>
                         <div>
                            <label className="text-sm font-medium text-gray-700">Deadline</label>
                            <input type="date" value={formatDateForInput(editingProject.deadline)} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded mt-1" />
                         </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Odhadované hodiny</label>
                            <input type="number" placeholder="Odhadované hodiny" value={editingProject.estimated_hours || ''} onChange={e => setEditingProject({...editingProject, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded mt-1" />
                         </div>
                         <div>
                            <label className="text-sm font-medium text-gray-700">Stredisko</label>
                            <select value={editingProject.cost_center_id} onChange={e => setEditingProject({...editingProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded mt-1">
                                {costCenters.map(center => (
                                    <option key={center.id} value={center.id}>{center.name}</option>
                                ))}
                            </select>
                         </div>
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
                    <input type="text" placeholder="Názov projektu" value={newProject.name || ''} onChange={e => setNewProject({...newProject, name: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="number" placeholder="Rozpočet (€)" value={newProject.budget || ''} onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded" />
                    <input type="date" value={newProject.deadline || ''} onChange={e => setNewProject({...newProject, deadline: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="number" placeholder="Odhadované hodiny" value={newProject.estimated_hours || ''} onChange={e => setNewProject({...newProject, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded" />
                     <div className="md:col-span-2">
                         <select value={newProject.cost_center_id || ''} onChange={e => setNewProject({...newProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded">
                             <option value="" disabled>Vyberte stredisko...</option>
                            {costCenters.map(center => (
                                <option key={center.id} value={center.id}>{center.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button onClick={handleAddProject} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Pridať Projekt</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Projekty ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between">
                             <div>
                                <p className="font-medium">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Uzatvorený' : 'Otvorený'}</span></p>
                                <p className="text-sm text-gray-600">Deadline: {new Date(project.deadline).toLocaleDateString('sk-SK')}</p>
                                <div className="flex items-center text-xs text-gray-500 mt-1">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    <span>{project.cost_center_name || 'Neznáme'}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                                <button onClick={() => generateQRCode(project)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingProject(project)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={async () => await toggleProjectStatus(project.id)} title={project.closed ? "Otvoriť" : "Uzatvoriť"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                <button onClick={async () => await deleteProject(project.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagement;
