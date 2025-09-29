import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { CostCenter } from '../types';
import { Building2, Plus, Edit, Trash2, Check, X } from './Icons';

const CostCenterManagement: React.FC = () => {
    const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter } = useTimeTracker();
    const [newCenterName, setNewCenterName] = useState('');
    const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
    const [editingName, setEditingName] = useState('');
    
    const handleAdd = async () => {
        if (newCenterName.trim()) {
            await addCostCenter(newCenterName.trim());
            setNewCenterName('');
        } else {
            alert("Názov strediska nemôže byť prázdny.");
        }
    };
    
    const handleEdit = (center: CostCenter) => {
        setEditingCenter(center);
        setEditingName(center.name);
    };

    const handleUpdate = async () => {
        if (editingCenter && editingName.trim()) {
            await updateCostCenter({ ...editingCenter, name: editingName.trim() });
            setEditingCenter(null);
            setEditingName('');
        }
    };

    const handleDelete = async (centerId: number) => {
        if (window.confirm("Naozaj chcete zmazať toto stredisko? Táto akcia môže ovplyvniť priradené projekty a používateľov.")) {
            await deleteCostCenter(centerId);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <Building2 className="w-6 h-6 mr-2" /> Správa Stredísk
                </h2>

                <div className="flex flex-col sm:flex-row gap-2 mb-6">
                    <input
                        type="text"
                        value={newCenterName}
                        onChange={(e) => setNewCenterName(e.target.value)}
                        placeholder="Názov nového strediska"
                        className="flex-grow p-2 border rounded-lg"
                    />
                    <button
                        onClick={handleAdd}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Pridať Stredisko
                    </button>
                </div>

                <div className="space-y-3">
                    {costCenters.map((center) => (
                        <div key={center.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            {editingCenter?.id === center.id ? (
                                <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="p-1 border rounded"
                                />
                            ) : (
                                <span className="font-medium">{center.name}</span>
                            )}
                            
                            <div className="flex items-center space-x-2">
                                {editingCenter?.id === center.id ? (
                                    <>
                                        <button onClick={handleUpdate} title="Uložiť" className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => setEditingCenter(null)} title="Zrušiť" className="p-2 text-red-600 hover:bg-red-100 rounded-full"><X className="w-4 h-4" /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleEdit(center)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(center.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CostCenterManagement;
