import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { CostCenter } from '../types';
import { Building2, Edit, Trash2, Plus, Check, X } from './Icons';

const CostCenterManagement: React.FC = () => {
    // FIX: Add missing functions and state from context
    const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter } = useTimeTracker();
    const [newCenterName, setNewCenterName] = useState('');
    const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAdd = async () => {
        if (newCenterName.trim()) {
            await addCostCenter(newCenterName.trim());
            setNewCenterName('');
        }
    };

    const handleUpdate = async () => {
        if (editingCenter && editingName.trim()) {
            await updateCostCenter(editingCenter.id, editingName.trim());
            setEditingCenter(null);
            setEditingName('');
        }
    };
    
    const startEditing = (center: CostCenter) => {
        setEditingCenter(center);
        setEditingName(center.name);
    };
    
    const cancelEditing = () => {
        setEditingCenter(null);
        setEditingName('');
    }

    const handleDelete = (id: number) => {
        if (window.confirm('Naozaj chcete vymazať toto stredisko? Táto akcia môže ovplyvniť existujúce projekty a používateľov.')) {
            deleteCostCenter(id);
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Plus className="w-5 h-5 mr-2 text-blue-600" />Pridať Nové Stredisko</h3>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Názov strediska"
                        value={newCenterName}
                        onChange={e => setNewCenterName(e.target.value)}
                        className="flex-grow p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Pridať</button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce Strediská ({costCenters.length})</h3>
                <div className="space-y-3">
                    {costCenters.map(center => (
                        <div key={center.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            {editingCenter?.id === center.id ? (
                                <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="flex-grow p-1 border rounded-md"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                                />
                            ) : (
                                <div className="flex items-center">
                                    <Building2 className="w-4 h-4 mr-2 text-gray-500" />
                                    <p className="font-medium text-gray-800">{center.name}</p>
                                </div>
                            )}
                            <div className="flex items-center space-x-2">
                                {editingCenter?.id === center.id ? (
                                    <>
                                        <button onClick={handleUpdate} title="Uložiť" className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-4 h-4" /></button>
                                        <button onClick={cancelEditing} title="Zrušiť" className="p-2 text-red-600 hover:bg-red-100 rounded-full"><X className="w-4 h-4" /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEditing(center)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(center.id)} title="Vymazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
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
