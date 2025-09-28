import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { CostCenter } from '../types';
// FIX: Import the 'Check' icon.
import { Building2, Edit, Trash2, Plus, X, Check } from './Icons';

const CostCenterManagement: React.FC = () => {
    const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter } = useTimeTracker();
    const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
    const [newCenterName, setNewCenterName] = useState('');

    const handleAddCenter = async () => {
        if (!newCenterName.trim()) {
            alert('Názov strediska nemôže byť prázdny.');
            return;
        }
        const success = await addCostCenter({ name: newCenterName });
        if (success) {
            setNewCenterName('');
        }
    };

    const handleUpdateCenter = async () => {
        if (!editingCenter || !editingCenter.name.trim()) {
             alert('Názov strediska nemôže byť prázdny.');
            return;
        }
        const success = await updateCostCenter(editingCenter);
        if (success) {
            setEditingCenter(null);
        }
    };

    const handleDeleteCenter = async (centerId: string) => {
        if (window.confirm('Naozaj chcete zmazať toto stredisko? Táto akcia je nevratná.')) {
            await deleteCostCenter(centerId);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Plus className="w-5 h-5 mr-2 text-blue-600" />Pridať Nové Stredisko
                </h3>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Názov strediska"
                        value={newCenterName}
                        onChange={e => setNewCenterName(e.target.value)}
                        className="flex-grow p-2 border rounded-lg"
                    />
                    <button onClick={handleAddCenter} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Pridať
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Existujúce Strediská ({costCenters.length})
                </h3>
                <div className="space-y-3">
                    {costCenters.map(center => (
                        <div key={center.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            {editingCenter?.id === center.id ? (
                                <div className="flex-grow flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={editingCenter.name}
                                        onChange={e => setEditingCenter({ ...editingCenter, name: e.target.value })}
                                        className="flex-grow p-1 border rounded"
                                    />
                                    <button onClick={handleUpdateCenter} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingCenter(null)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"><X className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center">
                                        <Building2 className="w-5 h-5 mr-3 text-gray-400" />
                                        <p className="font-medium">{center.name}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setEditingCenter(center)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteCenter(center.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CostCenterManagement;