import React, { useState, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, UserRole, CostCenter } from '../types';
import { UserPlus, Edit, Trash2, Ban, Check, QrCode, ChevronLeft, Download } from './Icons';
// FIX: Changed import from default 'QRCode' to named 'QRCodeCanvas' to fix component type error.
import { QRCodeCanvas } from 'qrcode.react';

const UserManagement: React.FC = () => {
    const { users, costCenters, addUser, updateUser, deleteUser } = useTimeTracker();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
    const [showQRCode, setShowQRCode] = useState<User | null>(null);

    const handleSaveUser = async () => {
        if (editingUser) { // Update
            const success = await updateUser(editingUser);
            if (success) {
                setEditingUser(null);
            }
        } else { // Add
             if (!newUser.name || !newUser.username || !newUser.password || !newUser.role) {
                alert('Prosím, vyplňte všetky polia pre nového používateľa.');
                return;
            }
            const success = await addUser(newUser as Omit<User, 'id' | 'blocked'>);
            if (success) {
                setNewUser({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] });
            }
        }
    };
    
    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Naozaj chcete zmazať tohto používateľa?')) {
            await deleteUser(userId);
        }
    };
    
    const handleToggleBlock = async (user: User) => {
        await updateUser({ ...user, blocked: !user.blocked });
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
                        {/* FIX: Used QRCodeCanvas and added an ID for robust selection in download logic. */}
                        <QRCodeCanvas id="qr-code-user" value={qrContent} size={256} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mt-4">QR kód Používateľa</h2>
                    <p className="text-gray-600 mb-4">{showQRCode.name}</p>
                    <button
                        onClick={() => {
                            // FIX: Select canvas by a unique ID to prevent conflicts.
                            const canvas = document.getElementById('qr-code-user') as HTMLCanvasElement;
                            if (canvas) {
                                const link = document.createElement('a');
                                link.href = canvas.toDataURL('image/png');
                                link.download = `qr_pouzivatel_${showQRCode.username}.png`;
                                link.click();
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
            <UserForm 
                user={editingUser} 
                setUser={setEditingUser}
                onSave={handleSaveUser} 
                onCancel={() => setEditingUser(null)}
                allCostCenters={costCenters}
                isEditing={true}
            />
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <UserForm 
                user={newUser}
                setUser={setNewUser}
                onSave={handleSaveUser}
                onCancel={() => setNewUser({ name: '', username: '', password: '', role: 'employee', can_select_project_manually: false, costCenters: [] })}
                allCostCenters={costCenters}
                isEditing={false}
            />
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existujúci Používatelia ({users.length})</h3>
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-medium">{user.name} {user.blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Zablokovaný</span>}</p>
                                <p className="text-sm text-gray-600">@{user.username} - {user.role}</p>
                            </div>
                            <div className="flex items-center space-x-1 sm:space-x-2">
                                {user.role === 'employee' && <button onClick={() => setShowQRCode(user)} title="QR kód" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>}
                                <button onClick={() => setEditingUser(user)} title="Upraviť" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleToggleBlock(user)} title={user.blocked ? "Odblokovať" : "Zablokovať"} className={`p-2 rounded-full ${user.blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{user.blocked ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4" />}</button>
                                <button onClick={() => handleDeleteUser(user.id)} title="Zmazať" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface UserFormProps {
    user: Partial<User>;
    setUser: React.Dispatch<React.SetStateAction<any>>;
    onSave: () => void;
    onCancel: () => void;
    allCostCenters: CostCenter[];
    isEditing: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ user, setUser, onSave, onCancel, allCostCenters, isEditing }) => {
    
    const handleCostCenterChange = (centerId: string) => {
        const currentCenters = user.costCenters || [];
        const newCenters = currentCenters.includes(centerId)
            ? currentCenters.filter(id => id !== centerId)
            : [...currentCenters, centerId];
        setUser({ ...user, costCenters: newCenters });
    };
    
    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                {isEditing ? <><Edit className="w-5 h-5 mr-2 text-blue-600" />Upraviť Používateľa: {user.name}</> : <><UserPlus className="w-5 h-5 mr-2 text-blue-600" />Pridať Používateľa</>}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Celé Meno</label>
                    <input type="text" value={user.name || ''} onChange={e => setUser({...user, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Používateľské meno</label>
                    <input type="text" value={user.username || ''} onChange={e => setUser({...user, username: e.target.value})} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{isEditing ? "Nové heslo (voliteľné)" : "Heslo"}</label>
                    <input type="password" placeholder={isEditing ? "Ponechať pôvodné" : ""} value={user.password || ''} onChange={e => setUser({...user, password: e.target.value})} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                    <select value={user.role} onChange={e => setUser({...user, role: e.target.value as UserRole})} className="w-full p-2 border rounded-lg">
                        <option value="employee">Zamestnanec</option>
                        <option value="manager">Manažér</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 mb-1">Priradené Strediská</label>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg border max-h-40 overflow-y-auto">
                        {allCostCenters.map(center => (
                            <label key={center.id} className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    checked={user.costCenters?.includes(center.id)}
                                    onChange={() => handleCostCenterChange(center.id)}
                                />
                                <span>{center.name}</span>
                            </label>
                        ))}
                     </div>
                </div>
                 <div className="md:col-span-2 flex items-center">
                    <input
                        id="canSelect"
                        type="checkbox"
                        checked={user.can_select_project_manually}
                        onChange={e => setUser({ ...user, can_select_project_manually: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="canSelect" className="ml-2 block text-sm text-gray-900">
                        Povoliť manuálny výber projektu (okrem QR kódu)
                    </label>
                </div>
            </div>
            <div className="flex space-x-2 mt-4">
                 <button onClick={onSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Uložiť</button>
                 {!isEditing && <button onClick={onCancel} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Zrušiť</button>}
            </div>
        </div>
    );
}


export default UserManagement;