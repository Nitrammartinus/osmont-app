import React from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Clock, User, LogOut, Settings, FolderPlus, TrendingUp, Building2 } from './Icons';
import { useNavigate } from 'react-router-dom';

const getInitials = (name: string): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

const Header: React.FC = () => {
    const { currentUser, setCurrentUser } = useTimeTracker();
    const navigate = useNavigate();

    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser'); // Also clear from storage
        navigate('/');
    };

    return (
        <header className="bg-white shadow-md p-4 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
                    <Clock className="w-8 h-8 text-blue-600" />
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Project Timer</h1>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-4">
                    {isAdmin && (
                        <button onClick={() => navigate('/cost-centers')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa Stredísk">
                            <Building2 className="w-5 h-5" />
                        </button>
                    )}
                    {isAdmin && (
                        <button onClick={() => navigate('/users')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa Používateľov">
                            <Settings className="w-5 h-5" />
                        </button>
                    )}
                     {(isManager || isAdmin) && (
                        <button onClick={() => navigate('/projects')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa Projektov">
                            <FolderPlus className="w-5 h-5" />
                        </button>
                    )}
                    {(isManager || isAdmin) && (
                        <button onClick={() => navigate('/evaluation')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Vyhodnotenie">
                            <TrendingUp className="w-5 h-5" />
                        </button>
                    )}
                    {currentUser && (
                        <div className="flex items-center space-x-2">
                             <div className="hidden sm:flex items-center bg-blue-50 px-3 py-1.5 rounded-full">
                                <User className="w-4 h-4 text-blue-600 mr-2" />
                                <span className="text-sm font-medium text-blue-800">{currentUser.name}</span>
                            </div>
                            <div className="sm:hidden w-8 h-8 bg-blue-500 text-white flex items-center justify-center rounded-full font-bold text-sm">
                                {getInitials(currentUser.name)}
                            </div>
                            <button onClick={handleLogout} className="p-2 rounded-full text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors" title="Odhlásiť">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
