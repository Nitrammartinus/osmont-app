import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Project, CostCenter } from '../types';
import { FolderPlus, Edit, Trash2, Lock, Unlock, QrCode, ChevronLeft, Download } from './Icons';
// FIX: Changed import from default 'QRCode' to named 'QRCodeCanvas' to fix component type error.
import { QRCodeCanvas } from 'qrcode.react';

const ProjectManagement: React.FC = () => {
    const { projects, costCenters, addProject, updateProject, deleteProject } = useTimeTracker();
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: '' });
    const [showQRCode, setShowQRCode] = useState<Project | null>(null);

    const handleSaveProject = async () => {
        if (editingProject) {
            const success = await updateProject(editingProject);
            if (success) {
                setEditingProject(null);
            }
        } else {
             if (!newProject.name || !newProject.budget || !newProject.deadline || !newProject.cost_center_id) {
                alert('Prosím, vyplňte všetky polia pre nový projekt.');
                return;
            }
            const success = await addProject(newProject as Omit<Project, 'id' | 'closed'>);
            if (success) {
                setNewProject({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: '' });
            }
        }
    };
    
    const handleDeleteProject = async (projectId: string) => {
        if (window.confirm('Naozaj chcete zmazať tento projekt?')) {
            await deleteProject(projectId);
        }
    };
    
    const handleToggleStatus = async (project: Project) => {
        await updateProject({ ...project, closed: !project.closed });
    };

    if (showQRCode) {
        const qrContent = `PROJECT_ID:${showQRCode.id}`;
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na zoznam
                </button>
                <div className="text-center">
                    <div className="p-4 bg-white inline-block rounded-lg border">
                        {/* FIX: Used QRCodeCanvas and added an ID for robust selection in download logic. */}
                        <QRCodeCanvas id="qr-code-project" value={qrContent} size={256} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mt-4">QR kód Projektu</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.name}</p>
                     <button
                        onClick={() => {
                            // FIX: Select canvas by a unique ID to prevent conflicts.
                            const canvas = document.getElementById('qr-code-project') as HTMLCanvasElement;
                            if (canvas) {
                                const link = document.createElement('a');
                                link.href = canvas.toDataURL('image/png');
                                link.download = `qr_projekt_${showQRCode.name.replace(/\s+/g, '_')}.png`;
                                link.click();
                            }
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
            <ProjectForm
                project={editingProject}
                setProject={setEditingProject}
                onSave={handleSaveProject}
                onCancel={() => setEditingProject(null)}
                allCostCenters={costCenters}
                isEditing={true}
            />
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <ProjectForm
                project={newProject}
                setProject={setNewProject}
                onSave={handleSaveProject}
                onCancel={() => setNewProject({ name: '', budget: 0, deadline: '', estimated_hours: 0, cost_center_id: '' })}
                allCostCenters={costCenters}
                isEditing={false}
            />
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Projekty ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                             <div>
                                <p className="font-medium">{project.name} <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${project.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{project.closed ? 'Uzatvorený' : 'Otvorený'}</span></p>
                                <p className="text-sm text-gray-600">Rozpočet: {project.budget.toLocaleString()} € | Deadline: {new Date(project.deadline).toLocaleDateString('sk-SK')}</p>
                            </div>
                            <div className="flex items-center space-x-1 sm:space-x-2">
                                <button onClick={() => setShowQRCode(project)} title="QR kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingProject(project)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleToggleStatus(project)} title={project.closed ? "Otvoriť" : "Uzatvoriť"} className={`p-2 rounded-full ${project.closed ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{project.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                <button onClick={() => handleDeleteProject(project.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


interface ProjectFormProps {
    project: Partial<Project>;
    setProject: React.Dispatch<React.SetStateAction<any>>;
    onSave: () => void;
    onCancel: () => void;
    allCostCenters: CostCenter[];
    isEditing: boolean;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ project, setProject, onSave, onCancel, allCostCenters, isEditing }) => {
    // Format date for input type="date" which requires YYYY-MM-DD
    const deadlineForInput = project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '';

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                 {isEditing ? <><Edit className="w-5 h-5 mr-2 text-green-600" />Upraviť Projekt: {project.name}</> : <><FolderPlus className="w-5 h-5 mr-2 text-green-600" />Pridať Projekt</>}
            </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Názov projektu</label>
                    <input type="text" value={project.name || ''} onChange={e => setProject({...project, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stredisko</label>
                    <select value={project.cost_center_id || ''} onChange={e => setProject({...project, cost_center_id: e.target.value})} className="w-full p-2 border rounded-lg">
                        <option value="">-- Vyberte stredisko --</option>
                        {allCostCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rozpočet (€)</label>
                    <input type="number" value={project.budget || ''} onChange={e => setProject({...project, budget: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                    <input type="date" value={deadlineForInput} onChange={e => setProject({...project, deadline: e.target.value})} className="w-full p-2 border rounded-lg" />
                 </div>
                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Odhadované hodiny (voliteľné)</label>
                    <input type="number" value={project.estimated_hours || ''} onChange={e => setProject({...project, estimated_hours: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                 </div>
            </div>
            <div className="flex space-x-2 mt-4">
                <button onClick={onSave} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Uložiť</button>
                 {!isEditing && <button onClick={onCancel} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Zrušiť</button>}
            </div>
        </div>
    );
};


export default ProjectManagement;