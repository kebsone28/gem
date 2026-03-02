import React from 'react';
import Sidebar from '../components/Sidebar';
import SyncAlertBanner from '../components/SyncAlertBanner';
import { useTheme } from '../context/ThemeContext';

export default function Layout({ children }: { children: React.ReactNode }) {
    const { isDarkMode } = useTheme();

    return (
        <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${isDarkMode ? 'bg-dark-bg text-dark-text' : 'bg-surface text-text'}`}>
            <Sidebar />
            <main className="flex-1 overflow-auto h-screen relative flex flex-col">
                <SyncAlertBanner />
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
