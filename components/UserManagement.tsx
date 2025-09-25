
import React, { useState } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, UserRole } from '../types';
import { UserPlus, Edit, Trash2, Ban, Check, QrCode, ChevronLeft, Download } from './Icons';

const UserManagement: React.FC = () => {
    const { users, setUsers } = useTimeTracker();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: 'employee' });
    const [showQRCode, setShowQRCode] = useState<{ user: User, content: string } | null>(null);

    const handleAddUser = () => {
        if (!newUser.name || !newUser.username || !newUser.password) {
            alert('Please fill all fields for the new user.');
            return;
        }
        if (users.some(u => u.username === newUser.username)) {
            alert('Username already exists.');
            return;
        }
        const userToAdd: User = {
            id: `user${Date.now()}`,
            name: newUser.name,
            username: newUser.username,
            password: newUser.password,
            role: newUser.role || 'employee',
            blocked: false,
        };
        setUsers(prev => [...prev, userToAdd]);
        setNewUser({ name: '', username: '', password: '', role: 'employee' });
    };

    const handleUpdateUser = () => {
        if (!editingUser) return;
        if (users.some(u => u.username === editingUser.username && u.id !== editingUser.id)) {
            alert('Username already exists.');
            return;
        }
        setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
        setEditingUser(null);
    };

    const handleDeleteUser = (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
    };
    
    const toggleUserBlock = (userId: string) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, blocked: !u.blocked } : u));
    };

    const generateQRCode = (user: User) => {
        setShowQRCode({ user, content: `USER_ID:${user.id}` });
    };

    if (showQRCode) {
        return (
             <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <button onClick={() => setShowQRCode(null)} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to User List
                </button>
                <div className="text-center">
                    <QrCode className="w-24 h-24 text-blue-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">User QR Code</h2>
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
                        <Download className="w-4 h-4 mr-2" /> Download
                    </button>
                </div>
            </div>
        );
    }
    
    if (editingUser) {
        return (
            <div className="max-w-2xl mx-auto">
                 <div className="bg-white rounded-2xl shadow-xl p-6">
                     <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Edit className="w-5 h-5 mr-2 text-blue-600" />Edit User: {editingUser.name}</h3>
                     <div className="space-y-4">
                         <input type="text" placeholder="Full Name" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2 border rounded" />
                         <input type="text" placeholder="Username" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full p-2 border rounded" />
                         <input type="password" placeholder="New Password (optional)" onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full p-2 border rounded" />
                         <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                         </select>
                         <div className="flex space-x-2">
                            <button onClick={handleUpdateUser} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save</button>
                            <button onClick={() => setEditingUser(null)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                         </div>
                     </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-blue-600" />Add New User</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Full Name" value={newUser.name || ''} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="Username" value={newUser.username || ''} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full p-2 border rounded" />
                    <input type="password" placeholder="Password" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border rounded" />
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                 <button onClick={handleAddUser} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Add User</button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Existing Users ({users.length})</h3>
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-medium">{user.name} {user.blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Blocked</span>}</p>
                                <p className="text-sm text-gray-600">@{user.username} - {user.role}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => generateQRCode(user)} title="QR Code" className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full"><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => setEditingUser(user)} title="Edit" className="p-2 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600 rounded-full"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => toggleUserBlock(user.id)} title={user.blocked ? "Unblock" : "Block"} className={`p-2 rounded-full ${user.blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-600'}`}>{user.blocked ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4" />}</button>
                                <button onClick={() => handleDeleteUser(user.id)} title="Delete" className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
