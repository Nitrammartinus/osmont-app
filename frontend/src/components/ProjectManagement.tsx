import React, { useState, useRef } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, ChevronLeft, Download } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const ProjectManagement: React.FC = () => {
    const { projects, addProject, updateProject, deleteProject } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', budget: 0, deadline: '', estimatedHours: 0 });
    const [showQRCode, setShowQRCode] = useState<{ project: Project, content: string } | null>(null);
    const qrCodeRef = useRef<HTMLDivElement>(null);

    const handleAddProject = async () => {
        if (!newProject.name || !newProject.budget || !newProject.deadline) {
            alert('Prosím, vyplňte všetky polia pre nový projekt.');
            return;
        }
        await addProject({
            ...newProject,
            id: `proj${Date.now()}`,
            closed: false,
        });
        setNewProject({ name: '', budget: 0, deadline: '', estimatedHours: 0 });
        alert('Projekt úspešne pridaný!');
    };

    const handleUpdateProject = async () => {
        if (!editingProject) return;
        await updateProject(editingProject);
        setEditingProject(null);
        alert('Projekt úspešne aktualizovaný!');
    };

    const handleDeleteProject = async (projectId: string) => {
        if (window.confirm('Naozaj chcete vymazať tento projekt?')) {
            await deleteProject(projectId);
        }
    };
    
    const toggleProjectStatus = async (project: Project) => {
        await updateProject({ ...project, closed: !project.closed });
    };
    
    const generateQRCode = (project: Project) => {
        setShowQRCode({ project, content: `PROJECT_ID:${project.id}` });
    };

    const downloadQRCode = () => {
        if (qrCodeRef.current && showQRCode) {
            const canvas = qrCodeRef.current.querySelector('canvas');
            if (canvas) {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `qr_kod_projekt_${showQRCode.project.name.replace(/\s+/g, '_')}.png`;
                link.click();
            }
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
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.project.name}</p>
                    <div ref={qrCodeRef} className="bg-white p-4 inline-block rounded-lg border">
                        <QRCodeCanvas value={showQRCode.content} size={224} />
                    </div>
                     <p className="text-xs text-gray-500 mt-2 font-mono break-all">{showQRCode.content}</p>
                     <button
                        onClick={downloadQRCode}
                        className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 mr-2" /> Stiahnuť Obrázok
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
                            <label htmlFor="edit-project-name" className="block text-sm font-medium text-gray-700 mb-1">Názov Projektu</label>
                            <input id="edit-project-name" type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                         </div>
                         <div>
                            <label htmlFor="edit-project-budget" className="block text-sm font-medium text-gray-700 mb-1">Rozpočet (€)</label>
                            <input id="edit-project-budget" type="number" value={editingProject.budget} onChange={e => setEditingProject({...editingProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                         </div>
                         <div>
                            <label htmlFor="edit-project-deadline" className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                            <input id="edit-project-deadline" type="date" value={editingProject.deadline} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded-lg" />
                         </div>
                         <div>
                            <label htmlFor="edit-project-hours" className="block text-sm font-medium text-gray-700 mb-1">Odhadované Hodiny</label>
                            <input id="edit-project-hours" type="number" value={editingProject.estimatedHours || ''} onChange={e => setEditingProject({...editingProject, estimatedHours: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><FolderPlus className="w-5 h-5 mr-2 text-green-600" />Pridať nový projekt</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="new-project-name" className="block text-sm font-medium text-gray-700 mb-1">Názov Projektu</label>
                        <input id="new-project-name" type="text" value={newProject.name || ''} onChange={e => setNewProject({...newProject, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                     </div>
                     <div>
                        <label htmlFor="new-project-budget" className="block text-sm font-medium text-gray-700 mb-1">Rozpočet (€)</label>
                        <input id="new-project-budget" type="number" value={newProject.budget || ''} onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                     </div>
                     <div>
                        <label htmlFor="new-project-deadline" className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                        <input id="new-project-deadline" type="date" value={newProject.deadline || ''} onChange={e => setNewProject({...newProject, deadline: e.target.value})} className="w-full p-2 border rounded-lg" />
                     </div>
                     <div>
                        <label htmlFor="new-project-hours" className="block text-sm font-medium text-gray-700 mb-1">Odhadované Hodiny</label>
                        <input id="new-project-hours" type="number" value={newProject.estimatedHours || ''} onChange={e => setNewProject({...newProject, estimatedHours: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                     </div>
                </div>
                <button onClick={handleAddProject} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Pridať Projekt</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Projekty ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                             <div>
                                <p className="font-medium">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Uzatvorený' : 'Otvorený'}</span></p>
                                <p className="text-sm text-gray-600">Rozpočet: ${project.budget.toLocaleString()} | Deadline: {project.deadline}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => generateQRCode(project)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingProject(project)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleProjectStatus(project)} title={project.closed ? "Otvoriť" : "Uzatvoriť"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                <button onClick={() => handleDeleteProject(project.id)} title="Vymazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagement;
