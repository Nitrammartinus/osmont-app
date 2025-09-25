import React from 'react';
import { TimeTrackerProvider, useTimeTracker } from './hooks/useTimeTracker';
import Header from './components/Header';
import MainTrackingView from './components/MainTrackingView';
import UserManagement from './components/UserManagement';
import ProjectManagement from './components/ProjectManagement';
import EvaluationDashboard from './components/EvaluationDashboard';
import { Shield } from './components/Icons';

const AppContent: React.FC = () => {
    const { currentView, currentUser, canAccessEvaluation, isAdmin, isManager } = useTimeTracker();

    const renderView = () => {
        switch (currentView) {
            case 'tracking':
                return <MainTrackingView />;
            case 'userManagement':
                return isAdmin ? <UserManagement /> : <AccessDeniedView />;
            case 'projectManagement':
                return isAdmin || isManager ? <ProjectManagement /> : <AccessDeniedView />;
            case 'evaluation':
                return canAccessEvaluation ? <EvaluationDashboard /> : <AccessDeniedView />;
            default:
                return <MainTrackingView />;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex flex-col font-sans">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                {renderView()}
            </main>
        </div>
    );
};

const AccessDeniedView: React.FC = () => {
    const { setCurrentView } = useTimeTracker();
    return (
        <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
                <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">You do not have permission to view this page.</p>
                <button
                    onClick={() => setCurrentView('tracking')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-transform transform hover:scale-105 duration-200"
                >
                    Back to Tracking
                </button>
            </div>
        </div>
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
