/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Navbar } from './components/Navbar';
import { Home } from './components/Home';
import { AdminPanel } from './components/AdminPanel';
import { Profile } from './components/Profile';
import { AuthGuard } from './components/AuthGuard';
import { UserSync } from './components/UserSync';
import { ScrollToTop } from './components/ScrollToTop';
import { PhonePrompt } from './components/PhonePrompt';
import { useEffect } from 'react';

function RouteTracker() {
  const location = useLocation();
  
  useEffect(() => {
    // Don't track admin or profile pages as default landing
    if (location.pathname === '/quotes') {
      localStorage.setItem('last_visited_page', location.pathname);
    }
  }, [location]);
  
  return null;
}

function InitialRedirect() {
  const lastPage = localStorage.getItem('last_visited_page');
  // Default to /quotes for new users ("admin wala" content)
  if (!lastPage) {
    return <Navigate to="/quotes" replace />;
  }
  return <Navigate to={lastPage} replace />;
}

import { ThemeProvider } from './ThemeContext';
import { CategoryProvider } from './CategoryContext';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsAndConditions } from './components/TermsAndConditions';

export default function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <CategoryProvider>
          <Router>
            <ScrollToTop />
            <RouteTracker />
            <div className="h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-[#F27D26] selection:text-white flex flex-col overflow-hidden">
              <UserSync />
              <PhonePrompt />
              <Navbar />
              <MainContent />
            </div>
          </Router>
        </CategoryProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

function MainContent() {
  const location = useLocation();
  const isQuotesPage = location.pathname === '/quotes';
  
  return (
    <main className="flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar relative">
      <AuthGuard>
        <Routes>
          <Route path="/" element={<Navigate to="/quotes" replace />} />
          <Route path="/quotes" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route 
            path="/admin" 
            element={
              <AuthGuard adminOnly>
                <AdminPanel />
              </AuthGuard>
            } 
          />
          <Route path="*" element={<Navigate to="/quotes" replace />} />
        </Routes>
      </AuthGuard>
    </main>
  );
}
