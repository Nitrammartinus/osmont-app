import React, { useState, useMemo, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User as UserIcon, QrCode, Eye, EyeOff, BarChart3, StopCircle, AlertCircle, Clock } from './Icons';
import QRCodeScanner from './QRCodeScanner';
import { User, Project, ActiveSession } from '../types';

const Login: React.FC = () => {
    const { handleManualLogin, processQRCode, users } = useTimeTracker();
    const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('qr');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const onLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await handleManualLogin(username, password);
        if (success) {
            setUsername('');
            setPassword('');
        }
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={(text) => { processQRCode(text); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
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


const StartTracking: React.FC<{ user: User }> = ({ user }) => {
    const { processQRCode, projects } = useTimeTracker();
    const [isScanning, setIsScanning] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('');

    const userProjects = useMemo(() => {
        return projects.filter(p => user.costCenters.includes(p.cost_center_id) && !p.closed);
    }, [projects, user]);
    
    const handleStartSession = () => {
        if (!selectedProjectId) {
            alert("Prosím, vyberte projekt.");
            return;
        }
        processQRCode(`PROJECT_ID:${selectedProjectId}`);
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={(text) => { processQRCode(text); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">Spustiť Novú Reláciu</h2>
                
                {user.can_select_project_manually && userProjects.length > 0 && (
                     <div className="bg-gray-50 rounded-xl p-6 text-center mb-6">
                        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Vyberte projekt zo zoznamu</p>
                         <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full max-w-xs mx-auto px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4">
                            <option value="">-- Vyberte projekt --</option>
                            {userProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={handleStartSession} disabled={!selectedProjectId} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto disabled:bg-gray-400 disabled:cursor-not-allowed">
                            <Clock className="w-5 h-5 mr-2" />
                            Spustiť Reláciu
                        </button>
                    </div>
                )}
                
                <div className="bg-gray-100 rounded-xl p-6 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <QrCode className="w-12 h-12 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-4">alebo naskenujte QR kód projektu</p>
                    <button onClick={() => setIsScanning(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
                        <QrCode className="w-5 h-5 mr-2" />
                        Naskenovať QR Projektu
                    </button>
                </div>
            </div>
        </>
    );
};

const ActiveSessions: React.FC = () => {
    const { activeSessions, sessionTimers, costCenters } = useTimeTracker();
    const [filterCenterId, setFilterCenterId] = useState<string>('');

    const formatTime = (milliseconds: number) => {
        if (isNaN(milliseconds) || milliseconds < 0) return '00:00:00';
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const filteredSessions = useMemo(() => {
        if (!filterCenterId) return activeSessions;
        return activeSessions.filter(s => s.cost_center_id === Number(filterCenterId));
    }, [activeSessions, filterCenterId]);

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-lg font-semibold text-gray-800">Aktívne Relácie ({filteredSessions.length})</h2>
                <div className="flex items-center">
                    <label htmlFor="centerFilter" className="text-sm font-medium text-gray-700 mr-2">Filtrovať stredisko:</label>
                    <select id="centerFilter" value={filterCenterId} onChange={e => setFilterCenterId(e.target.value)} className="p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Všetky</option>
                        {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {filteredSessions.length > 0 ? (
                <div className="space-y-4">
                    {filteredSessions.map(session => (
                        <div key={session.id} className={`rounded-lg p-4 border-l-4 border-gray-300 bg-gray-50`}>
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
                                    <p className="font-mono text-xl font-bold text-blue-600">{sessionTimers[session.id] ? formatTime(sessionTimers[session.id]) : '00:00:00'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
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
    const { currentUser, setCurrentUser, activeSessions, userForStopConfirmation, setUserForStopConfirmation, stopSessionForUser, sessionTimers } = useTimeTracker();
    
    const userHasActiveSession = useMemo(() => {
        return activeSessions.some(s => s.user_id === currentUser?.id)
    }, [currentUser, activeSessions]);
    
    const sessionToStop = useMemo(() => {
        if (!userForStopConfirmation) return null;
        return activeSessions.find(s => s.user_id === userForStopConfirmation.id);
    }, [userForStopConfirmation, activeSessions]);

    const handleStopSession = async () => {
        if (userForStopConfirmation) {
            await stopSessionForUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
        setCurrentUser(null);
    };

    const handleCancelStop = () => {
        // Kľúčová logika: Ak je to admin/manažér, prihlásime ho. Inak ho odhlásime.
        if (userForStopConfirmation && (userForStopConfirmation.role === 'admin' || userForStopConfirmation.role === 'manager')) {
            setCurrentUser(userForStopConfirmation);
        } else {
            setCurrentUser(null);
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

    return (
        <div className="max-w-4xl mx-auto">
            {!currentUser && !userForStopConfirmation && <Login />}
            {currentUser && !userHasActiveSession && <StartTracking user={currentUser} />}
            <ActiveSessions />

            {sessionToStop && userForStopConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <StopCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Zastaviť reláciu pre {userForStopConfirmation.name}?</h3>
                            <p className="text-gray-600">Chystáte sa zastaviť aktívnu reláciu pre projekt <strong>{sessionToStop.project_name}</strong>.</p>
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
