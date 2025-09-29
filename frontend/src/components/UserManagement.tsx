import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, UserRole } from '../types';
import { UserPlus, Edit, Trash2, Ban, Check, QrCode, ChevronLeft, Download, X } from './Icons';

const UserManagement: React.FC = () => {
    const { users, addUser, updateUser, deleteUser, costCenters } = useTimeTracker();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
    const [showQRCode, setShowQRCode] = useState<{ user: User, content: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAddUser = async () => {
        if (!newUser.name || !newUser.username || !newUser.password) {
            alert('Prosím, vyplňte všetky polia pre nového používateľa.');
            return;
        }
        if (users.some(u => u.username === newUser.username)) {
            alert('Používateľské meno už existuje.');
            return;
        }
        setLoading(true);
        const success = await addUser({
            name: newUser.name,
            username: newUser.username,
            password: newUser.password,
            role: newUser.role || 'employee',
            can_select_project_manually: newUser.can_select_project_manually || false,
            costCenters: newUser.costCenters || [],
        });
        setLoading(false);
        if (success) {
            setNewUser({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        if (users.some(u => u.username === editingUser.username && u.id !== editingUser.id)) {
            alert('Používateľské meno už existuje.');
            return;
        }
        setLoading(true);
        const success = await updateUser(editingUser);
        setLoading(false);
        if (success) {
            setEditingUser(null);
        }
    };

    const handleDeleteUser = (userId: string) => {
        if (window.confirm('Naozaj chcete zmazať tohto používateľa?')) {
            deleteUser(userId);
        }
    };
    
    const toggleUserBlock = (user: User) => {
        updateUser({ ...user, blocked: !user.blocked });
    };

    const generateQRCode = (user: User) => {
        setShowQRCode({ user, content: `USER_ID:${user.id}` });
    };

    const handleCostCenterChange = (centerId: string, forNewUser: boolean) => {
        if (forNewUser) {
            const currentCenters = newUser.costCenters || [];
            const newCenters = currentCenters.includes(centerId)
                ? currentCenters.filter(id => id !== centerId)
                : [...currentCenters, centerId];
            setNewUser({ ...newUser, costCenters: newCenters });
        } else if (editingUser) {
            const currentCenters = editingUser.costCenters || [];
            const newCenters = currentCenters.includes(centerId)
                ? currentCenters.filter(id => id !== centerId)
                : [...currentCenters, centerId];
            setEditingUser({ ...editingUser, costCenters: newCenters });
        }
    };

    if (showQRCode) {
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na zoznam
                </button>
                <div className="text-center">
                    <QrCode className="w-24 h-24 text-blue-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Používateľa</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.user.name}</p>
                    <div className="bg-gray-100 p-4 rounded-lg mb-4 break-all font-mono">{showQRCode.content}</div>
                    <button
                        onClick={() => {
                            const blob = new Blob([showQRCode.content], { type: 'text/plain' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `user_qr_${showQRCode.user.username}.txt`;
                            link.click();
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 mr-2" /> Stiahnuť
                    </button>
                </div>
            </div>
        );
    }
    
    if (editingUser) {
        return (
            <div className="max-w-2xl mx-auto">
                 <div className="bg-white rounded-2xl shadow-xl p-6">
                     <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Edit className="w-5 h-5 mr-2 text-blue-600" />Upraviť Používateľa: {editingUser.name}</h3>
                     <div className="space-y-4">
                        <input type="text" placeholder="Celé Meno" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2 border rounded" />
                        <input type="text" placeholder="Používateľské meno" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full p-2 border rounded" />
                        <input type="password" placeholder="Nové heslo (voliteľné)" onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full p-2 border rounded" />
                        <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                           <option value="employee">Zamestnanec</option>
                           <option value="manager">Manažér</option>
                           <option value="admin">Admin</option>
                        </select>
                        <div className="flex items-center">
                            <input type="checkbox" id="edit_can_select" checked={editingUser.can_select_project_manually} onChange={e => setEditingUser({...editingUser, can_select_project_manually: e.target.checked})} className="mr-2 h-4 w-4" />
                            <label htmlFor="edit_can_select">Môže manuálne vybrať projekt</label>
                        </div>
                        <div>
                            <label className="font-semibold text-gray-700">Nákladové Strediská:</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                {costCenters.map(center => (
                                    <label key={center.id} className="flex items-center space-x-2">
                                        <input type="checkbox" checked={editingUser.costCenters?.includes(center.id)} onChange={() => handleCostCenterChange(center.id, false)} />
                                        <span>{center.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex space-x-2">
                           <button onClick={handleUpdateUser} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Ukladám...' : 'Uložiť'}</button>
                           <button onClick={() => setEditingUser(null)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Zrušiť</button>
                        </div>
                     </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-blue-600" />Pridať Nového Používateľa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Celé Meno" value={newUser.name || ''} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="Používateľské meno" value={newUser.username || ''} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="password" placeholder="Heslo" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border rounded" />
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                        <option value="employee">Zamestnanec</option>
                        <option value="manager">Manažér</option>
                        <option value="admin">Admin</option>
                    </select>
                    <div className="flex items-center md:col-span-2">
                        <input type="checkbox" id="new_can_select" checked={!!newUser.can_select_project_manually} onChange={e => setNewUser({...newUser, can_select_project_manually: e.target.checked})} className="mr-2 h-4 w-4" />
                        <label htmlFor="new_can_select">Môže manuálne vybrať projekt</label>
                    </div>
                </div>
                <div className="mt-4">
                    <label className="font-semibold text-gray-700">Nákladové Strediská:</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {costCenters.map(center => (
                            <label key={center.id} className="flex items-center space-x-2">
                                <input type="checkbox" checked={newUser.costCenters?.includes(center.id)} onChange={() => handleCostCenterChange(center.id, true)} />
                                <span>{center.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                 <button onClick={handleAddUser} disabled={loading} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Pridávam...' : 'Pridať Používateľa'}</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúci Používatelia ({users.length})</h3>
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between flex-wrap">
                            <div className="mb-2 sm:mb-0">
                                <p className="font-medium">{user.name} {user.blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Zablokovaný</span>}</p>
                                <p className="text-sm text-gray-600">@{user.username} - {user.role}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => generateQRCode(user)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingUser(user)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleUserBlock(user)} title={user.blocked ? "Odblokovať" : "Zablokovať"} className={`p-2 rounded-full ${user.blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{user.blocked ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4" />}</button>
                                <button onClick={() => handleDeleteUser(user.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
