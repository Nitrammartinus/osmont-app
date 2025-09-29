import React, { useState, useMemo, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User as UserType, ActiveSession as ActiveSessionType, Project, CostCenter } from '../types';
import { User, QrCode, Eye, EyeOff, BarChart3, StopCircle, AlertCircle, Clock, Building2 } from './Icons';
import QRCodeScanner from './QRCodeScanner';

const formatTime = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = Date.now();
    const milliseconds = now - start;
    if (isNaN(milliseconds) || milliseconds < 0) return '00:00:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const Login: React.FC = () => {
    const { handleManualLogin, processQRCode } = useTimeTracker();
    const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('qr');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState('');

    const onLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = await handleManualLogin(username, password);
        if (success) {
            setUsername('');
            setPassword('');
        } else {
            setError('Neplatné používateľské meno alebo heslo, alebo je používateľ zablokovaný.');
        }
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
                         {error && <p className="text-red-500 text-sm text-center">{error}</p>}
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
    const { currentUser, processQRCode, startSession, projects } = useTimeTracker();
    const [isScanning, setIsScanning] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    
    const availableProjects = useMemo(() => {
        if (!currentUser || !currentUser.costCenters) return [];
        const userCenterIds = new Set(currentUser.costCenters.map(c => c.id));
        return projects.filter(p => !p.closed && userCenterIds.has(p.cost_center_id));
    }, [currentUser, projects]);

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        await processQRCode(decodedText);
    };

    const handleManualStart = async () => {
        if (selectedProjectId) {
            await startSession(selectedProjectId);
        } else {
            alert("Prosím, vyberte projekt.");
        }
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">Spustiť Novú Reláciu</h2>
                
                {currentUser?.can_select_project_manually && availableProjects.length > 0 && (
                    <div className="mb-6 p-4 border-b">
                         <h3 className="text-md font-semibold text-gray-700 mb-2 text-center">Manuálny výber</h3>
                         <div className="max-w-md mx-auto">
                            <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full p-3 border rounded-lg mb-2">
                                <option value="">Vyberte projekt...</option>
                                {availableProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                             <button onClick={handleManualStart} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl" disabled={!selectedProjectId}>
                                Spustiť vybraný projekt
                            </button>
                        </div>
                    </div>
                )}

                <div className="text-center">
                     <h3 className="text-md font-semibold text-gray-700 mb-2">Skenovanie QR kódu</h3>
                    <div className="bg-gray-100 rounded-xl p-6 max-w-md mx-auto">
                        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Naskenujte QR kód projektu pre spustenie sledovania času.</p>
                        <button onClick={() => setIsScanning(true)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
                            <BarChart3 className="w-5 h-5 mr-2" />
                            Naskenovať QR Projektu
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

const ActiveSessions: React.FC = () => {
    // FIX: Removed unused and non-existent 'setCostCenters' from context.
    const { activeSessions, costCenters } = useTimeTracker(); // Placeholder, assuming these come from context
    const [timers, setTimers] = useState<Record<number, string>>({});
    const [selectedCenterId, setSelectedCenterId] = useState<string>('all');

    useEffect(() => {
        const interval = setInterval(() => {
            const newTimers: Record<number, string> = {};
            activeSessions.forEach(session => {
                newTimers[session.id] = formatTime(session.start_time);
            });
            setTimers(newTimers);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSessions]);

    const filteredSessions = useMemo(() => {
        if (selectedCenterId === 'all') {
            return activeSessions;
        }
        return activeSessions.filter(s => s.cost_center_name === costCenters.find(c => c.id === Number(selectedCenterId))?.name);
    }, [activeSessions, selectedCenterId, costCenters]);

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-2 sm:mb-0">Aktívne Relácie</h2>
                 <div className="flex items-center space-x-2">
                    <select value={selectedCenterId} onChange={e => setSelectedCenterId(e.target.value)} className="p-2 border rounded-lg text-sm">
                        <option value="all">Všetky strediská</option>
                        {costCenters.map(center => (
                            <option key={center.id} value={center.id}>{center.name}</option>
                        ))}
                    </select>
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{filteredSessions.length} aktívnych</div>
                 </div>
            </div>

            {filteredSessions.length > 0 ? (
                <div className="space-y-4">
                    {filteredSessions.map(session => (
                            <div key={session.id} className="rounded-lg p-4 border-l-4 border-gray-300 bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center mb-1">
                                            <User className="w-4 h-4 text-gray-600 mr-2" />
                                            <p className="font-medium text-gray-800">{session.userName}</p>
                                        </div>
                                        <p className="text-sm text-gray-700 font-medium">{session.projectName}</p>
                                        <div className="flex items-center text-xs text-gray-500 mt-1">
                                            <Building2 className="w-3 h-3 mr-1" />
                                            <span>{session.cost_center_name || 'Neznáme'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="font-mono text-xl font-bold text-blue-600">{timers[session.id] || '00:00:00'}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
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
    const { currentUser, userForStopConfirmation, setUserForStopConfirmation, stopSessionForUser, activeSessions, setCurrentUser } = useTimeTracker();
    const [sessionToStop, setSessionToStop] = useState<ActiveSessionType | null>(null);

    useEffect(() => {
        if (userForStopConfirmation) {
            const session = activeSessions.find(s => s.user_id === userForStopConfirmation.id);
            setSessionToStop(session || null);
        } else {
            setSessionToStop(null);
        }
    }, [userForStopConfirmation, activeSessions]);


    const handleStopSession = async () => {
        if (userForStopConfirmation) {
            await stopSessionForUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
    };

    const handleCancelStop = () => {
        // IMPROVEMENT: If user is admin/manager, keep them logged in
        if (userForStopConfirmation && (userForStopConfirmation.role === 'admin' || userForStopConfirmation.role === 'manager')) {
            setCurrentUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
    };

    const userHasActiveSession = activeSessions.some(s => s.user_id === currentUser?.id);

    return (
        <div className="max-w-4xl mx-auto">
            {!currentUser && !userForStopConfirmation && <Login />}
            {currentUser && !userHasActiveSession && <StartTracking />}
            <ActiveSessions />

            {sessionToStop && userForStopConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <StopCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Zastaviť reláciu pre {userForStopConfirmation.name}?</h3>
                            <p className="text-gray-600">Chystáte sa zastaviť aktívnu reláciu pre <strong>{sessionToStop.projectName}</strong>.</p>
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
