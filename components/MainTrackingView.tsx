import React, { useState, useMemo } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';
import { User, QrCode, Eye, EyeOff, BarChart3, StopCircle, AlertCircle } from './Icons';
import QRCodeScanner from './QRCodeScanner';

const Login: React.FC = () => {
    const { handleManualLogin, processQRCode } = useTimeTracker();
    const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('qr');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const onLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (handleManualLogin(username, password)) {
            setUsername('');
            setPassword('');
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        setIsScanning(false);
        const result = processQRCode(decodedText);
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
                        {['qr', 'manual'].map((method) => (
                            <button
                                key={method}
                                onClick={() => setLoginMethod(method as 'qr' | 'manual')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${loginMethod === method ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                {method === 'qr' ? 'QR Code' : 'Manual Login'}
                            </button>
                        ))}
                    </div>
                </div>

                {loginMethod === 'qr' ? (
                    <div className="text-center max-w-sm mx-auto">
                        <div className="bg-gray-100 rounded-xl p-6">
                            <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Scan your user QR code to begin.</p>
                            <button onClick={() => setIsScanning(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
                                <QrCode className="w-5 h-5 mr-2" />
                                Scan User QR
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={onLoginSubmit} className="space-y-4 max-w-sm mx-auto">
                        <div>
                            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-12" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200">Login</button>
                    </form>
                )}
            </div>
        </>
    );
};


const StartTracking: React.FC = () => {
    const { processQRCode } = useTimeTracker();
    const [isScanning, setIsScanning] = useState(false);

    const handleScanSuccess = (decodedText: string) => {
        setIsScanning(false);
        if (!decodedText.startsWith('PROJECT_ID:')) {
            alert('Invalid QR code. Please scan a valid project QR code.');
            return;
        }
        const result = processQRCode(decodedText);
        if (!result.success) {
            alert(result.message);
        }
    };

    return (
        <>
            {isScanning && <QRCodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 text-center">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Start New Session</h2>
                <div className="bg-gray-100 rounded-xl p-6">
                    <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Scan the project QR code to start tracking time.</p>
                    <button onClick={() => setIsScanning(true)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 flex items-center justify-center mx-auto">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        Scan Project QR
                    </button>
                </div>
            </div>
        </>
    );
};

const ActiveSessions: React.FC = () => {
    const { activeSessions, sessionTimers, currentUser, projects } = useTimeTracker();

    const formatTime = (milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Active Sessions</h2>
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{activeSessions.length} active</div>
            </div>

            {activeSessions.length > 0 ? (
                <div className="space-y-4">
                    {activeSessions.map(session => {
                        const isCurrentUserSession = currentUser?.id === session.userId;
                        const project = projects.find(p => p.id === session.projectId);
                        return (
                            <div key={session.id} className={`rounded-lg p-4 border-l-4 ${isCurrentUserSession ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center mb-1">
                                            <User className="w-4 h-4 text-gray-600 mr-2" />
                                            <p className="font-medium text-gray-800">{session.userName}</p>
                                        </div>
                                        <p className="text-sm text-gray-700 font-medium">{session.projectName}</p>
                                         {project?.closed && <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full mt-1 inline-block">Project Closed</span>}
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="font-mono text-xl font-bold text-blue-600">{sessionTimers[session.id] ? formatTime(sessionTimers[session.id]) : '00:00:00'}</p>
                                        {isCurrentUserSession && <div className="mt-2 text-blue-800 text-xs font-medium py-1 px-2 rounded-full bg-blue-100">Your Session</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No active time tracking sessions.</p>
                </div>
            )}
        </div>
    );
};

const MainTrackingView: React.FC = () => {
    const { currentUser, activeSessions, userForStopConfirmation, setUserForStopConfirmation, stopSessionForUser, sessionTimers } = useTimeTracker();
    const userHasActiveSession = activeSessions.some(s => s.userId === currentUser?.id);

    const sessionToStop = useMemo(() => {
        if (!userForStopConfirmation) return null;
        return activeSessions.find(s => s.userId === userForStopConfirmation.id);
    }, [userForStopConfirmation, activeSessions]);

    const handleStopSession = () => {
        if (userForStopConfirmation) {
            stopSessionForUser(userForStopConfirmation);
        }
        setUserForStopConfirmation(null);
    };

    const handleCancelStop = () => {
        setUserForStopConfirmation(null);
    };

    const formatTime = (milliseconds: number) => {
        if (isNaN(milliseconds)) return '00:00:00';
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Stop Session for {userForStopConfirmation.name}?</h3>
                            <p className="text-gray-600">You are about to stop the active session for <strong>{sessionToStop.projectName}</strong>.</p>
                            <p className="text-lg text-gray-800 mt-2 font-mono">
                                {sessionTimers[sessionToStop.id] ? formatTime(sessionTimers[sessionToStop.id]) : '00:00:00'}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={handleCancelStop} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl">Cancel</button>
                            <button onClick={handleStopSession} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center">
                                <StopCircle className="w-5 h-5 mr-2" /> Stop Session
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainTrackingView;