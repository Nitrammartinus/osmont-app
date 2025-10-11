import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { CostCenter } from '../types';
import { Building2, Plus, Edit, Trash2 } from './Icons';

const CostCenterManagement: React.FC = () => {
    const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter } = useTimeTracker();
    const [newCenterName, setNewCenterName] = useState('');
    const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);

    const handleAddCenter = async () => {
        if (!newCenterName.trim()) {
            alert('Názov strediska nemôže byť prázdny.');
            return;
        }
        await addCostCenter(newCenterName.trim());
        setNewCenterName('');
    };

    const handleUpdateCenter = async () => {
        if (!editingCenter || !editingCenter.name.trim()) {
             alert('Názov strediska nemôže byť prázdny.');
            return;
        }
        await updateCostCenter(editingCenter.id, editingCenter.name.trim());
        setEditingCenter(null);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Plus className="w-5 h-5 mr-2 text-blue-600" />
                    Pridať Nové Stredisko
                </h3>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Názov strediska"
                        value={newCenterName}
                        onChange={(e) => setNewCenterName(e.target.value)}
                        className="flex-grow p-2 border rounded-lg"
                    />
                    <button onClick={handleAddCenter} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Pridať
                    </button>
                </div>
            </div>

            {editingCenter && (
                 <div className="bg-white rounded-2xl shadow-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <Edit className="w-5 h-5 mr-2 text-yellow-600" />
                        Upraviť Stredisko
                    </h3>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={editingCenter.name}
                            onChange={(e) => setEditingCenter({ ...editingCenter, name: e.target.value })}
                            className="flex-grow p-2 border rounded-lg"
                        />
                         <div className="flex space-x-2">
                            <button onClick={handleUpdateCenter} className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600">
                                Uložiť
                            </button>
                            <button onClick={() => setEditingCenter(null)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">
                                Zrušiť
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-gray-600" />
                    Existujúce Strediská ({costCenters.length})
                </h3>
                <div className="space-y-3">
                    {costCenters.map((center) => (
                        <div key={center.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            <p className="font-medium text-gray-800">{center.name}</p>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => setEditingCenter(center)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteCostCenter(center.id)} title="Vymazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CostCenterManagement;
