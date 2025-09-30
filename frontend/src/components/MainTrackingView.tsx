
import React, { useState, useMemo, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User as UserIcon, QrCode, Eye, EyeOff, BarChart3, StopCircle, AlertCircle, Building2, ChevronDown } from './Icons';
import QRCodeScanner from './QRCodeScanner';
import { ActiveSession, CostCenter, Project, User } from '../types';

const Login: React.FC = () => {
    const { handleManualLogin, processQRCode } = useTimeTracker();
    const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('qr');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const onLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleManualLogin(username, password);
        setUsername('');
        setPassword('');
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={(text) => { setIsScanning(false); processQRCode(text); }} onClose={() => setIsScanning(false)} />}
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
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200">Prihlásiť</button>
                    </form>
                )}
            </div>
        </>
    );
};

const StartTracking: React.FC = () => {
    const { currentUser, processQRCode, projects } = useTimeTracker();
    const [isScanning, setIsScanning] = useState(false);
    
    const userProjects = useMemo(() => {
        return projects.filter(p => !p.closed && currentUser?.costCenters?.includes(p.cost_center_id));
    }, [projects, currentUser]);

    const handleStartSession = (projectId: string) => {
        processQRCode(`PROJECT_ID:${projectId}`);
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={(text) => { setIsScanning(false); processQRCode(text); }} onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">Spustiť novú reláciu</h2>
                
                {currentUser?.can_select_project_manually && userProjects.length > 0 && (
                     <div className="mb-6">
                        <label htmlFor="project-select" className="block text-sm font-medium text-gray-700 mb-2">Alebo vyberte projekt manuálne:</label>
                        <div className="relative">
                            <select 
                                id="project-select"
                                onChange={(e) => handleStartSession(e.target.value)}
                                className="appearance-none w-full bg-gray-100 border-gray-300 border text-gray-900 py-3 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                defaultValue=""
                            >
                                <option value="" disabled>-- Vyberte projekt --</option>
                                {userProjects.map((project: Project) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name} ({project.cost_center_name})
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <ChevronDown className="h-4 w-4" />
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="text-center">
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-2 text-sm text-gray-500">alebo</span>
                      </div>
                    </div>
                    <button onClick={() => setIsScanning(true)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
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
    const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');

    const filteredSessions = useMemo(() => {
        if (selectedCostCenter === 'all') return activeSessions;
        return activeSessions.filter(s => s.cost_center_id === parseInt(selectedCostCenter));
    }, [activeSessions, selectedCostCenter]);
    
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
                {costCenters.length > 0 && (
                     <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-500" />
                        <select
                            onChange={(e) => setSelectedCostCenter(e.target.value)}
                            value={selectedCostCenter}
                            className="bg-gray-100 border-gray-300 border text-gray-900 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="all">Všetky strediská</option>
                            {costCenters.map((center: CostCenter) => (
                                <option key={center.id} value={center.id}>{center.name}</option>
                            ))}
                        </select>
                     </div>
                )}
            </div>

            {filteredSessions.length > 0 ? (
                <div className="space-y-4">
                    {filteredSessions.map((session: ActiveSession) => (
                        <div key={session.id} className="rounded-lg p-4 border-l-4 border-gray-300 bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center mb-1">
                                        <UserIcon className="w-4 h-4 text-gray-600 mr-2" />
                                        <p className="font-medium text-gray-800">{session.user_name}</p>
                                    </div>
                                    <p className="text-sm text-gray-700 font-medium">{session.project_name}</p>
                                    <p className="text-xs text-gray-500 mt-1">{session.cost_center_name}</p>
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
    const { currentUser, setCurrentUser, activeSessions, userForStopConfirmation, setUserForStopConfirmation, stopSessionForUser, sessionTimers, isManager, isAdmin } = useTimeTracker();
    const userHasActiveSession = activeSessions.some(s => s.user_id === currentUser?.id);
    
    const [localUserForStop, setLocalUserForStop] = useState<User | null>(null);

    useEffect(() => {
        setLocalUserForStop(userForStopConfirmation);
    }, [userForStopConfirmation]);


    const sessionToStop = useMemo(() => {
        if (!localUserForStop) return null;
        return activeSessions.find(s => s.user_id === localUserForStop.id);
    }, [localUserForStop, activeSessions]);

    const handleStopSession = async () => {
        if (localUserForStop) {
            await stopSessionForUser(localUserForStop);
        }
        setLocalUserForStop(null);
        setUserForStopConfirmation(null);
    };

    const handleCancelStop = () => {
        if (localUserForStop && (isManager || isAdmin)) {
             setCurrentUser(localUserForStop);
        }
        setLocalUserForStop(null);
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
            {!currentUser && !localUserForStop && <Login />}
            {currentUser && !userHasActiveSession && <StartTracking />}
            <div className="mt-6">
                <ActiveSessions />
            </div>

            {sessionToStop && localUserForStop && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <StopCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Zastaviť reláciu pre {localUserForStop.name}?</h3>
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
