import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, UserRole, CostCenter } from '../types';
import { UserPlus, Edit, Trash2, Ban, Check, QrCode, ChevronLeft, Download } from './Icons';
import { QRCodeCanvas } from 'qrcode.react';

const UserManagement: React.FC = () => {
    const { users, costCenters, addUser, updateUser, deleteUser } = useTimeTracker();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
    const [showQRCode, setShowQRCode] = useState<User | null>(null);

    const handleAddUserClick = async () => {
        if (!newUser.name || !newUser.username || !newUser.password) {
            alert('Prosím, vyplňte meno, používateľské meno a heslo.');
            return;
        }
        await addUser(newUser as User);
        setNewUser({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
    };

    const handleUpdateUserClick = async () => {
        if (!editingUser) return;
        await updateUser(editingUser);
        setEditingUser(null);
    };
    
    const handleCostCenterChange = (centerId: number, isChecked: boolean, isEditing: boolean) => {
        // FIX: Use type-safe approach for updating state based on whether we are editing or creating a new user.
        if (isEditing) {
            setEditingUser(prev => {
                if (!prev) return null;
                const currentCenters = prev.costCenters || [];
                const updatedCenters = isChecked
                    ? [...currentCenters, centerId]
                    : currentCenters.filter(id => id !== centerId);
                return { ...prev, costCenters: updatedCenters };
            });
        } else {
            setNewUser(prev => {
                const currentCenters = prev.costCenters || [];
                const updatedCenters = isChecked
                    ? [...currentCenters, centerId]
                    : currentCenters.filter(id => id !== centerId);
                return { ...prev, costCenters: updatedCenters };
            });
        }
    }

    const downloadQRCode = (userId: string) => {
        const canvas = document.getElementById(`qr-canvas-${userId}`) as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
            let downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            const user = users.find(u => u.id === userId);
            downloadLink.download = `user_qr_${user?.username || userId}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };


    if (showQRCode) {
        const qrContent = `USER_ID:${showQRCode.id}`;
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Späť na zoznam
                </button>
                <div className="text-center">
                    <div className="p-4 bg-white inline-block rounded-lg border">
                       <QRCodeCanvas id={`qr-canvas-${showQRCode.id}`} value={qrContent} size={256} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mt-4">QR Kód pre Používateľa</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.name}</p>
                    <button onClick={() => downloadQRCode(showQRCode.id)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
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
                     <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Edit className="w-5 h-5 mr-2 text-blue-600" />Upraviť používateľa: {editingUser.name}</h3>
                     <div className="space-y-4">
                        {/* Form fields... */}
                        <div className="flex space-x-2">
                            <button onClick={handleUpdateUserClick} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Uložiť</button>
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-blue-600" />Pridať nového používateľa</h3>
                {/* Form fields... */}
                 <button onClick={handleAddUserClick} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Pridať Používateľa</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúci používatelia ({users.length})</h3>
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-medium">{user.name} {user.blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Zablokovaný</span>}</p>
                                <p className="text-sm text-gray-600">@{user.username} - {user.role}</p>
                                <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1">
                                    {user.costCenters?.map(ccId => {
                                        const center = costCenters.find(c => c.id === ccId);
                                        return <span key={ccId} className="inline-block bg-gray-200 text-gray-800 px-2 py-0.5 rounded">{center?.name || 'Neznáme'}</span>
                                    })}
                                </p>
                            </div>
                            <div className="flex items-center space-x-1">
                                {user.role === 'employee' && (
                                    <button onClick={() => setShowQRCode(user)} title="QR Kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => setEditingUser(user)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => updateUser({ ...user, blocked: !user.blocked })} title={user.blocked ? "Odblokovať" : "Zablokovať"} className={`p-2 rounded-full ${user.blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{user.blocked ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4" />}</button>
                                <button onClick={() => deleteUser(user.id)} title="Vymazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
