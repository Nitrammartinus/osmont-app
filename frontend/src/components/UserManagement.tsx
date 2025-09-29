import React, { useState, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, UserRole, CostCenter } from '../types';
import { UserPlus, Edit, Trash2, Ban, Check, QrCode, ChevronLeft, Download, Building2 } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const UserManagement: React.FC = () => {
    const { users, costCenters, addUser, updateUser, deleteUser, toggleUserBlock } = useTimeTracker();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false });
    const [showQRCode, setShowQRCode] = useState<{ user: User, content: string } | null>(null);
    const [selectedCenters, setSelectedCenters] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (editingUser?.costCenters) {
            setSelectedCenters(new Set(editingUser.costCenters.map(c => c.id)));
        } else {
            setSelectedCenters(new Set());
        }
    }, [editingUser]);
    
    const handleCenterToggle = (centerId: number) => {
        const newSelection = new Set(selectedCenters);
        if (newSelection.has(centerId)) {
            newSelection.delete(centerId);
        } else {
            newSelection.add(centerId);
        }
        setSelectedCenters(newSelection);
    };

    const handleAddUser = async () => {
        if (!newUser.name || !newUser.username || !newUser.password) {
            alert('Prosím, vyplňte všetky polia pre nového používateľa.');
            return;
        }
        await addUser({
            name: newUser.name,
            username: newUser.username,
            password: newUser.password,
            role: newUser.role || 'employee',
            can_select_project_manually: newUser.can_select_project_manually || false,
        });
        setNewUser({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false });
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        
        const updatedUserCostCenters = costCenters.filter(c => selectedCenters.has(c.id));
        const userToUpdate: User = {
            ...editingUser,
            can_select_project_manually: editingUser.can_select_project_manually || false,
            costCenters: updatedUserCostCenters
        }
        
        await updateUser(userToUpdate);
        setEditingUser(null);
    };
    
    const generateQRCode = (user: User) => {
        setShowQRCode({ user, content: `USER_ID:${user.id}` });
    };

    if (showQRCode) {
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na zoznam používateľov
                </button>
                <div className="text-center">
                    <div className="p-4 bg-white inline-block rounded-lg border">
                        <QRCodeCanvas id={`qr-${showQRCode.user.id}`} value={showQRCode.content} size={256} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mt-4">QR kód Používateľa</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.user.name}</p>
                    <button
                        onClick={() => {
                            const canvas = document.getElementById(`qr-${showQRCode.user.id}`) as HTMLCanvasElement;
                            if (canvas) {
                                const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
                                let downloadLink = document.createElement("a");
                                downloadLink.href = pngUrl;
                                downloadLink.download = `user_qr_${showQRCode.user.username}.png`;
                                document.body.appendChild(downloadLink);
                                downloadLink.click();
                                document.body.removeChild(downloadLink);
                            }
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
                         <input type="text" placeholder="Celé meno" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2 border rounded" />
                         <input type="text" placeholder="Používateľské meno" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full p-2 border rounded" />
                         <input type="password" placeholder="Nové heslo (voliteľné)" onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full p-2 border rounded" />
                         <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                            <option value="employee">Zamestnanec</option>
                            <option value="manager">Manažér</option>
                            <option value="admin">Admin</option>
                         </select>

                         <div className="border p-4 rounded-lg">
                            <h4 className="font-semibold mb-2">Priradené strediská</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {costCenters.map(center => (
                                    <label key={center.id} className="flex items-center space-x-2">
                                        <input type="checkbox" checked={selectedCenters.has(center.id)} onChange={() => handleCenterToggle(center.id)} />
                                        <span>{center.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="border p-4 rounded-lg">
                            <h4 className="font-semibold mb-2">Oprávnenia</h4>
                            <label className="flex items-center space-x-2">
                                <input type="checkbox" checked={editingUser.can_select_project_manually} onChange={e => setEditingUser({...editingUser, can_select_project_manually: e.target.checked})} />
                                <span>Môže manuálne spustiť reláciu</span>
                            </label>
                        </div>
                         
                         <div className="flex space-x-2">
                            <button onClick={handleUpdateUser} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Uložiť</button>
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
                    <input type="text" placeholder="Celé meno" value={newUser.name || ''} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="Používateľské meno" value={newUser.username || ''} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="password" placeholder="Heslo" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border rounded" />
                    <select value={newUser.role || 'employee'} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                        <option value="employee">Zamestnanec</option>
                        <option value="manager">Manažér</option>
                        <option value="admin">Admin</option>
                    </select>
                     <div className="md:col-span-2">
                        <label className="flex items-center space-x-2">
                           <input type="checkbox" checked={newUser.can_select_project_manually || false} onChange={e => setNewUser({...newUser, can_select_project_manually: e.target.checked})} />
                           <span>Môže manuálne spustiť reláciu</span>
                        </label>
                    </div>
                </div>
                 <button onClick={handleAddUser} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Pridať Používateľa</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúci Používatelia ({users.length})</h3>
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between">
                            <div>
                                <p className="font-medium">{user.name} {user.blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Zablokovaný</span>}</p>
                                <p className="text-sm text-gray-600">@{user.username} - {user.role}</p>
                                <div className="flex items-center text-xs text-gray-500 mt-1 flex-wrap gap-x-2">
                                    <Building2 className="w-3 h-3" />
                                    {user.costCenters && user.costCenters.length > 0 ? user.costCenters.map(c => c.name).join(', ') : 'Žiadne stredisko'}
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                                {user.role === 'employee' && (
                                    <button onClick={() => generateQRCode(user)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => setEditingUser(user)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={async () => await toggleUserBlock(user.id)} title={user.blocked ? "Odblokovať" : "Zablokovať"} className={`p-2 rounded-full ${user.blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{user.blocked ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4" />}</button>
                                <button onClick={async () => await deleteUser(user.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
