import React, { useState, useMemo, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User as UserIcon, QrCode, Eye, EyeOff, BarChart3, StopCircle, AlertCircle, Users, CheckCircle } from './Icons';
import QRCodeScanner from './QRCodeScanner';

const formatTime = (startTime: string | number): string => {
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return '00:00:00';
    
    const elapsed = Date.now() - start;
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};


const Login: React.FC = () => {
    const { handleManualLogin, processQRCode } = useTimeTracker();
    const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('manual');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [loading, setLoading] = useState(false);

    const onLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const success = await handleManualLogin(username, password);
        setLoading(false);
        if (success) {
            setUsername('');
            setPassword('');
        }
    };

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        setLoading(true);
        const result = await processQRCode(decodedText);
        setLoading(false);
        if (!result.success) {
            alert(result.message);
        }
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                <div className="flex justify-center mb-4">
                    <div className="inline-flex bg-gray-100 rounded-lg p-1">
                        {['manual', 'qr'].map((method) => (
                            <button
                                key={method}
                                onClick={() => setLoginMethod(method as 'qr' | 'manual')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${loginMethod === method ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                {method === 'qr' ? 'QR Kód' : 'Manuálne Prihlásenie'}
                            </button>
                        ))}
                    </div>
                </div>

                {loginMethod === 'qr' ? (
                    <div className="text-center max-w-sm mx-auto">
                        <div className="bg-gray-100 rounded-xl p-6">
                            <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Naskenujte QR kód pre zastavenie existujúcej relácie.</p>
                            <button onClick={() => setIsScanning(true)} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto disabled:opacity-50">
                                {loading ? 'Spracúvam...' : <><QrCode className="w-5 h-5 mr-2" /> Skenovať QR</>}
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
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 disabled:opacity-50">{loading ? 'Prihlasujem...' : 'Prihlásiť'}</button>
                    </form>
                )}
            </div>
        </>
    );
};

const StartTracking: React.FC = () => {
    const { currentUser, processQRCode, projects } = useTimeTracker();
    const [isScanning, setIsScanning] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        if (!decodedText.startsWith('PROJECT_ID:')) {
            alert('Neplatný QR kód. Prosím, naskenujte platný QR kód projektu.');
            return;
        }
        setLoading(true);
        const result = await processQRCode(decodedText);
        setLoading(false);
        if (!result.success) {
            alert(result.message);
        }
    };
    
    const handleManualStart = async () => {
        if (!selectedProjectId) {
            alert("Prosím, vyberte projekt.");
            return;
        }
        setLoading(true);
        const result = await processQRCode(`PROJECT_ID:${selectedProjectId}`);
        setLoading(false);
        if (!result.success) {
            alert(result.message);
        }
    }

    const availableProjects = projects.filter(p => !p.closed);

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 text-center">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Štart Novej Relácie</h2>
                
                {currentUser?.can_select_project_manually && availableProjects.length > 0 && (
                     <div className="bg-gray-50 rounded-xl p-6 mb-6">
                        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Vyberte projekt pre manuálny štart.</p>
                         <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg mb-4">
                            <option value="">-- Vyberte projekt --</option>
                            {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={handleManualStart} disabled={loading || !selectedProjectId} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto disabled:opacity-50">
                             {loading ? 'Štartujem...' : <><CheckCircle className="w-5 h-5 mr-2" /> Manuálny Štart</>}
                        </button>
                    </div>
                )}
                
                <div className="bg-gray-100 rounded-xl p-6">
                    <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Naskenujte QR kód projektu pre štart sledovania.</p>
                    <button onClick={() => setIsScanning(true)} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto disabled:opacity-50">
                        {loading ? 'Spracúvam...' : <><BarChart3 className="w-5 h-5 mr-2" /> Skenovať QR Projektu</>}
                    </button>
                </div>
            </div>
        </>
    );
};

const ActiveSessions: React.FC = () => {
    const { activeSessions, currentUser, projects } = useTimeTracker();
    const [timers, setTimers] = useState<Record<string, string>>({});

    useEffect(() => {
        const interval = setInterval(() => {
            const newTimers: Record<string, string> = {};
            activeSessions.forEach(session => {
                newTimers[session.id] = formatTime(session.start_time);
            });
            setTimers(newTimers);
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSessions]);

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Aktívne Relácie</h2>
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{activeSessions.length} aktívnych</div>
            </div>

            {activeSessions.length > 0 ? (
                <div className="space-y-4">
                    {activeSessions.map(session => {
                        const isCurrentUserSession = currentUser?.id === session.user_id;
                        const project = projects.find(p => p.id === session.project_id);
                        return (
                            <div key={session.id} className={`rounded-lg p-4 border-l-4 ${isCurrentUserSession ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center mb-1">
                                            <UserIcon className="w-4 h-4 text-gray-600 mr-2" />
                                            <p className="font-medium text-gray-800">{session.user_name}</p>
                                        </div>
                                        <p className="text-sm text-gray-700 font-medium">{session.project_name}</p>
                                         {project?.closed && <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full mt-1 inline-block">Project Closed</span>}
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="font-mono text-xl font-bold text-blue-600">{timers[session.id] || '00:00:00'}</p>
                                        {isCurrentUserSession && <div className="mt-2 text-blue-800 text-xs font-medium py-1 px-2 rounded-full bg-blue-100">Vaša Relácia</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
    const { currentUser, activeSessions, userForStopConfirmation, setUserForStopConfirmation, stopSessionForUser } = useTimeTracker();
    const userHasActiveSession = activeSessions.some(s => s.user_id === currentUser?.id);
    const [loading, setLoading] = useState(false);

    const sessionToStop = useMemo(() => {
        if (!userForStopConfirmation) return null;
        return activeSessions.find(s => s.user_id === userForStopConfirmation.id);
    }, [userForStopConfirmation, activeSessions]);
    
    const [stopTimer, setStopTimer] = useState('00:00:00');
    useEffect(() => {
        if (sessionToStop) {
            const interval = setInterval(() => {
                setStopTimer(formatTime(sessionToStop.start_time));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [sessionToStop]);


    const handleStopSession = async () => {
        if (userForStopConfirmation) {
            setLoading(true);
            await stopSessionForUser(userForStopConfirmation);
            setLoading(false);
        }
        setUserForStopConfirmation(null);
    };

    const handleCancelStop = () => {
        setUserForStopConfirmation(null);
    };
    
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
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Zastaviť Reláciu pre {userForStopConfirmation.name}?</h3>
                            <p className="text-gray-600">Chystáte sa zastaviť aktívnu reláciu pre projekt <strong>{sessionToStop.project_name}</strong>.</p>
                            <p className="text-lg text-gray-800 mt-2 font-mono">
                                {stopTimer}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={handleCancelStop} disabled={loading} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl disabled:opacity-50">Zrušiť</button>
                            <button onClick={handleStopSession} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center disabled:opacity-50">
                                {loading ? 'Zastavujem...' : <><StopCircle className="w-5 h-5 mr-2" /> Zastaviť Reláciu</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainTrackingView;
