import { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import SelectionScreen from './components/SelectionScreen';
import MasterFile from './pages/MasterFile/MasterFile';
import InvoicePlaceholder from './components/InvoicePlaceholder';
import ReportsPlaceholder from './components/ReportsPlaceholder';

/**
 * SOFAST POS Main Application Component
 *
 * Flow:
 * 1. Startup: SOFAST MOTORS Splash Screen (~2.7s)
 * 2. Login: Classic SOFAST Desktop Login Page
 * 3. Selection Screen: Minimal Dashboard for Master File, Invoice & Reports
 * 4. Master File Screen: Classic SOFAST Desktop Window with Horizontal System Menu Bar
 * 5. Navigation Placeholders for /invoice and /reports
 */
function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    navigate('/selection');
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/selection" replace />
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route path="/selection" element={<SelectionScreen />} />
      <Route path="/master-file" element={<MasterFile />} />
      <Route path="/invoice" element={<InvoicePlaceholder />} />
      <Route path="/reports" element={<ReportsPlaceholder />} />
      <Route path="*" element={<Navigate to="/selection" replace />} />
    </Routes>
  );
}

export default App;
