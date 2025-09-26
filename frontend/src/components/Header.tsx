import React from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { Clock, User, LogOut, Settings, FolderPlus, TrendingUp } from './Icons';

const Header: React.FC = () => {
    const { currentUser, setCurrentUser, isAdmin, isManager, canAccessEvaluation, setCurrentView } = useTimeTracker();

    const handleLogout = () => {
        setCurrentUser(null);
        setCurrentView('tracking');
    };

    return (
        <header className="bg-white shadow-md p-4 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Clock className="w-8 h-8 text-blue-600" />
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Sledovanie Času</h1>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-4">
                    {isAdmin && (
                        <button onClick={() => setCurrentView('userManagement')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa používateľov">
                            <Settings className="w-5 h-5" />
                        </button>
                    )}
                     {(isManager || isAdmin) && (
                        <button onClick={() => setCurrentView('projectManagement')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Správa projektov">
                            <FolderPlus className="w-5 h-5" />
                        </button>
                    )}
                    {canAccessEvaluation && (
                        <button onClick={() => setCurrentView('evaluation')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Vyhodnotenie">
                            <TrendingUp className="w-5 h-5" />
                        </button>
                    )}
                    {currentUser && (
                        <div className="flex items-center space-x-2">
                             <div className="hidden sm:flex items-center bg-blue-50 px-3 py-1.5 rounded-full">
                                <User className="w-4 h-4 text-blue-600 mr-2" />
                                <span className="text-sm font-medium text-blue-800">{currentUser.name}</span>
                                <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full capitalize">{currentUser.role}</span>
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
