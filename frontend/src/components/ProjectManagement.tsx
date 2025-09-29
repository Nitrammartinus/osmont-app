import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, ChevronLeft, Download } from './Icons';

const ProjectManagement: React.FC = () => {
    const { projects, addProject, updateProject, deleteProject, costCenters } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: '' });
    const [showQRCode, setShowQRCode] = useState<{ project: Project, content: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAddProject = async () => {
        if (!newProject.name || !newProject.budget || !newProject.deadline || !newProject.cost_center_id) {
            alert('Prosím, vyplňte všetky polia pre nový projekt.');
            return;
        }
        setLoading(true);
        const success = await addProject({
            name: newProject.name,
            budget: Number(newProject.budget),
            deadline: newProject.deadline,
            estimated_hours: Number(newProject.estimated_hours) || undefined,
            cost_center_id: newProject.cost_center_id
        });
        setLoading(false);
        if (success) {
            setNewProject({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: '' });
        }
    };

    const handleUpdateProject = async () => {
        if (!editingProject) return;
        setLoading(true);
        const projectToUpdate: Project = {
            ...editingProject,
            estimated_hours: Number(editingProject.estimated_hours) || undefined,
        };
        const success = await updateProject(projectToUpdate);
        setLoading(false);
        if (success) {
            setEditingProject(null);
        }
    };

    const handleDeleteProject = (projectId: string) => {
        if (window.confirm('Naozaj chcete zmazať tento projekt?')) {
            deleteProject(projectId);
        }
    };
    
    const toggleProjectStatus = (project: Project) => {
        updateProject({ ...project, closed: !project.closed });
    };
    
    const generateQRCode = (project: Project) => {
        setShowQRCode({ project, content: `PROJECT_ID:${project.id}` });
    };

    if (showQRCode) {
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na zoznam
                </button>
                <div className="text-center">
                    <QrCode className="w-24 h-24 text-green-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.project.name}</p>
                    <div className="bg-gray-100 p-4 rounded-lg mb-4 break-all font-mono">{showQRCode.content}</div>
                     <button
                        onClick={() => {
                            const blob = new Blob([showQRCode.content], { type: 'text/plain' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `project_qr_${showQRCode.project.name.replace(/\s+/g, '_')}.txt`;
                            link.click();
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
                         <input type="text" placeholder="Názov projektu" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded" />
                         <input type="number" placeholder="Rozpočet" value={editingProject.budget} onChange={e => setEditingProject({...editingProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded" />
                         <input type="date" value={editingProject.deadline.split('T')[0]} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded" />
                         <input type="number" placeholder="Odhadované hodiny" value={editingProject.estimated_hours || ''} onChange={e => setEditingProject({...editingProject, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded" />
                         <select value={editingProject.cost_center_id} onChange={e => setEditingProject({...editingProject, cost_center_id: e.target.value})} className="w-full p-2 border rounded">
                            <option value="">-- Vyberte stredisko --</option>
                            {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                         <div className="flex space-x-2">
                            <button onClick={handleUpdateProject} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Ukladám...' : 'Uložiť'}</button>
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
                    <input type="number" placeholder="Rozpočet" value={newProject.budget || ''} onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded" />
                    <input type="date" value={newProject.deadline || ''} onChange={e => setNewProject({...newProject, deadline: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="number" placeholder="Odhadované hodiny" value={newProject.estimated_hours || ''} onChange={e => setNewProject({...newProject, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded" />
                    <select value={newProject.cost_center_id} onChange={e => setNewProject({...newProject, cost_center_id: e.target.value})} className="w-full p-2 border rounded md:col-span-2">
                        <option value="">-- Vyberte nákladové stredisko --</option>
                        {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <button onClick={handleAddProject} disabled={loading} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Pridávam...' : 'Pridať Projekt'}</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Projekty ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between flex-wrap">
                             <div className="mb-2 sm:mb-0">
                                <p className="font-medium">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Uzatvorený' : 'Otvorený'}</span></p>
                                <p className="text-sm text-gray-600">Rozpočet: {project.budget.toLocaleString()} € | Deadline: {new Date(project.deadline).toLocaleDateString('sk-SK')}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => generateQRCode(project)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingProject(project)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleProjectStatus(project)} title={project.closed ? "Otvoriť" : "Uzatvoriť"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                <button onClick={() => handleDeleteProject(project.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagement;
