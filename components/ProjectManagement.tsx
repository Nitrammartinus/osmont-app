
import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, ChevronLeft, Download } from './Icons';

const ProjectManagement: React.FC = () => {
    const { projects, setProjects } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    // FIX: Use new project fields in initial state
    const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: undefined });
    const [showQRCode, setShowQRCode] = useState<{ project: Project, content: string } | null>(null);

    // FIX: Handle new project fields on creation
    const handleAddProject = () => {
        if (!newProject.name || !newProject.budget || !newProject.deadline || !newProject.cost_center_id) {
            alert('Please fill all fields for the new project.');
            return;
        }
        const projectToAdd: Project = {
            id: `proj${Date.now()}`,
            name: newProject.name,
            budget: Number(newProject.budget),
            deadline: newProject.deadline,
            closed: false,
            estimated_hours: Number(newProject.estimated_hours) || undefined,
            cost_center_id: Number(newProject.cost_center_id),
        };
        setProjects(prev => [...prev, projectToAdd]);
        setNewProject({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: undefined });
    };

    // FIX: Handle new project fields on update
    const handleUpdateProject = () => {
        if (!editingProject) return;
        const projectToUpdate = {
            ...editingProject,
            budget: Number(editingProject.budget),
            cost_center_id: Number(editingProject.cost_center_id),
            estimated_hours: Number(editingProject.estimated_hours) || undefined,
        }
        setProjects(prev => prev.map(p => p.id === editingProject.id ? projectToUpdate : p));
        setEditingProject(null);
    };

    const handleDeleteProject = (projectId: string) => {
        if (window.confirm('Are you sure you want to delete this project?')) {
            setProjects(prev => prev.filter(p => p.id !== projectId));
        }
    };
    
    const toggleProjectStatus = (projectId: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, closed: !p.closed } : p));
    };
    
    const generateQRCode = (project: Project) => {
        setShowQRCode({ project, content: `PROJECT_ID:${project.id}` });
    };

    if (showQRCode) {
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Project List
                </button>
                <div className="text-center">
                    <QrCode className="w-24 h-24 text-green-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">Project QR Code</h2>
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
                        <Download className="w-4 h-4 mr-2" /> Download
                    </button>
                </div>
            </div>
        );
    }

    if (editingProject) {
        return (
            <div className="max-w-2xl mx-auto">
                 <div className="bg-white rounded-2xl shadow-xl p-6">
                     <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Edit className="w-5 h-5 mr-2 text-green-600" />Edit Project: {editingProject.name}</h3>
                     <div className="space-y-4">
                         <input type="text" placeholder="Project Name" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded" />
                         <input type="number" placeholder="Budget" value={editingProject.budget} onChange={e => setEditingProject({...editingProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded" />
                         <input type="date" value={editingProject.deadline} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded" />
                         {/* FIX: Add input for cost_center_id and use estimated_hours */}
                         <input type="number" placeholder="Cost Center ID" value={editingProject.cost_center_id} onChange={e => setEditingProject({...editingProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded" />
                         <input type="number" placeholder="Estimated Hours" value={editingProject.estimated_hours || ''} onChange={e => setEditingProject({...editingProject, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded" />
                         <div className="flex space-x-2">
                            <button onClick={handleUpdateProject} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Save</button>
                            <button onClick={() => setEditingProject(null)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                         </div>
                     </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><FolderPlus className="w-5 h-5 mr-2 text-green-600" />Add New Project</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Project Name" value={newProject.name || ''} onChange={e => setNewProject({...newProject, name: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="number" placeholder="Budget" value={newProject.budget || ''} onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})} className="w-full p-2 border rounded" />
                    <input type="date" value={newProject.deadline || ''} onChange={e => setNewProject({...newProject, deadline: e.target.value})} className="w-full p-2 border rounded" />
                    {/* FIX: Add input for cost_center_id and use estimated_hours */}
                    <input type="number" placeholder="Cost Center ID" value={newProject.cost_center_id || ''} onChange={e => setNewProject({...newProject, cost_center_id: Number(e.target.value)})} className="w-full p-2 border rounded" />
                    <input type="number" placeholder="Estimated Hours" value={newProject.estimated_hours || ''} onChange={e => setNewProject({...newProject, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded" />
                </div>
                <button onClick={handleAddProject} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Add Project</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existing Projects ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                             <div>
                                <p className="font-medium">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Closed' : 'Open'}</span></p>
                                <p className="text-sm text-gray-600">Budget: ${project.budget.toLocaleString()} | Deadline: {project.deadline}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => generateQRCode(project)} title="QR Code" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingProject(project)} title="Edit" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleProjectStatus(project.id)} title={project.closed ? "Open" : "Close"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                <button onClick={() => handleDeleteProject(project.id)} title="Delete" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectManagement;