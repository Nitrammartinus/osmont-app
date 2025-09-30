import React, { useState, useMemo, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User as UserType, Project } from '../types';
import { User as UserIcon, QrCode, Eye, EyeOff, BarChart3, StopCircle, AlertCircle, ChevronDown } from './Icons';
import QRCodeScanner from './QRCodeScanner';

const Login: React.FC = () => {
    const { handleManualLogin, processQRCode } = useTimeTracker();
    const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('qr');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const onLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleManualLogin(username, password);
        setUsername('');
        setPassword('');
    };

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        await processQRCode(decodedText);
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
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
                                Naskenovať QR Používateľa
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
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200">Prihlásiť</button>
                    </form>
                )}
            </div>
        </>
    );
};


const StartTracking: React.FC = () => {
    const { processQRCode, currentUser, projects, startSession } = useTimeTracker();
    const [isScanning, setIsScanning] = useState(false);
    
    const userProjects = useMemo(() => {
        if (!currentUser?.costCenters) return [];
        return projects.filter(p => currentUser.costCenters.includes(p.cost_center_id) && !p.closed);
    }, [currentUser, projects]);

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        await processQRCode(decodedText);
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 text-center">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Spustiť Novú Reláciu</h2>
                
                {currentUser?.can_select_project_manually && userProjects.length > 0 && (
                     <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-700 mb-2">Manuálny výber projektu</h3>
                        <div className="relative">
                             <select
                                onChange={(e) => { if(e.target.value) startSession(e.target.value) }}
                                className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                defaultValue=""
                            >
                                <option value="" disabled>Vyberte projekt...</option>
                                {userProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                     </div>
                )}
                
                <div className="bg-gray-100 rounded-xl p-6">
                    <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Naskenujte QR kód projektu pre spustenie relácie.</p>
                    <button onClick={() => setIsScanning(true)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        Naskenovať QR Projektu
                    </button>
                </div>
            </div>
        </>
    );
};

const ActiveSessions: React.FC = () => {
    const { activeSessions, sessionTimers, projects, costCenters } = useTimeTracker();
    const [filter, setFilter] = useState<string>('all');

    const filteredSessions = useMemo(() => {
        if (filter === 'all') return activeSessions;
        return activeSessions.filter(s => s.costCenterId === parseInt(filter));
    }, [activeSessions, filter]);
    
    const formatTime = (milliseconds: number) => {
        if (isNaN(milliseconds) || milliseconds < 0) return '00:00:00';
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-lg font-semibold text-gray-800">Aktívne Relácie ({filteredSessions.length})</h2>
                <div className="flex items-center gap-2">
                     <label htmlFor="cost-center-filter" className="text-sm font-medium text-gray-700">Filter:</label>
                     <select 
                        id="cost-center-filter"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Všetky strediská</option>
                        {costCenters.map(center => (
                            <option key={center.id} value={center.id}>{center.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {filteredSessions.length > 0 ? (
                <div className="space-y-4">
                    {filteredSessions.map(session => {
                        const project = projects.find(p => p.id === session.projectId);
                        const costCenter = costCenters.find(c => c.id === project?.cost_center_id);
                        return (
                            <div key={session.id} className={'rounded-lg p-4 border-l-4 border-gray-300 bg-gray-50'}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center mb-1">
                                            <UserIcon className="w-4 h-4 text-gray-600 mr-2" />
                                            <p className="font-medium text-gray-800">{session.userName}</p>
                                        </div>
                                        <p className="text-sm text-gray-700 font-medium">{session.projectName}</p>
                                        <div className='flex items-center gap-2 mt-1'>
                                            {project?.closed && <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full inline-block">Projekt Uzatvorený</span>}
                                            {costCenter && <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded-full inline-block">{costCenter.name}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="font-mono text-xl font-bold text-blue-600">{sessionTimers[session.id] ? formatTime(sessionTimers[session.id]) : '00:00:00'}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Žiadne aktívne relácie pre zvolený filter.</p>
                </div>
            )}
        </div>
    );
};

const MainTrackingView: React.FC = () => {
    const { currentUser, setCurrentUser, activeSessions, userForStopConfirmation, setUserForStopConfirmation, stopSessionForUser, sessionTimers, isLoading, error } = useTimeTracker();
    const userHasActiveSession = activeSessions.some(s => s.userId === currentUser?.id);

    const sessionToStop = useMemo(() => {
        if (!userForStopConfirmation) return null;
        return activeSessions.find(s => s.userId === userForStopConfirmation.id);
    }, [userForStopConfirmation, activeSessions]);

    const handleStopSession = async () => {
        if (userForStopConfirmation) {
            await stopSessionForUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
    };

    const handleCancelStop = () => {
        // New logic: if admin/manager, log them in instead of just closing
        if (userForStopConfirmation && (userForStopConfirmation.role === 'admin' || userForStopConfirmation.role === 'manager')) {
            setCurrentUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
    };
    
    const formatTime = (milliseconds: number) => {
        if (isNaN(milliseconds) || milliseconds < 0) return '00:00:00';
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    if (isLoading) {
        return <div className="text-center"><p>Načítava sa aplikácia...</p></div>
    }
    
    if (error) {
         return (
            <div className="text-center bg-red-50 border border-red-200 p-8 rounded-lg max-w-lg mx-auto">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4"/>
                <h2 className="text-xl font-bold text-red-800 mb-2">Chyba Pripojenia</h2>
                <p className="text-red-700">{error}</p>
                <p className="text-red-600 text-sm mt-4">Uistite sa, že backend server beží a je dostupný. Obnovte stránku po chvíli.</p>
            </div>
        );
    }


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
                            <p className="text-gray-600">Chystáte sa zastaviť aktívnu reláciu pre projekt <strong>{sessionToStop.projectName}</strong>.</p>
                            <p className="text-lg text-gray-800 mt-2 font-mono">
                                {sessionTimers[sessionToStop.id] ? formatTime(sessionTimers[sessionToStop.id]) : '00:00:00'}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={handleCancelStop} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl">Zrušiť</button>
                            <button onClick={handleStopSession} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center">
                                <StopCircle className="w-5 h-5 mr-2" /> Zastaviť Reláciu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainTrackingView;
