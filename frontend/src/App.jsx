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
import ManualInvoice from './pages/ManualInvoice/ManualInvoice';
import SettlementInvoice from './pages/SettlementInvoice/SettlementInvoice';
import RemainingBalance from './pages/RemainingBalance/RemainingBalance';
import Damage from './pages/Damage/Damage';
import CustomerDamageReturn from './pages/CustomerDamageReturn/CustomerDamageReturn';
import DamageClaim from './pages/DamageClaim/DamageClaim';
import GoodReturnNote from './pages/GoodReturnNote/GoodReturnNote';
import PrinterSetup from './pages/PrinterSetup/PrinterSetup';
import NewUser from './pages/NewUser/NewUser';
import Approvement from './pages/Approvement/Approvement';
import Reports from './pages/Reports/Reports';
import { useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';

/**
 * ProtectedModuleRoute
 * Enforces Role-Based Access Control (RBAC) at the route level:
 * - adminOnly routes (Printer Setup, New User) strictly require Administrator role
 * - Operational routes require explicit module permission
 * - Unauthorized attempts automatically redirect to authorized billing terminal (/invoice)
 */
function ProtectedModuleRoute({ permission, adminOnly = false, children }) {
  const { currentUser, isAdmin, hasPermission } = useAuth();

  if (adminOnly && !isAdmin) {
    return <Navigate to="/invoice" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/invoice" replace />;
  }

  return children;
}


/**
 * SOFAST POS Main Application Component
 *
 * Flow:
 * 1. Startup: SOFAST MOTORS Splash Screen (~2.7s)
 * 2. Login: Classic SOFAST Desktop Login Page
 * 3. Management System & Master Files (Supplier Master, Item Master, Customer Details, Alternative Product)
 */
function App() {
  const [showSplash, setShowSplash] = useState(() => {
    return window.location.pathname === '/' && !sessionStorage.getItem('splash_shown');
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  const handleSplashFinish = () => {
    sessionStorage.setItem('splash_shown', 'true');
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
    <ConfirmProvider>
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
        <Route path="/item-master" element={<ProtectedModuleRoute permission="item-master"><ItemMaster /></ProtectedModuleRoute>} />
        <Route path="/supplier-master" element={<ProtectedModuleRoute permission="supplier-master"><SupplierMaster /></ProtectedModuleRoute>} />
        <Route path="/customer-master" element={<CustomerMaster />} />
        <Route path="/customer-details" element={<CustomerMaster />} />
        <Route path="/master-files/customer-details" element={<CustomerMaster />} />
        <Route path="/master-files/customer-master" element={<CustomerMaster />} />
        <Route path="/alternative-product" element={<ProtectedModuleRoute permission="alternative-product"><AlternativeProduct /></ProtectedModuleRoute>} />
        <Route path="/master-files/alternative-product" element={<ProtectedModuleRoute permission="alternative-product"><AlternativeProduct /></ProtectedModuleRoute>} />
        <Route path="/master-file/alternative-product" element={<ProtectedModuleRoute permission="alternative-product"><AlternativeProduct /></ProtectedModuleRoute>} />
        <Route path="/grn" element={<ProtectedModuleRoute permission="grn"><GoodReceiveNote /></ProtectedModuleRoute>} />
        <Route path="/stock-control/grn" element={<ProtectedModuleRoute permission="grn"><GoodReceiveNote /></ProtectedModuleRoute>} />
        <Route path="/good-return-note" element={<ProtectedModuleRoute permission="good-return-note"><GoodReturnNote /></ProtectedModuleRoute>} />
        <Route path="/stock-control/good-return-note" element={<ProtectedModuleRoute permission="good-return-note"><GoodReturnNote /></ProtectedModuleRoute>} />
        <Route path="/gren" element={<ProtectedModuleRoute permission="good-return-note"><GoodReturnNote /></ProtectedModuleRoute>} />
        <Route path="/stock-control/gren" element={<ProtectedModuleRoute permission="good-return-note"><GoodReturnNote /></ProtectedModuleRoute>} />
        <Route path="/damage" element={<ProtectedModuleRoute permission="damage"><Damage /></ProtectedModuleRoute>} />
        <Route path="/stock-control/damage" element={<ProtectedModuleRoute permission="damage"><Damage /></ProtectedModuleRoute>} />
        <Route path="/stock-control/data-entry-of-damage" element={<ProtectedModuleRoute permission="damage"><Damage /></ProtectedModuleRoute>} />
        <Route path="/data-entry-of-damage" element={<ProtectedModuleRoute permission="damage"><Damage /></ProtectedModuleRoute>} />
        <Route path="/damage-claim" element={<ProtectedModuleRoute permission="damage"><DamageClaim /></ProtectedModuleRoute>} />
        <Route path="/stock-control/damage-claim" element={<ProtectedModuleRoute permission="damage"><DamageClaim /></ProtectedModuleRoute>} />
        <Route path="/damage-items" element={<Navigate to="/damage" replace />} />
        <Route path="/stock-control/damage-items" element={<Navigate to="/damage" replace />} />
        <Route path="/supplier-damage-claim" element={<Navigate to="/damage" replace />} />
        <Route path="/stock-control/supplier-damage-claim" element={<Navigate to="/damage" replace />} />
        <Route path="/damage-stock" element={<Navigate to="/damage" replace />} />
        <Route path="/stock-control/damage-stock" element={<Navigate to="/damage" replace />} />
        <Route path="/customer-damage-return" element={<CustomerDamageReturn />} />
        <Route path="/customer-return-exchange" element={<CustomerDamageReturn />} />
        <Route path="/invoice-return" element={<CustomerDamageReturn />} />
        <Route path="/sales-service/invoice-return" element={<CustomerDamageReturn />} />
        <Route path="/sales-service/customer-return-exchange" element={<CustomerDamageReturn />} />
        <Route path="/sales-service/customer-damage-return" element={<CustomerDamageReturn />} />
        <Route path="/sales-service/damage-return" element={<CustomerDamageReturn />} />
        <Route path="/master-file" element={<ManagementSystem />} />
        <Route path="/master-files" element={<ManagementSystem />} />
        <Route path="/masterfiles" element={<ManagementSystem />} />
        <Route path="/category-master" element={<Navigate to="/management" replace />} />
        <Route path="/sub-category-master" element={<Navigate to="/management" replace />} />
        <Route path="/accounting" element={<ManagementSystem defaultModule="Accounting" />} />
        <Route path="/stock-control" element={<Navigate to="/grn" replace />} />
        <Route path="/sales-service" element={<Navigate to="/invoice" replace />} />
        <Route path="/selection" element={<SelectionScreen />} />
        <Route path="/invoice" element={<Invoice />} />
        <Route path="/sales-service/invoice" element={<Invoice />} />
        <Route path="/manual-invoice" element={<ManualInvoice />} />
        <Route path="/sales-service/manual-invoice" element={<ManualInvoice />} />
        <Route path="/settlement-invoice" element={<SettlementInvoice />} />
        <Route path="/sales-service/settlement-invoice" element={<SettlementInvoice />} />
        <Route path="/sales-service/invoice/settlement" element={<SettlementInvoice />} />
        <Route path="/invoice/settlement" element={<SettlementInvoice />} />
        <Route path="/remaining-balance" element={<RemainingBalance />} />
        <Route path="/sales-service/remaining-balance" element={<RemainingBalance />} />

        {/* Administration: Strictly Restricted to Administrators */}
        <Route path="/printer-setup" element={<ProtectedModuleRoute adminOnly><PrinterSetup /></ProtectedModuleRoute>} />
        <Route path="/administration/printer-setup" element={<ProtectedModuleRoute adminOnly><PrinterSetup /></ProtectedModuleRoute>} />
        <Route path="/admin/printer-setup" element={<ProtectedModuleRoute adminOnly><PrinterSetup /></ProtectedModuleRoute>} />

        <Route path="/new-user" element={<ProtectedModuleRoute adminOnly><NewUser /></ProtectedModuleRoute>} />
        <Route path="/administration/new-user" element={<ProtectedModuleRoute adminOnly><NewUser /></ProtectedModuleRoute>} />
        <Route path="/admin/new-user" element={<ProtectedModuleRoute adminOnly><NewUser /></ProtectedModuleRoute>} />
        <Route path="/user-management" element={<ProtectedModuleRoute adminOnly><NewUser /></ProtectedModuleRoute>} />

        {/* Approvement Section & Sub-sections */}
        <Route path="/approvement" element={<ProtectedModuleRoute permission="payment-voucher"><Approvement /></ProtectedModuleRoute>} />
        <Route path="/approvement/payment-voucher" element={<ProtectedModuleRoute permission="payment-voucher"><Approvement defaultSection="payment-voucher" /></ProtectedModuleRoute>} />
        <Route path="/payment-voucher" element={<ProtectedModuleRoute permission="payment-voucher"><Approvement defaultSection="payment-voucher" /></ProtectedModuleRoute>} />
        <Route path="/approvement/petty-cash" element={<ProtectedModuleRoute permission="petty-cash"><Approvement defaultSection="petty-cash" /></ProtectedModuleRoute>} />
        <Route path="/petty-cash" element={<ProtectedModuleRoute permission="petty-cash"><Approvement defaultSection="petty-cash" /></ProtectedModuleRoute>} />
        <Route path="/approvement/leave-request" element={<ProtectedModuleRoute permission="leave-request"><Approvement defaultSection="leave-request" /></ProtectedModuleRoute>} />
        <Route path="/leave-request" element={<ProtectedModuleRoute permission="leave-request"><Approvement defaultSection="leave-request" /></ProtectedModuleRoute>} />
        <Route path="/receive-inbox" element={<ProtectedModuleRoute adminOnly><Approvement defaultSection="receive-inbox" /></ProtectedModuleRoute>} />
        <Route path="/approvement/receive-inbox" element={<ProtectedModuleRoute adminOnly><Approvement defaultSection="receive-inbox" /></ProtectedModuleRoute>} />

        <Route path="/reports" element={<ProtectedModuleRoute permission="reports"><Reports /></ProtectedModuleRoute>} />
        <Route path="/reports/closing-stock" element={<ProtectedModuleRoute permission="reports"><Reports /></ProtectedModuleRoute>} />
        <Route path="/invoice-report" element={<ProtectedModuleRoute permission="reports"><Navigate to="/reports?tab=invoices" replace /></ProtectedModuleRoute>} />
        <Route path="/invoices-report" element={<ProtectedModuleRoute permission="reports"><Navigate to="/reports?tab=invoices" replace /></ProtectedModuleRoute>} />
        <Route path="/reports/invoices" element={<ProtectedModuleRoute permission="reports"><Navigate to="/reports?tab=invoices" replace /></ProtectedModuleRoute>} />
        <Route path="*" element={<Navigate to="/management" replace />} />
      </Routes>
    </ConfirmProvider>
  );
}

export default App;
