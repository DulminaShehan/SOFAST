import { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import ManagementSystem from './pages/ManagementSystem/ManagementSystem';
import SupplierMaster from './pages/SupplierMaster/SupplierMaster';
import ItemMaster from './pages/ItemMaster/ItemMaster';
import GoodReceiveNote from './pages/GoodReceiveNote/GoodReceiveNote';
import AlternativeProduct from './pages/AlternativeProduct/AlternativeProduct';
import CustomerMaster from './pages/CustomerMaster/CustomerMaster';
import SelectionScreen from './components/SelectionScreen';
import Invoice from './pages/Invoice/Invoice';
import SettlementInvoice from './pages/SettlementInvoice/SettlementInvoice';
import PrinterSetup from './pages/PrinterSetup/PrinterSetup';
import ReportsPlaceholder from './components/ReportsPlaceholder';

/**
 * SOFAST POS Main Application Component
 *
 * Flow:
 * 1. Startup: SOFAST MOTORS Splash Screen (~2.7s)
 * 2. Login: Classic SOFAST Desktop Login Page
 * 3. Management System & Master Files (Supplier Master, Item Master, Customer Details, Alternative Product)
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
      <Route path="/customer-master" element={<CustomerMaster />} />
      <Route path="/customer-details" element={<CustomerMaster />} />
      <Route path="/master-files/customer-details" element={<CustomerMaster />} />
      <Route path="/master-files/customer-master" element={<CustomerMaster />} />
      <Route path="/alternative-product" element={<AlternativeProduct />} />
      <Route path="/master-files/alternative-product" element={<AlternativeProduct />} />
      <Route path="/master-file/alternative-product" element={<AlternativeProduct />} />
      <Route path="/grn" element={<GoodReceiveNote />} />
      <Route path="/stock-control/grn" element={<GoodReceiveNote />} />
      <Route path="/master-file" element={<ManagementSystem />} />
      <Route path="/selection" element={<SelectionScreen />} />
      <Route path="/invoice" element={<Invoice />} />
      <Route path="/sales-service/invoice" element={<Invoice />} />
      <Route path="/settlement-invoice" element={<SettlementInvoice />} />
      <Route path="/sales-service/settlement-invoice" element={<SettlementInvoice />} />
      <Route path="/sales-service/invoice/settlement" element={<SettlementInvoice />} />
      <Route path="/invoice/settlement" element={<SettlementInvoice />} />
      <Route path="/printer-setup" element={<PrinterSetup />} />
      <Route path="/administration/printer-setup" element={<PrinterSetup />} />
      <Route path="/admin/printer-setup" element={<PrinterSetup />} />
      <Route path="/reports" element={<ReportsPlaceholder />} />
      <Route path="*" element={<Navigate to="/management" replace />} />
    </Routes>
  );
}

export default App;
