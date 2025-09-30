import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Clock, User, LogOut, Settings, FolderPlus, TrendingUp, Building2 } from './Icons';

const Header: React.FC = () => {
    const { currentUser, setCurrentUser, isAdmin, isManager } = useTimeTracker();
    const navigate = useNavigate();

    const handleLogout = () => {
        setCurrentUser(null);
        navigate('/');
    };
    
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    return (
        <header className="bg-white shadow-md p-4 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
                    <Clock className="w-8 h-8 text-blue-600" />
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Project Timer</h1>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-2">
                    {currentUser && (
                         <>
                            {(isManager || isAdmin) && (
                                <button onClick={() => navigate('/evaluation')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Vyhodnotenie">
                                    <TrendingUp className="w-5 h-5" />
                                </button>
                            )}
                            {(isManager || isAdmin) && (
                                <button onClick={() => navigate('/projects')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa Projektov">
                                    <FolderPlus className="w-5 h-5" />
                                </button>
                            )}
                            {isAdmin && (
                                <button onClick={() => navigate('/users')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa Používateľov">
                                    <Settings className="w-5 h-5" />
                                </button>
                            )}
                             {isAdmin && (
                                <button onClick={() => navigate('/cost-centers')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa Stredísk">
                                    <Building2 className="w-5 h-5" />
                                </button>
                            )}
                         </>
                    )}
                   
                    {currentUser && (
                        <div className="flex items-center space-x-2 pl-2">
                             <div className="hidden sm:flex items-center bg-blue-50 px-3 py-1.5 rounded-full">
                                <User className="w-4 h-4 text-blue-600 mr-2" />
                                <span className="text-sm font-medium text-blue-800">{currentUser.name}</span>
                                <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full capitalize">{currentUser.role}</span>
                            </div>
                             <div className="sm:hidden flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm">
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
