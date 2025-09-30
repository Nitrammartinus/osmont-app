import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { CostCenter } from '../types';
import { Building2, Plus, Edit, Trash2, Check } from './Icons';

const CostCenterManagement: React.FC = () => {
    const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter } = useTimeTracker();
    const [newCenterName, setNewCenterName] = useState('');
    const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);

    const handleAdd = async () => {
        if (newCenterName.trim()) {
            await addCostCenter(newCenterName.trim());
            setNewCenterName('');
        }
    };

    const handleUpdate = async () => {
        if (editingCenter && editingCenter.name.trim()) {
            await updateCostCenter(editingCenter);
            setEditingCenter(null);
        }
    };
    
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <Building2 className="w-6 h-6 mr-2 text-blue-600" />
                    Správa Stredísk
                </h2>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Názov nového strediska"
                        value={newCenterName}
                        onChange={(e) => setNewCenterName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
                        <Plus className="w-5 h-5 mr-1" /> Pridať
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúce strediská ({costCenters.length})</h3>
                <div className="space-y-3">
                    {costCenters.map(center => (
                        <div key={center.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            {editingCenter?.id === center.id ? (
                                <input
                                    type="text"
                                    value={editingCenter.name}
                                    onChange={(e) => setEditingCenter({ ...editingCenter, name: e.target.value })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded"
                                />
                            ) : (
                                <p className="font-medium">{center.name}</p>
                            )}
                            <div className="flex items-center space-x-1">
                                {editingCenter?.id === center.id ? (
                                    <>
                                        <button onClick={handleUpdate} title="Uložiť" className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-5 h-5" /></button>
                                        <button onClick={() => setEditingCenter(null)} title="Zrušiť" className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"><Trash2 className="w-5 h-5" /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => setEditingCenter(center)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-5 h-5" /></button>
                                        <button onClick={() => deleteCostCenter(center.id)} title="Vymazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-5 h-5" /></button>
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
