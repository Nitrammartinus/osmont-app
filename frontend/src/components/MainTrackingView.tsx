import React, { useState, useMemo } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User as UserIcon, QrCode, Eye, EyeOff, BarChart3, StopCircle, AlertCircle, ChevronDown } from './Icons';
import QRCodeScanner from './QRCodeScanner';
import { Project, User, CostCenter } from '../types';

const Login: React.FC = () => {
    const { handleManualLogin } = useTimeTracker();
    const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('qr');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const onLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        const success = await handleManualLogin(username, password);
        if (success) {
            setUsername('');
            setPassword('');
        }
        setIsLoggingIn(false);
    };

    return (
        <>
            {isScanning && <QRCodeScanner onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                <div className="flex justify-center mb-4">
                    <div className="inline-flex bg-gray-100 rounded-lg p-1">
                        <button onClick={() => setLoginMethod('qr')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${loginMethod === 'qr' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                            QR Kód
                        </button>
                        <button onClick={() => setLoginMethod('manual')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${loginMethod === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                            Manuálne
                        </button>
                    </div>
                </div>

                {loginMethod === 'qr' ? (
                    <div className="text-center max-w-sm mx-auto">
                        <div className="bg-gray-100 rounded-xl p-6">
                            <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Naskenujte svoj QR kód pre prihlásenie.</p>
                            <button onClick={() => setIsScanning(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
                                <QrCode className="w-5 h-5 mr-2" />
                                Naskenovať QR kód
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={onLoginSubmit} className="space-y-4 max-w-sm mx-auto">
                        <div>
                            <input type="text" placeholder="Používateľské meno" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} placeholder="Heslo" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-12" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isLoggingIn ? 'Prihlasujem...' : 'Prihlásiť'}
                        </button>
                    </form>
                )}
            </div>
        </>
    );
};

const formatTime = (milliseconds: number) => {
    if (isNaN(milliseconds) || milliseconds < 0) return '00:00:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const StartTracking: React.FC = () => {
    const { currentUser, projects, startSession } = useTimeTracker();
    const [isScanning, setIsScanning] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');

    const availableProjects = useMemo(() => {
        if (!currentUser || !currentUser.costCenters) return [];
        return projects.filter(p => !p.closed && currentUser.costCenters.includes(p.cost_center_id));
    }, [currentUser, projects]);

    const handleStart = async () => {
        if (!selectedProject) {
            alert("Prosím, vyberte projekt.");
            return;
        }
        await startSession(selectedProject);
        setSelectedProject('');
    }

    return (
        <>
            {isScanning && <QRCodeScanner onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 text-center">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Spustiť novú reláciu</h2>
                
                {currentUser?.can_select_project_manually && availableProjects.length > 0 && (
                     <div className="max-w-sm mx-auto mb-6">
                        <div className="relative">
                            <select 
                                value={selectedProject}
                                onChange={e => setSelectedProject(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                            >
                                <option value="">-- Vyberte projekt --</option>
                                {availableProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                        </div>
                        <button onClick={handleStart} disabled={!selectedProject} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            Spustiť reláciu
                        </button>
                    </div>
                )}
                
                <div className="bg-gray-100 rounded-xl p-6 max-w-sm mx-auto">
                    <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                     <p className="text-gray-600 mb-4">
                        {currentUser?.can_select_project_manually ? 'Alebo naskenujte QR kód projektu:' : 'Naskenujte QR kód projektu pre spustenie relácie:'}
                    </p>
                    <button onClick={() => setIsScanning(true)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
                        <QrCode className="w-5 h-5 mr-2" />
                        Naskenovať projekt
                    </button>
                </div>
            </div>
        </>
    );
};

const ActiveSessions: React.FC = () => {
    const { activeSessions, sessionTimers, costCenters, currentUser } = useTimeTracker();
    const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');

    const filteredSessions = useMemo(() => {
        if (selectedCostCenter === 'all') return activeSessions;
        return activeSessions.filter(s => s.cost_center_id === parseInt(selectedCostCenter));
    }, [activeSessions, selectedCostCenter]);

    const userCanFilter = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Aktívne relácie</h2>
                {userCanFilter && costCenters.length > 0 && (
                     <div className="relative mt-2 sm:mt-0">
                        <select 
                            value={selectedCostCenter}
                            onChange={(e) => setSelectedCostCenter(e.target.value)}
                            className="text-sm px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                        >
                            <option value="all">Všetky strediská</option>
                            {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                        </select>
                         <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                )}
                 <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mt-2 sm:mt-0">{filteredSessions.length} aktívnych</div>
            </div>

            {filteredSessions.length > 0 ? (
                <div className="space-y-4">
                    {filteredSessions.map(session => (
                        <div key={session.id} className="rounded-lg p-4 bg-gray-50 border-l-4 border-gray-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center mb-1">
                                        <UserIcon className="w-4 h-4 text-gray-600 mr-2" />
                                        <p className="font-medium text-gray-800">{session.user_name}</p>
                                    </div>
                                    <p className="text-sm text-gray-700 font-medium">{session.project_name}</p>
                                    <p className="text-xs text-gray-500 mt-1 bg-gray-200 px-2 py-0.5 rounded-full inline-block">{session.cost_center_name}</p>
                                </div>
                                <div className="text-right ml-4">
                                    <p className="font-mono text-xl font-bold text-blue-600">{formatTime(sessionTimers[session.id])}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Žiadne aktívne relácie.</p>
                </div>
            )}
        </div>
    );
};

const MainTrackingView: React.FC = () => {
    const { currentUser, setCurrentUser, activeSessions, userForStopConfirmation, setUserForStopConfirmation, stopSessionForUser, sessionTimers, projects, isManager, isAdmin } = useTimeTracker();
    
    const userHasActiveSession = useMemo(() => {
        return activeSessions.some(s => s.user_id === currentUser?.id);
    }, [activeSessions, currentUser]);

    const sessionToStop = useMemo(() => {
        if (!userForStopConfirmation) return null;
        return activeSessions.find(s => s.user_id === userForStopConfirmation.id);
    }, [userForStopConfirmation, activeSessions]);
    
    const projectForSessionToStop = useMemo(() => {
        if (!sessionToStop) return null;
        return projects.find(p => p.id === sessionToStop.project_id);
    }, [sessionToStop, projects]);


    const handleStopSession = async () => {
        if (userForStopConfirmation) {
            await stopSessionForUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
    };

    const handleCancelStop = () => {
        if (isAdmin || isManager) {
            // Log in the admin/manager and close the modal
            setCurrentUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
    };

    return (
        <div className="max-w-4xl mx-auto">
            {!currentUser && !userForStopConfirmation && <Login />}
            {currentUser && !userHasActiveSession && <StartTracking />}
            <div className="mt-6">
                <ActiveSessions />
            </div>

            {sessionToStop && userForStopConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <StopCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Zastaviť reláciu pre {userForStopConfirmation.name}?</h3>
                            <p className="text-gray-600">Chystáte sa zastaviť aktívnu reláciu pre projekt <strong>{projectForSessionToStop?.name || 'Neznámy projekt'}</strong>.</p>
                            <p className="text-lg text-gray-800 mt-2 font-mono">
                                {formatTime(sessionTimers[sessionToStop.id])}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={handleCancelStop} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl">Zrušiť</button>
                            <button onClick={handleStopSession} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center">
                                <StopCircle className="w-5 h-5 mr-2" /> Zastaviť reláciu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainTrackingView;
