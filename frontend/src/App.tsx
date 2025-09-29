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
import { UserRole } from './types';

const ProtectedRoute: React.FC<{ allowedRoles: UserRole[]; children: React.ReactNode; }> = ({ allowedRoles, children }) => {
    const { currentUser, isLoading } = useTimeTracker();

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><p>Načítavam...</p></div>;
    }

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};


const AppContent: React.FC = () => {
    const { isLoading } = useTimeTracker();

    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex items-center justify-center">
            <div className="text-center">
                <p className="text-xl text-gray-700">Načítavam aplikáciu...</p>
            </div>
        </div>
      )
    }

    return (
        <Router>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex flex-col font-sans">
                <Header />
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <Routes>
                        <Route path="/" element={<MainTrackingView />} />
                        <Route path="/evaluation" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><EvaluationDashboard /></ProtectedRoute>} />
                        <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
                        <Route path="/projects" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><ProjectManagement /></ProtectedRoute>} />
                        <Route path="/cost-centers" element={<ProtectedRoute allowedRoles={['admin']}><CostCenterManagement /></ProtectedRoute>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
};

const App: React.FC = () => {
    return (
        <TimeTrackerProvider>
            <AppContent />
        </TimeTrackerProvider>
    );
};

export default App;
