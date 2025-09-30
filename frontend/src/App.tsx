import React, { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
    const { isLoading } = useTimeTracker();

    if (isLoading) {
        return (
             <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <Clock className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                    <p className="text-lg text-gray-700">Načítavam dáta...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex flex-col font-sans">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <Routes>
                    <Route path="/" element={<MainTrackingView />} />
                    <Route path="/evaluation" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><EvaluationDashboard /></ProtectedRoute>} />
                    <Route path="/projects" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><ProjectManagement /></ProtectedRoute>} />
                    <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
                    <Route path="/cost-centers" element={<ProtectedRoute allowedRoles={['admin']}><CostCenterManagement /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
};

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { currentUser } = useTimeTracker();

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        return <AccessDeniedView />;
    }

    return <>{children}</>;
};

const AccessDeniedView: React.FC = () => {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
                <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Prístup zamietnutý</h2>
                <p className="text-gray-600 mb-6">Nemáte oprávnenie na zobrazenie tejto stránky.</p>
            </div>
        </div>
    );
};

export default App;
