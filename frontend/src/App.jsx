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
import RemainingBalance from './pages/RemainingBalance/RemainingBalance';
import Damage from './pages/Damage/Damage';
import GoodReturnNote from './pages/GoodReturnNote/GoodReturnNote';
import PrinterSetup from './pages/PrinterSetup/PrinterSetup';
import NewUser from './pages/NewUser/NewUser';
import Approvement from './pages/Approvement/Approvement';
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
      <Route path="/good-return-note" element={<GoodReturnNote />} />
      <Route path="/stock-control/good-return-note" element={<GoodReturnNote />} />
      <Route path="/gren" element={<GoodReturnNote />} />
      <Route path="/stock-control/gren" element={<GoodReturnNote />} />
      <Route path="/damage" element={<Damage />} />
      <Route path="/stock-control/damage" element={<Damage />} />
      <Route path="/stock-control/data-entry-of-damage" element={<Damage />} />
      <Route path="/data-entry-of-damage" element={<Damage />} />
      <Route path="/damage-claim" element={<Navigate to="/damage" replace />} />
      <Route path="/stock-control/damage-claim" element={<Navigate to="/damage" replace />} />
      <Route path="/damage-items" element={<Navigate to="/damage" replace />} />
      <Route path="/stock-control/damage-items" element={<Navigate to="/damage" replace />} />
      <Route path="/supplier-damage-claim" element={<Navigate to="/damage" replace />} />
      <Route path="/stock-control/supplier-damage-claim" element={<Navigate to="/damage" replace />} />
      <Route path="/damage-stock" element={<Navigate to="/damage" replace />} />
      <Route path="/stock-control/damage-stock" element={<Navigate to="/damage" replace />} />
      <Route path="/customer-damage-return" element={<Navigate to="/damage" replace />} />
      <Route path="/customer-return-exchange" element={<Navigate to="/damage" replace />} />
      <Route path="/sales-service/customer-return-exchange" element={<Navigate to="/damage" replace />} />
      <Route path="/sales-service/customer-damage-return" element={<Navigate to="/damage" replace />} />
      <Route path="/sales-service/damage-return" element={<Navigate to="/damage" replace />} />
      <Route path="/master-file" element={<ManagementSystem />} />
      <Route path="/selection" element={<SelectionScreen />} />
      <Route path="/invoice" element={<Invoice />} />
      <Route path="/sales-service/invoice" element={<Invoice />} />
      <Route path="/settlement-invoice" element={<SettlementInvoice />} />
      <Route path="/sales-service/settlement-invoice" element={<SettlementInvoice />} />
      <Route path="/sales-service/invoice/settlement" element={<SettlementInvoice />} />
      <Route path="/invoice/settlement" element={<SettlementInvoice />} />
      <Route path="/remaining-balance" element={<RemainingBalance />} />
      <Route path="/sales-service/remaining-balance" element={<RemainingBalance />} />

      <Route path="/printer-setup" element={<PrinterSetup />} />
      <Route path="/administration/printer-setup" element={<PrinterSetup />} />
      <Route path="/admin/printer-setup" element={<PrinterSetup />} />

      <Route path="/new-user" element={<NewUser />} />
      <Route path="/administration/new-user" element={<NewUser />} />
      <Route path="/admin/new-user" element={<NewUser />} />
      <Route path="/user-management" element={<NewUser />} />

      {/* Approvement Section & Sub-sections */}
      <Route path="/approvement" element={<Approvement />} />
      <Route path="/approvement/payment-voucher" element={<Approvement defaultSection="payment-voucher" />} />
      <Route path="/payment-voucher" element={<Approvement defaultSection="payment-voucher" />} />
      <Route path="/approvement/petty-cash" element={<Approvement defaultSection="petty-cash" />} />
      <Route path="/petty-cash" element={<Approvement defaultSection="petty-cash" />} />
      <Route path="/approvement/leave-request" element={<Approvement defaultSection="leave-request" />} />
      <Route path="/leave-request" element={<Approvement defaultSection="leave-request" />} />
      <Route path="/receive-inbox" element={<Approvement defaultSection="receive-inbox" />} />
      <Route path="/approvement/receive-inbox" element={<Approvement defaultSection="receive-inbox" />} />

      <Route path="/reports" element={<ReportsPlaceholder />} />
      <Route path="*" element={<Navigate to="/management" replace />} />
    </Routes>
  );
}

export default App;
