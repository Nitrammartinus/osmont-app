import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { CostCenter } from '../types';
import { Building2, Plus, Edit, Check } from './Icons';

const CostCenterManagement: React.FC = () => {
    const { costCenters, addCostCenter, updateCostCenter } = useTimeTracker();
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
            await updateCostCenter(editingCenter.id, editingCenter.name.trim());
            setEditingCenter(null);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Plus className="w-6 h-6 mr-2 text-blue-600"/>Pridať Nové Stredisko</h2>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newCenterName}
                        onChange={(e) => setNewCenterName(e.target.value)}
                        placeholder="Názov strediska"
                        className="flex-grow p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Pridať</button>
                </div>
            </div>

             <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Building2 className="w-6 h-6 mr-2 text-gray-700"/>Existujúce Strediská</h2>
                <div className="space-y-2">
                    {costCenters.map(center => (
                        <div key={center.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                            {editingCenter?.id === center.id ? (
                                <input
                                    type="text"
                                    value={editingCenter.name}
                                    onChange={(e) => setEditingCenter({ ...editingCenter, name: e.target.value })}
                                    className="flex-grow p-1 border rounded-md"
                                />
                            ) : (
                                <span className="font-medium text-gray-800">{center.name}</span>
                            )}
                            <div className="flex gap-2">
                                {editingCenter?.id === center.id ? (
                                    <>
                                        <button onClick={handleUpdate} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="Uložiť"><Check className="w-5 h-5"/></button>
                                        <button onClick={() => setEditingCenter(null)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Zrušiť"><Edit className="w-5 h-5"/></button>
                                    </>
                                ) : (
                                    <button onClick={() => setEditingCenter(center)} className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full" title="Upraviť"><Edit className="w-5 h-5"/></button>
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
