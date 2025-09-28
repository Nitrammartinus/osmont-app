import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TimeTrackerProvider, useTimeTracker } from './hooks/useTimeTracker';
import Header from './components/Header';
import MainTrackingView from './components/MainTrackingView';
import UserManagement from './components/UserManagement';
import ProjectManagement from './components/ProjectManagement';
import EvaluationDashboard from './components/EvaluationDashboard';
import CostCenterManagement from './components/CostCenterManagement';
import { Shield } from './components/Icons';
// FIX: Import UserRole to use in ProtectedRoute prop types.
import { UserRole } from './types';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: UserRole[] }> = ({ children, allowedRoles }) => {
    const { currentUser } = useTimeTracker();
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

const AppContent: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex flex-col font-sans">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                 <Routes>
                    <Route path="/" element={<MainTrackingView />} />
                    <Route path="/evaluation" element={
                        <ProtectedRoute allowedRoles={['admin', 'manager']}>
                            <EvaluationDashboard />
                        </ProtectedRoute>
                    } />
                     <Route path="/projects" element={
                        <ProtectedRoute allowedRoles={['admin', 'manager']}>
                            <ProjectManagement />
                        </ProtectedRoute>
                    } />
                     <Route path="/users" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <UserManagement />
                        </ProtectedRoute>
                    } />
                    <Route path="/cost-centers" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <CostCenterManagement />
                        </ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <TimeTrackerProvider>
            <Router>
                <AppContent />
            </Router>
        </TimeTrackerProvider>
    );
};

export default App;