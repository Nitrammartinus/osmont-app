import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, UserRole } from '../types';
import { UserPlus, Edit, Trash2, Ban, Check, QrCode, ChevronLeft, Download } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const UserManagement: React.FC = () => {
    const { users, updateUser, costCenters, addUser, deleteUser } = useTimeTracker();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
    const [showQRCodeData, setShowQRCodeData] = useState<{ user: User, content: string } | null>(null);

    const handleAddUser = async () => {
        if (!newUser.name || !newUser.username || !newUser.password) {
            alert('Meno, používateľské meno a heslo sú povinné.');
            return;
        }
        await addUser({
            name: newUser.name,
            username: newUser.username,
            password: newUser.password,
            role: newUser.role || 'employee',
            can_select_project_manually: newUser.can_select_project_manually || false,
            costCenters: newUser.costCenters || [],
        });
        setNewUser({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        await updateUser(editingUser);
        setEditingUser(null);
    };
    
    const generateQRCode = (user: User) => {
        if (user.role === 'admin' || user.role === 'manager') return;
        setShowQRCodeData({ user, content: `USER_ID:${user.id}` });
    };
    
    const handleCostCenterChange = (centerId: number, checked: boolean, isEditing: boolean) => {
        if (isEditing) {
            setEditingUser(prev => {
                if (!prev) return null;
                const currentCenters = prev.costCenters || [];
                const newCenters = checked
                    ? [...currentCenters, centerId]
                    : currentCenters.filter(id => id !== centerId);
                return { ...prev, costCenters: newCenters };
            });
        } else {
            setNewUser(prev => {
                const currentCenters = prev.costCenters || [];
                const newCenters = checked
                    ? [...currentCenters, centerId]
                    : currentCenters.filter(id => id !== centerId);
                return { ...prev, costCenters: newCenters };
            });
        }
    };

    if (showQRCodeData) {
        const qrId = `qr-canvas-${showQRCodeData.user.id}`;
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCodeData(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na Zoznam Používateľov
                </button>
                <div className="text-center">
                    <div className="bg-gray-100 p-4 inline-block rounded-lg mb-4">
                        <QRCodeCanvas id={qrId} value={showQRCodeData.content} size={200} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Používateľa</h2>
                    <p className="text-gray-600 mb-4">{showQRCodeData.user.name}</p>
                    <button
                        onClick={() => {
                            const canvas = document.getElementById(qrId) as HTMLCanvasElement;
                            if (canvas) {
                                const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
                                let downloadLink = document.createElement("a");
                                downloadLink.href = pngUrl;
                                downloadLink.download = `qr_kod_${showQRCodeData.user.username}.png`;
                                document.body.appendChild(downloadLink);
                                downloadLink.click();
                                document.body.removeChild(downloadLink);
                            }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 mr-2" /> Stiahnuť PNG
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Celé Meno</label>
                            <input type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Používateľské meno</label>
                            <input type="text" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full p-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nové Heslo (voliteľné)</label>
                            <input type="password" placeholder="Zadajte pre zmenu" onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full p-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded-lg">
                                <option value="employee">Zamestnanec</option>
                                <option value="manager">Manažér</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Strediská</label>
                            <div className="grid grid-cols-2 gap-2 p-2 border rounded-lg">
                                {costCenters.map(center => (
                                    <div key={center.id} className="flex items-center">
                                         <input
                                            id={`center-edit-${center.id}`}
                                            type="checkbox"
                                            checked={editingUser.costCenters?.includes(center.id) || false}
                                            onChange={(e) => handleCostCenterChange(center.id, e.target.checked, true)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                        <label htmlFor={`center-edit-${center.id}`} className="ml-2 block text-sm text-gray-900">{center.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <input id="canSelectManuallyEdit" type="checkbox" checked={editingUser.can_select_project_manually || false} onChange={e => setEditingUser({ ...editingUser, can_select_project_manually: e.target.checked })} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                            <label htmlFor="canSelectManuallyEdit" className="ml-2 block text-sm text-gray-900">Môže manuálne vybrať projekt</label>
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
                    <input type="text" placeholder="Celé Meno" value={newUser.name || ''} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="Používateľské meno" value={newUser.username || ''} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="password" placeholder="Heslo" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border rounded" />
                    <select value={newUser.role || 'employee'} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                        <option value="employee">Zamestnanec</option>
                        <option value="manager">Manažér</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div className='mt-4'>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Strediská</label>
                    <div className="grid grid-cols-2 gap-2 p-2 border rounded-lg">
                        {costCenters.map(center => (
                            <div key={center.id} className="flex items-center">
                                    <input
                                    id={`center-new-${center.id}`}
                                    type="checkbox"
                                    checked={newUser.costCenters?.includes(center.id) || false}
                                    onChange={(e) => handleCostCenterChange(center.id, e.target.checked, false)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                <label htmlFor={`center-new-${center.id}`} className="ml-2 block text-sm text-gray-900">{center.name}</label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center mt-4">
                    <input id="canSelectManuallyNew" type="checkbox" checked={newUser.can_select_project_manually || false} onChange={e => setNewUser({ ...newUser, can_select_project_manually: e.target.checked })} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <label htmlFor="canSelectManuallyNew" className="ml-2 block text-sm text-gray-900">Môže manuálne vybrať projekt</label>
                </div>
                 <button onClick={handleAddUser} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Pridať Používateľa</button>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúci Používatelia ({users.length})</h3>
                <div className="space-y-3">
                    {users.map(user => {
                        const userCostCenters = user.costCenters?.map(centerId => costCenters.find(c => c.id === centerId)?.name).filter(Boolean).join(', ');

                        return (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div className="mb-2 sm:mb-0">
                                <p className="font-medium">{user.name} {user.blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Zablokovaný</span>}</p>
                                <p className="text-sm text-gray-600">@{user.username} - {user.role}</p>
                                {userCostCenters && <p className="text-xs text-gray-500 mt-1">Strediská: {userCostCenters}</p>}
                            </div>
                            <div className="flex items-center space-x-2 self-start sm:self-center">
                                {user.role === 'employee' && <button onClick={() => generateQRCode(user)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>}
                                <button onClick={() => setEditingUser(user)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={async () => await updateUser({ ...user, blocked: !user.blocked })} title={user.blocked ? "Odblokovať" : "Zablokovať"} className={`p-2 rounded-full ${user.blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{user.blocked ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4" />}</button>
                                <button onClick={() => deleteUser(user.id)} title="Vymazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )})}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;