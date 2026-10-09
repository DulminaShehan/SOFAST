import { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import ManagementSystem from './pages/ManagementSystem/ManagementSystem';
import SupplierMaster from './pages/SupplierMaster/SupplierMaster';
import ItemMaster from './pages/ItemMaster/ItemMaster';
import GoodReceiveNote from './pages/GoodReceiveNote/GoodReceiveNote';
import SelectionScreen from './components/SelectionScreen';
import InvoicePlaceholder from './components/InvoicePlaceholder';
import ReportsPlaceholder from './components/ReportsPlaceholder';

/**
 * SOFAST POS Main Application Component
 *
 * Flow:
 * 1. Startup: SOFAST MOTORS Splash Screen (~2.7s)
 * 2. Login: Classic SOFAST Desktop Login Page
 * 3. Management System & Master Files (Supplier Master File, Item Master, etc.)
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
    navigate('/management');
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
            <Navigate to="/management" replace />
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route path="/management" element={<ManagementSystem />} />
      <Route path="/item-master" element={<ItemMaster />} />
      <Route path="/supplier-master" element={<SupplierMaster />} />
      <Route path="/grn" element={<GoodReceiveNote />} />
      <Route path="/stock-control/grn" element={<GoodReceiveNote />} />
      <Route path="/master-file" element={<ManagementSystem />} />
      <Route path="/selection" element={<SelectionScreen />} />
      <Route path="/invoice" element={<InvoicePlaceholder />} />
      <Route path="/reports" element={<ReportsPlaceholder />} />
      <Route path="*" element={<Navigate to="/management" replace />} />
    </Routes>
  );
}

export default App;
