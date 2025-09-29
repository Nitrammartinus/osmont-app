// FIX: Replaced corrupted file with a new root component that provides routing.
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TimeTrackerProvider, useTimeTracker } from './hooks/useTimeTracker';
import Header from './components/Header';
import MainTrackingView from './components/MainTrackingView';
import UserManagement from './components/UserManagement';
import ProjectManagement from './components/ProjectManagement';
import EvaluationDashboard from './components/EvaluationDashboard';
import CostCenterManagement from './components/CostCenterManagement';

const AppContent: React.FC = () => {
    const { currentUser } = useTimeTracker();
    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex flex-col font-sans">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <Routes>
                    <Route path="/" element={<MainTrackingView />} />
                    <Route path="/users" element={isAdmin ? <UserManagement /> : <Navigate to="/" />} />
                    <Route path="/projects" element={isAdmin || isManager ? <ProjectManagement /> : <Navigate to="/" />} />
                    <Route path="/evaluation" element={isAdmin || isManager ? <EvaluationDashboard /> : <Navigate to="/" />} />
                    <Route path="/cost-centers" element={isAdmin ? <CostCenterManagement /> : <Navigate to="/" />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <TimeTrackerProvider>
                <AppContent />
            </TimeTrackerProvider>
        </Router>
    );
};

export default App;
