
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { TimeTrackerProvider, useTimeTracker } from './hooks/useTimeTracker';
import Header from './components/Header';
import MainTrackingView from './components/MainTrackingView';
import UserManagement from './components/UserManagement';
import ProjectManagement from './components/ProjectManagement';
import EvaluationDashboard from './components/EvaluationDashboard';
import CostCenterManagement from './components/CostCenterManagement';
import { Shield } from './components/Icons';
import { UserRole } from './types';

const AppContent: React.FC = () => {
    const { isLoading } = useTimeTracker();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center">
                    <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-600">Načítavam dáta...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex flex-col font-sans">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <Routes>
                    <Route path="/" element={<MainTrackingView />} />
                    
                    <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
                        <Route path="/projects" element={<ProjectManagement />} />
                        <Route path="/evaluation" element={<EvaluationDashboard />} />
                    </Route>

                    <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/cost-centers" element={<CostCenterManagement />} />
                    </Route>

                    <Route path="/access-denied" element={<AccessDeniedView />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
};

const ProtectedRoute: React.FC<{ allowedRoles: UserRole[] }> = ({ allowedRoles }) => {
    const { currentUser, isLoading } = useTimeTracker();

    if (isLoading) return null; // alebo loading spinner

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        return <Navigate to="/access-denied" replace />;
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
                <a href="/" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200">
                    Späť na hlavnú stránku
                </a>
            </div>
        </div>
    );
};

// App obal s Providerom je teraz v index.tsx
const App: React.FC = () => {
    return <AppContent />;
};

export default App;
