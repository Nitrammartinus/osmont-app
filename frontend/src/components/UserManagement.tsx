import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, UserRole } from '../types';
import { UserPlus, Edit, Trash2, Ban, Check, QrCode, Download, Building2 } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const UserManagement: React.FC = () => {
    const { users, updateUser, costCenters } = useTimeTracker();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showQRCode, setShowQRCode] = useState<{ user: User, content: string } | null>(null);

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        await updateUser(editingUser);
        setEditingUser(null);
    };

    const toggleUserBlock = async (user: User) => {
        await updateUser({ ...user, blocked: !user.blocked });
    };

    const generateQRCode = (user: User) => {
        if (user.role === 'admin' || user.role === 'manager') return;
        setShowQRCode({ user, content: `USER_ID:${user.id}` });
    };

    if (showQRCode) {
        const qrId = `qr-canvas-user-${showQRCode.user.id}`;
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-800">QR Kód Používateľa</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.user.name}</p>
                    <div className="bg-white p-4 inline-block rounded-lg border">
                        <QRCodeCanvas id={qrId} value={showQRCode.content} size={200} />
                    </div>
                    <div className="mt-4 space-y-2">
                        <button
                            onClick={() => {
                                const canvas = document.getElementById(qrId) as HTMLCanvasElement;
                                const link = document.createElement('a');
                                link.href = canvas.toDataURL("image/png");
                                link.download = `qr_kod_${showQRCode.user.username}.png`;
                                link.click();
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
                            <Download className="w-4 h-4 mr-2" /> Stiahnuť PNG
                        </button>
                        <button onClick={() => setShowQRCode(null)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg">Zavrieť</button>
                    </div>
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
                            <label className="block text-sm font-medium text-gray-700">Meno a Priezvisko</label>
                            <input type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2 border rounded mt-1" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Používateľské meno</label>
                            <input type="text" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full p-2 border rounded mt-1" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Nové heslo (voliteľné)</label>
                            <input type="password" placeholder="Zadajte pre zmenu" onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full p-2 border rounded mt-1" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Rola</label>
                            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded mt-1">
                                <option value="employee">Zamestnanec</option>
                                <option value="manager">Manažér</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Strediská</label>
                             <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border p-2 rounded-md">
                                {costCenters.map(center => (
                                    <div key={center.id} className="flex items-center">
                                        <input
                                            id={`center-${center.id}`}
                                            type="checkbox"
                                            checked={editingUser.costCenters?.includes(center.id) || false}
                                            onChange={e => {
                                                const newCenters = e.target.checked
                                                    ? [...(editingUser.costCenters || []), center.id]
                                                    : (editingUser.costCenters || []).filter(id => id !== center.id);
                                                setEditingUser({ ...editingUser, costCenters: newCenters });
                                            }}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                        <label htmlFor={`center-${center.id}`} className="ml-2 block text-sm text-gray-900">{center.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <input
                                id="canSelectManuallyEdit"
                                type="checkbox"
                                checked={editingUser.can_select_project_manually || false}
                                onChange={e => setEditingUser({ ...editingUser, can_select_project_manually: e.target.checked })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                            <label htmlFor="canSelectManuallyEdit" className="ml-2 block text-sm text-gray-900">Môže manuálne vyberať projekty</label>
                        </div>
                         <div className="flex space-x-2 pt-4 border-t">
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúci Používatelia ({users.length})</h3>
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex-1">
                                <p className="font-medium">{user.name} {user.blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Zablokovaný</span>}</p>
                                <p className="text-sm text-gray-600">@{user.username} - {user.role}</p>
                                {(user.costCenters?.length > 0) &&
                                    <div className="mt-2 flex flex-wrap gap-1 items-center">
                                        <Building2 className="w-4 h-4 text-gray-500"/>
                                        {user.costCenters.map(centerId => {
                                            const center = costCenters.find(c => c.id === centerId);
                                            return <span key={centerId} className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full">{center?.name || 'Neznáme'}</span>
                                        })}
                                    </div>
                                }
                            </div>
                            <div className="flex items-center space-x-1 self-end sm:self-center">
                                {(user.role === 'employee') &&
                                    <button onClick={() => generateQRCode(user)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                }
                                <button onClick={() => setEditingUser(user)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleUserBlock(user)} title={user.blocked ? "Odblokovať" : "Zablokovať"} className={`p-2 rounded-full ${user.blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{user.blocked ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4" />}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
