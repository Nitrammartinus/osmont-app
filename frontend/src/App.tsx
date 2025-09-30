import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useTimeTracker } from './hooks/useTimeTracker';
import Header from './components/Header';
import MainTrackingView from './components/MainTrackingView';
import UserManagement from './components/UserManagement';
import ProjectManagement from './components/ProjectManagement';
import EvaluationDashboard from './components/EvaluationDashboard';
import CostCenterManagement from './components/CostCenterManagement';
import { Shield, Clock } from './components/Icons';
import { UserRole } from './types';


const App: React.FC = () => {
    const { isLoading, error } = useTimeTracker();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center text-center">
                <Clock className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                <h1 className="text-2xl font-bold text-gray-700">Načítavam aplikáciu...</h1>
                <p className="text-gray-500">Pripájam sa na server, prosím čakajte.</p>
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center text-center p-4">
                <Shield className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-red-700">Chyba pripojenia</h1>
                <p className="text-red-600 max-w-md">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg"
                >
                    Skúsiť znova
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex flex-col font-sans">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <Routes>
                    <Route path="/" element={<MainTrackingView />} />
                    <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/cost-centers" element={<CostCenterManagement />} />
                    </Route>
                    <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
                        <Route path="/projects" element={<ProjectManagement />} />
                        <Route path="/evaluation" element={<EvaluationDashboard />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
};

const ProtectedRoute: React.FC<{ allowedRoles: UserRole[] }> = ({ allowedRoles }) => {
    const { currentUser } = useTimeTracker();
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        return <AccessDeniedView />;
    }
    return <Outlet />;
};

const AccessDeniedView: React.FC = () => {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
                <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Prístup zamietnutý</h2>
                <p className="text-gray-600 mb-6">Nemáte oprávnenie na zobrazenie tejto stránky.</p>
                 <a
                    href="/"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200 inline-block"
                >
                    Späť na hlavnú stránku
                </a>
            </div>
        </div>
    );
};

export default App;
