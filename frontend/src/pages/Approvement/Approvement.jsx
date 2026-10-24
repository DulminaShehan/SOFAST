import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainMenu from '../../components/navigation/MainMenu';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import windowIcon from '../../assets/window-icon.png';
import PaymentVoucherCreateModal from './PaymentVoucherCreateModal';
import VoucherDetailsModal from './VoucherDetailsModal';
import PettyCashCreateModal from './PettyCashCreateModal';
import PettyCashDetailsModal from './PettyCashDetailsModal';
import ExpensesReimbursementSheet from './ExpensesReimbursementSheet';
import './Approvement.css';

/**
 * SOFAST MOTORS - Approvement Module
 * 1. Payment Voucher (with exact Page 1 replica, line items, and bill attachments)
 * 2. Petty Cash (Expenses Reimbursement Form Page 1 replica, multi-items, Admin spendable limit with real-time deduction)
 * 3. Leave Request
 * 4. Admin Receive Inbox (strictly visible only to Administrator)
 */
function Approvement({ defaultSection }) {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect initial active tab
  const getInitialTab = () => {
    if (defaultSection) return defaultSection;
    if (location.pathname.includes('receive-inbox') && isAdmin) return 'receive-inbox';
    if (location.pathname.includes('petty-cash')) return 'petty-cash';
    if (location.pathname.includes('leave-request')) return 'leave-request';
    return 'payment-voucher';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [notification, setNotification] = useState(null);

  // Lists state
  const [paymentVouchers, setPaymentVouchers] = useState([]);
  const [pettyCashList, setPettyCashList] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  // Spendable Limit state for Petty Cash
  const [pettyCashLimit, setPettyCashLimit] = useState({
    totalLimit: 50000,
    totalSpent: 0,
    remainingLimit: 50000,
    pendingAmount: 0,
    approvedCount: 0,
    pendingCount: 0,
    period: 'Monthly (October 2026)',
    setBy: 'Admin',
  });
  const [isEditLimitOpen, setIsEditLimitOpen] = useState(false);
  const [limitForm, setLimitForm] = useState({
    totalLimit: 50000,
    period: 'Monthly (October 2026)',
  });

  // Modals state - Payment Voucher
  const [isCreatePvOpen, setIsCreatePvOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Modals state - Petty Cash (Expenses Reimbursement Form)
  const [isCreatePcOpen, setIsCreatePcOpen] = useState(false);
  const [selectedPettyCash, setSelectedPettyCash] = useState(null);
  const [isPcViewerOpen, setIsPcViewerOpen] = useState(false);

  // Other section modal states (Leave Request)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [lrForm, setLrForm] = useState({
    employeeName: '',
    leaveType: 'Annual',
    startDate: '',
    endDate: '',
    numberOfDays: 1,
    reason: '',
    remarks: '',
  });

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Sync tab with URL
  useEffect(() => {
    if (location.pathname.includes('receive-inbox') && isAdmin) {
      setActiveTab('receive-inbox');
    } else if (location.pathname.includes('petty-cash')) {
      setActiveTab('petty-cash');
    } else if (location.pathname.includes('leave-request')) {
      setActiveTab('leave-request');
    } else if (location.pathname.includes('payment-voucher')) {
      setActiveTab('payment-voucher');
    }
  }, [location.pathname, isAdmin]);

  // Fetch all approval records and spendable limit
  const fetchData = async () => {
    try {
      setLoading(true);
      // Normal users pass their username to retrieve their submitted vouchers; admins retrieve all
      const userParam = !isAdmin && currentUser?.username ? `?user=${currentUser.username}` : '';
      const [pvRes, pcRes, limitRes, lrRes] = await Promise.all([
        api.get(`/approvement/payment-vouchers${userParam}`),
        api.get('/approvement/petty-cash'),
        api.get('/approvement/petty-cash/limit'),
        api.get('/approvement/leave-requests'),
      ]);

      if (pvRes.data?.success) setPaymentVouchers(pvRes.data.data);
      if (pcRes.data?.success) setPettyCashList(pcRes.data.data);
      if (limitRes.data?.success) {
        setPettyCashLimit(limitRes.data.data);
        setLimitForm({
          totalLimit: limitRes.data.data.totalLimit,
          period: limitRes.data.data.period || 'Monthly (October 2026)',
        });
      }
      if (lrRes.data?.success) setLeaveRequests(lrRes.data.data);
    } catch (err) {
      console.error('Failed to load approvement records:', err);
      showToast('Error loading approval records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.username, isAdmin]);

  // ---------------- PAYMENT VOUCHER HANDLERS ----------------

  // Create payment voucher
  const handleCreatePvSubmit = async (payload) => {
    try {
      const res = await api.post('/approvement/payment-vouchers', payload);
      if (res.data?.success) {
        showToast(`Payment Voucher ${res.data.data?.voucherNo} submitted successfully to Admin!`);
        setIsCreatePvOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to create payment voucher', 'error');
      throw err;
    }
  };

  // Approve payment voucher
  const handleApprovePv = async (voucherId, adminRemarks = '') => {
    try {
      setIsProcessingApproval(true);
      const res = await api.put(`/approvement/payment-vouchers/${voucherId}/status`, {
        status: 'Approved',
        approvedBy: currentUser?.username || 'admin',
        adminRemarks,
      });

      if (res.data?.success) {
        showToast(`Payment Voucher ${res.data.data?.voucherNo} marked as APPROVED!`);
        if (selectedVoucher) {
          setSelectedVoucher(res.data.data);
        }
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to approve payment voucher', 'error');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Reject payment voucher
  const handleRejectPv = async (voucherId, adminRemarks = '') => {
    try {
      setIsProcessingApproval(true);
      const res = await api.put(`/approvement/payment-vouchers/${voucherId}/status`, {
        status: 'Rejected',
        approvedBy: currentUser?.username || 'admin',
        adminRemarks,
      });

      if (res.data?.success) {
        showToast(`Payment Voucher ${res.data.data?.voucherNo} marked as REJECTED.`);
        if (selectedVoucher) {
          setSelectedVoucher(res.data.data);
        }
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to reject payment voucher', 'error');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Open voucher viewer
  const handleViewVoucher = (voucher) => {
    setSelectedVoucher(voucher);
    setIsViewerOpen(true);
  };

  // ---------------- PETTY CASH / REIMBURSEMENT HANDLERS ----------------

  const handleCreatePcSubmit = async (payload) => {
    try {
      const res = await api.post('/approvement/petty-cash', payload);
      if (res.data?.success) {
        showToast(`Expenses Reimbursement Form ${res.data.data?.voucherNo} submitted successfully!`);
        setIsCreatePcOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to create reimbursement form', 'error');
      throw err;
    }
  };

  const handleApprovePc = async (voucherId, remarks = '') => {
    try {
      setIsProcessingApproval(true);
      const res = await api.put(`/approvement/petty-cash/${voucherId}/status`, {
        status: 'Approved',
        approvedBy: currentUser?.username || 'admin',
        remarks,
      });

      if (res.data?.success) {
        showToast(
          `Reimbursement ${res.data.data?.voucherNo} APPROVED! Amount deducted from spendable limit.`
        );
        if (selectedPettyCash) {
          setSelectedPettyCash(res.data.data);
        }
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to approve reimbursement request', 'error');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleRejectPc = async (voucherId, remarks = '') => {
    try {
      setIsProcessingApproval(true);
      const res = await api.put(`/approvement/petty-cash/${voucherId}/status`, {
        status: 'Rejected',
        approvedBy: currentUser?.username || 'admin',
        remarks,
      });

      if (res.data?.success) {
        showToast(`Reimbursement ${res.data.data?.voucherNo} marked as REJECTED.`);
        if (selectedPettyCash) {
          setSelectedPettyCash(res.data.data);
        }
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to reject reimbursement request', 'error');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleViewPettyCash = (voucher) => {
    setSelectedPettyCash(voucher);
    setIsPcViewerOpen(true);
  };

  const handleSaveLimitSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Only administrators can configure spendable limits', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.put('/approvement/petty-cash/limit', {
        totalLimit: Number(limitForm.totalLimit),
        period: limitForm.period,
        setBy: currentUser?.username || 'Admin',
      });
      if (res.data?.success) {
        showToast(
          `Spendable Petty Cash Fund Limit updated to Rs. ${Number(limitForm.totalLimit).toLocaleString()}!`
        );
        setIsEditLimitOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to update spendable limit', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------- LEAVE REQUEST HANDLERS ----------------

  const handleUpdateStatus = async (type, id, newStatus) => {
    try {
      let endpoint = '';
      if (type === 'lr') endpoint = `/approvement/leave-requests/${id}/status`;
      else if (type === 'pc') endpoint = `/approvement/petty-cash/${id}/status`;

      const res = await api.put(endpoint, {
        status: newStatus,
        approvedBy: currentUser?.username || 'admin',
      });

      if (res.data?.success) {
        showToast(`Record marked as ${newStatus}!`);
        fetchData();
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleSubmitLr = async (e) => {
    e.preventDefault();
    if (!lrForm.employeeName || !lrForm.startDate || !lrForm.endDate || !lrForm.reason) {
      showToast('Employee, dates, and reason are required', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.post('/approvement/leave-requests', lrForm);
      if (res.data?.success) {
        showToast(`Leave Request ${res.data.data?.requestNo} submitted successfully!`);
        setIsModalOpen(false);
        setLrForm({
          employeeName: '',
          leaveType: 'Annual',
          startDate: '',
          endDate: '',
          numberOfDays: 1,
          reason: '',
          remarks: '',
        });
        fetchData();
      }
    } catch (err) {
      showToast('Failed to submit leave request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter lists based on search & status
  const filterList = (items, searchField) => {
    return items.filter((item) => {
      const matchSearch =
        item[searchField]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.voucherNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.requestNo?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  };

  const filteredPv = filterList(paymentVouchers, 'payeeName');
  const filteredPc = pettyCashList.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.requestedBy && item.requestedBy.toLowerCase().includes(q)) ||
      (item.subject && item.subject.toLowerCase().includes(q)) ||
      (item.purpose && item.purpose.toLowerCase().includes(q)) ||
      (item.voucherNo && item.voucherNo.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const filteredLr = filterList(leaveRequests, 'employeeName');

  // Pending counts
  const pendingPvList = paymentVouchers.filter((v) => v.status === 'Pending');
  const pendingPvCount = pendingPvList.length;
  const pendingPcList = pettyCashList.filter((v) => v.status === 'Pending');
  const pendingPcCount = pendingPcList.length;
  const pendingLrCount = leaveRequests.filter((v) => v.status === 'Pending').length;
  const totalInboxPendingCount = pendingPvCount + pendingPcCount;

  return (
    <div className="approvement-page-container">
      {/* 1. Window Header Bar */}
      <header className="approvement-window-header">
        <div className="approvement-header-left">
          <img src={windowIcon} alt="" className="approvement-header-icon" />
          <span className="approvement-header-title">SOFAST MOTORS - Approvement Workflow System</span>
          <span className="approvement-badge">Approvals</span>
        </div>
        <div>
          <button
            type="button"
            className="approvement-back-btn"
            onClick={() => navigate('/management')}
          >
            &larr; Management System
          </button>
        </div>
      </header>

      {/* 2. Top Application Menu Bar */}
      <MainMenu />

      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '55px',
            right: '25px',
            zIndex: 9999,
            padding: '10px 18px',
            background: notification.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '13px',
            fontWeight: 'bold',
          }}
        >
          {notification.message}
        </div>
      )}

      {/* 3. Main Workspace Canvas */}
      <main className="approvement-workspace">
        {/* Navigation Tabs Bar */}
        <div className="approvement-tabs-bar">
          <button
            type="button"
            className={`approvement-tab-btn ${activeTab === 'payment-voucher' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('payment-voucher');
              navigate('/payment-voucher');
            }}
          >
            <span>💳 Payment Voucher</span>
            {pendingPvCount > 0 && <span className="tab-pill-count">{pendingPvCount} pending</span>}
          </button>

          <button
            type="button"
            className={`approvement-tab-btn ${activeTab === 'petty-cash' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('petty-cash');
              navigate('/petty-cash');
            }}
          >
            <span>💵 Petty Cash</span>
            {pendingPcCount > 0 && <span className="tab-pill-count">{pendingPcCount} pending</span>}
          </button>

          <button
            type="button"
            className={`approvement-tab-btn ${activeTab === 'leave-request' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('leave-request');
              navigate('/leave-request');
            }}
          >
            <span>📅 Leave Request</span>
            {pendingLrCount > 0 && <span className="tab-pill-count">{pendingLrCount} pending</span>}
          </button>

          {/* ADMIN ONLY RECEIVE INBOX TAB */}
          {isAdmin && (
            <button
              type="button"
              className={`approvement-tab-btn admin-inbox-tab ${activeTab === 'receive-inbox' ? 'active' : ''}`}
              onClick={() => setActiveTab('receive-inbox')}
              title="Admin Inbox: Receive and authorize submitted expense vouchers"
            >
              <span>📥 Receive Inbox</span>
              {pendingPvCount > 0 ? (
                <span className="tab-pill-count badge-urgent">{pendingPvCount} PENDING</span>
              ) : (
                <span className="tab-pill-count" style={{ background: '#22c55e', color: '#fff' }}>0</span>
              )}
            </button>
          )}
        </div>

        {/* HERO BANNER SECTION */}
        {activeTab === 'receive-inbox' && isAdmin ? (
          <div className="inbox-hero-card">
            <div className="inbox-hero-left">
              <span className="inbox-hero-icon">📥</span>
              <div className="inbox-hero-titles">
                <h2>Admin Authorization Inbox — Receive &amp; Approve Vouchers</h2>
                <p>
                  Review vouchers submitted by cashiers and staff. Inspect attached bills (CEB electricity, SLT Mobitel, SMS receipts) before granting official approval.
                </p>
              </div>
            </div>
            <div className="inbox-hero-badge">
              {pendingPvCount} Voucher(s) Awaiting Decision
            </div>
          </div>
        ) : (
          <div className="approvement-banner">
            <div className="approvement-banner-left">
              <div className="approvement-banner-icon">
                {activeTab === 'payment-voucher' ? '💳' : activeTab === 'petty-cash' ? '💵' : '📅'}
              </div>
              <div className="approvement-banner-titles">
                <h1>
                  {activeTab === 'payment-voucher'
                    ? 'Payment Voucher Approvals & Expense Settlements'
                    : activeTab === 'petty-cash'
                    ? 'Petty Cash & Expenses Reimbursement Forms'
                    : 'Employee Leave Requests & Attendance Approvals'}
                </h1>
                <p>
                  {activeTab === 'payment-voucher'
                    ? 'Exact Page 1 voucher structure • Attach multiple bills (CEB electricity, SLT, SMS photo) • Verified Admin authorization.'
                    : activeTab === 'petty-cash'
                    ? 'Exact Page 1 Expenses Reimbursement Form • Admin spendable limit management with real-time deduction upon approval.'
                    : 'Process employee annual, casual, and medical leave requests with manager approval flow.'}
                </p>
              </div>
            </div>

            <div className="approvement-stats-group">
              <div className="appr-stat-box">
                <span className="appr-stat-val">
                  {activeTab === 'payment-voucher'
                    ? paymentVouchers.length
                    : activeTab === 'petty-cash'
                    ? pettyCashList.length
                    : leaveRequests.length}
                </span>
                <span className="appr-stat-lbl">Total Records</span>
              </div>
              <div className="appr-stat-box">
                <span className="appr-stat-val" style={{ color: '#d97706' }}>
                  {activeTab === 'payment-voucher'
                    ? pendingPvCount
                    : activeTab === 'petty-cash'
                    ? pendingPcCount
                    : pendingLrCount}
                </span>
                <span className="appr-stat-lbl">Pending</span>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="approvement-toolbar">
          <div className="appr-toolbar-left">
            {activeTab === 'payment-voucher' && (
              <button
                type="button"
                className="appr-add-btn"
                onClick={() => setIsCreatePvOpen(true)}
              >
                <span>+</span>
                <span>New Payment Voucher</span>
              </button>
            )}

            {activeTab === 'petty-cash' && (
              <button
                type="button"
                className="appr-add-btn"
                onClick={() => setIsCreatePcOpen(true)}
              >
                <span>+</span>
                <span>Add Petty Cash Expense</span>
              </button>
            )}

            {activeTab === 'leave-request' && (
              <button
                type="button"
                className="appr-add-btn"
                onClick={() => setIsModalOpen(true)}
              >
                <span>+</span>
                <span>New Leave Request</span>
              </button>
            )}

            <div className="appr-search-wrapper">
              <span className="appr-search-icon">🔍</span>
              <input
                type="text"
                className="appr-search-input"
                placeholder={
                  activeTab === 'payment-voucher' || activeTab === 'receive-inbox'
                    ? 'Search by payee or voucher #...'
                    : activeTab === 'petty-cash'
                    ? 'Search by requester or PC #...'
                    : 'Search by employee or LR #...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {activeTab !== 'receive-inbox' && (
              <select
                className="appr-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending Only</option>
                <option value="Approved">Approved Only</option>
                <option value="Rejected">Rejected Only</option>
              </select>
            )}
          </div>

          <div>
            <button
              type="button"
              className="appr-refresh-btn"
              onClick={fetchData}
              title="Refresh approval data"
            >
              ⟳ Refresh
            </button>
          </div>
        </div>

        {/* =========================================================================
            TAB: ADMIN RECEIVE INBOX (STRICTLY ADMIN ONLY)
            ========================================================================= */}
        {activeTab === 'receive-inbox' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {totalInboxPendingCount === 0 ? (
              <div className="approvement-table-card" style={{ textAlign: 'center', padding: '50px 20px', color: '#16a34a' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                <strong style={{ fontSize: '16px' }}>All Caught Up!</strong>
                <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                  No pending payment vouchers or petty cash reimbursement forms awaiting authorization.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Pending Payment Vouchers */}
                {pendingPvList.length > 0 && (
                  <div className="approvement-table-card">
                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: '800', fontSize: '14px', color: '#1e3a8a', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📄 Pending Payment Vouchers ({pendingPvList.length})</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Exact Page 1 Voucher Sheet &bull; Bills Attached</span>
                    </div>
                    <table className="appr-table">
                      <thead>
                        <tr>
                          <th style={{ width: '13%' }}>Voucher No</th>
                          <th style={{ width: '11%' }}>Date</th>
                          <th style={{ width: '13%' }}>Submitted By</th>
                          <th style={{ width: '22%' }}>Payee / Purpose</th>
                          <th style={{ width: '13%' }}>Total Amount</th>
                          <th style={{ width: '11%' }}>Attached Bills</th>
                          <th style={{ width: '17%' }}>Admin Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPvList.map((v) => {
                          const attachmentsCount = Array.isArray(v.attachments) ? v.attachments.length : 0;
                          const displayAmount = v.totalAmount || v.amount || 0;
                          return (
                            <tr key={v._id || v.voucherNo}>
                              <td style={{ fontWeight: 'bold', color: '#4338ca' }}>{v.voucherNo}</td>
                              <td>{v.dateFormatted || new Date(v.date || v.createdAt).toLocaleDateString('en-GB')}</td>
                              <td>
                                <span style={{ fontWeight: '600', color: '#1e3a8a' }}>{v.preparedBy || 'User'}</span>
                              </td>
                              <td>
                                <strong>{v.payeeName}</strong>
                                {v.payeeNote && <div style={{ fontSize: '11px', color: '#4338ca' }}>{v.payeeNote}</div>}
                                {v.items && v.items.length > 0 && (
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                    {v.items[0].particulars} {v.items.length > 1 ? `(+${v.items.length - 1} more items)` : ''}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: '700', color: '#0f172a' }}>
                                Rs. {Number(displayAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td>
                                <span className={`appr-bill-badge ${attachmentsCount === 0 ? 'none' : ''}`}>
                                  📎 {attachmentsCount} {attachmentsCount === 1 ? 'Bill' : 'Bills'}
                                </span>
                              </td>
                              <td>
                                <div className="appr-actions-cell">
                                  <button
                                    type="button"
                                    className="btn-review-action"
                                    onClick={() => handleViewVoucher(v)}
                                    title="Review exact voucher sheet and inspect attached bills"
                                  >
                                    🔍 Review
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-approve"
                                    onClick={() => handleApprovePv(v._id || v.voucherNo)}
                                    title="Direct Approve"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-reject"
                                    onClick={() => handleRejectPv(v._id || v.voucherNo)}
                                    title="Direct Reject"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2. Pending Expenses Reimbursement Forms */}
                {pendingPcList.length > 0 && (
                  <div className="approvement-table-card">
                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: '800', fontSize: '14px', color: '#15803d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>💵 Pending Petty Cash Reimbursements ({pendingPcList.length})</span>
                      <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '700' }}>
                        ⚡ Approving will deduct from Rs. {Number(pettyCashLimit.remainingLimit || 0).toLocaleString()} Available Fund Limit
                      </span>
                    </div>
                    <table className="appr-table">
                      <thead>
                        <tr>
                          <th style={{ width: '13%' }}>Form No</th>
                          <th style={{ width: '11%' }}>Date</th>
                          <th style={{ width: '15%' }}>Employee</th>
                          <th style={{ width: '22%' }}>Subject &amp; Expenses</th>
                          <th style={{ width: '13%' }}>Amount (Rs.)</th>
                          <th style={{ width: '10%' }}>Bills</th>
                          <th style={{ width: '16%' }}>Admin Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPcList.map((pc) => {
                          const attachmentsCount = Array.isArray(pc.attachments) ? pc.attachments.length : 0;
                          const itemCount = Array.isArray(pc.items) ? pc.items.length : 1;
                          return (
                            <tr key={pc._id || pc.voucherNo}>
                              <td style={{ fontWeight: 'bold', color: '#15803d' }}>{pc.voucherNo}</td>
                              <td>{pc.dateFormatted || new Date(pc.date || pc.createdAt).toLocaleDateString('en-GB')}</td>
                              <td>
                                <strong style={{ color: '#0f172a' }}>{pc.name || pc.requestedBy}</strong>
                                {pc.department && <div style={{ fontSize: '11px', color: '#64748b' }}>{pc.department}</div>}
                              </td>
                              <td>
                                <strong>{pc.subject || pc.purpose}</strong>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  {itemCount} item{itemCount === 1 ? '' : 's'}
                                  {pc.items && pc.items[0] ? ` (${pc.items[0].description})` : ''}
                                </div>
                              </td>
                              <td style={{ fontWeight: '700', color: '#0f172a' }}>
                                Rs. {Number(pc.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td>
                                <span className={`appr-bill-badge ${attachmentsCount === 0 ? 'none' : ''}`}>
                                  📎 {attachmentsCount} {attachmentsCount === 1 ? 'Bill' : 'Bills'}
                                </span>
                              </td>
                              <td>
                                <div className="appr-actions-cell">
                                  <button
                                    type="button"
                                    className="btn-review-action"
                                    style={{ background: '#15803d' }}
                                    onClick={() => handleViewPettyCash(pc)}
                                    title="Review exact physical Reimbursement Form & bills"
                                  >
                                    🔍 Review
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-approve"
                                    onClick={() => handleApprovePc(pc._id || pc.voucherNo)}
                                    title="Approve & Deduct From Spendable Limit"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-reject"
                                    onClick={() => handleRejectPc(pc._id || pc.voucherNo)}
                                    title="Reject Request"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 1: PAYMENT VOUCHER TABLE (USER & ADMIN VIEW)
            ========================================================================= */}
        {activeTab === 'payment-voucher' && (
          <div className="approvement-table-card">
            <table className="appr-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>Voucher No</th>
                  <th style={{ width: '10%' }}>Date</th>
                  <th style={{ width: '22%' }}>Payee / Details</th>
                  <th style={{ width: '13%' }}>Amount (LKR)</th>
                  <th style={{ width: '10%' }}>Bills</th>
                  <th style={{ width: '11%' }}>Prepared By</th>
                  <th style={{ width: '14%' }}>Approval Status</th>
                  <th style={{ width: '17%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                      Loading payment vouchers...
                    </td>
                  </tr>
                ) : filteredPv.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No payment vouchers found. Click "+ New Payment Voucher" to submit one.
                    </td>
                  </tr>
                ) : (
                  filteredPv.map((v) => {
                    const attachmentsCount = Array.isArray(v.attachments) ? v.attachments.length : 0;
                    const displayAmount = v.totalAmount || v.amount || 0;
                    return (
                      <tr key={v._id || v.voucherNo}>
                        <td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{v.voucherNo}</td>
                        <td>{v.dateFormatted || new Date(v.date || v.createdAt).toLocaleDateString('en-GB')}</td>
                        <td>
                          <strong>{v.payeeName}</strong>
                          {v.payeeNote && <div style={{ fontSize: '11px', color: '#1e40af' }}>{v.payeeNote}</div>}
                          {v.items && v.items.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {v.items[0].particulars} {v.items.length > 1 ? `(+${v.items.length - 1} items)` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: '700', color: '#0f172a' }}>
                          Rs. {Number(displayAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={`appr-bill-badge ${attachmentsCount === 0 ? 'none' : ''}`}>
                            📎 {attachmentsCount}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px' }}>{v.preparedBy || 'user'}</span>
                        </td>
                        <td>
                          <span className={`appr-status-badge ${v.status.toLowerCase()}`}>
                            {v.status === 'Approved' ? (
                              <span>✓ Approved by {v.approvedBy || 'Admin'}</span>
                            ) : v.status === 'Pending' ? (
                              <span>🟡 Pending Approval</span>
                            ) : (
                              <span>✕ Rejected</span>
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="appr-actions-cell">
                            <button
                              type="button"
                              className="appr-view-btn"
                              onClick={() => handleViewVoucher(v)}
                              title="View exact Page 1 voucher sheet & attached bills"
                            >
                              👁️ View
                            </button>

                            <button
                              type="button"
                              className="appr-print-btn"
                              onClick={() => handleViewVoucher(v)}
                              title="Print Voucher Sheet"
                            >
                              🖨️
                            </button>

                            {isAdmin && v.status === 'Pending' && (
                              <>
                                <button
                                  type="button"
                                  className="btn-approve"
                                  onClick={() => handleApprovePv(v._id || v.voucherNo)}
                                  title="Approve Voucher"
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  className="btn-reject"
                                  onClick={() => handleRejectPv(v._id || v.voucherNo)}
                                  title="Reject Voucher"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            TAB 2: PETTY CASH & EXPENSES REIMBURSEMENT TABLE
            ========================================================================= */}
        {activeTab === 'petty-cash' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* SPENDABLE LIMIT & FUND MANAGEMENT CARD */}
            <div className="spendable-limit-card">
              <div className="spendable-limit-header">
                <div className="spendable-title-group">
                  <div className="spendable-icon">💳</div>
                  <div className="spendable-title-text">
                    <h3>Petty Cash Spendable Limit &amp; Fund Balance</h3>
                    <p>
                      Fund Period: <strong>{pettyCashLimit.period || 'Monthly (October 2026)'}</strong> &bull; Set by:{' '}
                      <strong>{pettyCashLimit.setBy || 'Admin'}</strong>
                    </p>
                  </div>
                </div>

                <div className="spendable-header-actions">
                  {isAdmin ? (
                    <button
                      type="button"
                      className="btn-set-limit"
                      onClick={() => {
                        setLimitForm({
                          totalLimit: pettyCashLimit.totalLimit,
                          period: pettyCashLimit.period,
                        });
                        setIsEditLimitOpen(true);
                      }}
                      title="Admin: Set or Top-up Spendable Petty Cash Limit"
                    >
                      ⚙️ Set / Top-up Spendable Limit
                    </button>
                  ) : (
                    <div className="user-view-only-badge" title="Normal user view: only Admin can configure fund limits">
                      🔒 Limit Managed by Admin
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="spendable-stats-grid">
                <div className="spendable-stat-box primary">
                  <span className="spendable-stat-label">Total Spendable Limit</span>
                  <span className="spendable-stat-val">
                    Rs. {Number(pettyCashLimit.totalLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="spendable-stat-sub">Allocated Fund Budget</span>
                </div>

                <div className="spendable-stat-box spent">
                  <span className="spendable-stat-label">Total Deducted (Approved)</span>
                  <span className="spendable-stat-val">
                    - Rs. {Number(pettyCashLimit.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="spendable-stat-sub">
                    {pettyCashLimit.approvedCount || 0} approved reimbursement{pettyCashLimit.approvedCount === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="spendable-stat-box balance">
                  <span className="spendable-stat-label">Available Spendable Balance</span>
                  <span className="spendable-stat-val">
                    Rs. {Number(pettyCashLimit.remainingLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="spendable-stat-sub">Remaining balance to spend</span>
                </div>

                <div className="spendable-stat-box pending">
                  <span className="spendable-stat-label">Pending Approvals</span>
                  <span className="spendable-stat-val">
                    Rs. {Number(pettyCashLimit.pendingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="spendable-stat-sub">
                    {pettyCashLimit.pendingCount || 0} request{pettyCashLimit.pendingCount === 1 ? '' : 's'} awaiting authorization
                  </span>
                </div>
              </div>

              {/* Visual Fund Utilization Progress Bar */}
              <div className="spendable-progress-wrap">
                <div className="spendable-progress-labels">
                  <span>
                    Fund Utilization:{' '}
                    <strong>
                      {pettyCashLimit.totalLimit > 0
                        ? ((pettyCashLimit.totalSpent / pettyCashLimit.totalLimit) * 100).toFixed(1)
                        : 0}
                      %
                    </strong>
                  </span>
                  <span>
                    Rs. {Number(pettyCashLimit.remainingLimit || 0).toLocaleString()} remaining available
                  </span>
                </div>
                <div className="spendable-progress-track">
                  <div
                    className={`spendable-progress-fill ${
                      pettyCashLimit.totalSpent / (pettyCashLimit.totalLimit || 1) > 0.85
                        ? 'high'
                        : pettyCashLimit.totalSpent / (pettyCashLimit.totalLimit || 1) > 0.6
                        ? 'medium'
                        : 'low'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        pettyCashLimit.totalLimit > 0
                          ? (pettyCashLimit.totalSpent / pettyCashLimit.totalLimit) * 100
                          : 0
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* EXPENSES REIMBURSEMENT TABLE */}
            <div className="approvement-table-card">
              <table className="appr-table">
                <thead>
                  <tr>
                    <th style={{ width: '13%' }}>Form No</th>
                    <th style={{ width: '10%' }}>Date</th>
                    <th style={{ width: '17%' }}>Employee / Name</th>
                    <th style={{ width: '22%' }}>Subject &amp; Expenses</th>
                    <th style={{ width: '12%' }}>Total Amount</th>
                    <th style={{ width: '9%' }}>Attached Bills</th>
                    <th style={{ width: '14%' }}>Status &amp; Deduction</th>
                    <th style={{ width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                        Loading expenses reimbursement forms...
                      </td>
                    </tr>
                  ) : filteredPc.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No expenses reimbursement records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPc.map((pc) => {
                      const attachmentsCount = Array.isArray(pc.attachments) ? pc.attachments.length : 0;
                      const itemCount = Array.isArray(pc.items) ? pc.items.length : 1;
                      const isApproved = pc.status === 'Approved';
                      const isPending = pc.status === 'Pending';
                      const isRejected = pc.status === 'Rejected';

                      return (
                        <tr key={pc._id || pc.voucherNo}>
                          <td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{pc.voucherNo}</td>
                          <td>{pc.dateFormatted || new Date(pc.date || pc.createdAt).toLocaleDateString('en-GB')}</td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{pc.name || pc.requestedBy}</strong>
                            {pc.department && <div style={{ fontSize: '11px', color: '#64748b' }}>{pc.department}</div>}
                          </td>
                          <td>
                            <strong>{pc.subject || pc.purpose}</strong>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {itemCount} item{itemCount === 1 ? '' : 's'}
                              {pc.items && pc.items[0] ? ` (${pc.items[0].description})` : ''}
                            </div>
                          </td>
                          <td style={{ fontWeight: '700', color: '#0f172a' }}>
                            Rs. {Number(pc.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span className={`appr-bill-badge ${attachmentsCount === 0 ? 'none' : ''}`}>
                              📎 {attachmentsCount} {attachmentsCount === 1 ? 'Bill' : 'Bills'}
                            </span>
                          </td>
                          <td>
                            <span className={`appr-status-badge ${pc.status.toLowerCase()}`}>
                              {isApproved ? (
                                <span>✓ Approved &amp; Deducted</span>
                              ) : isPending ? (
                                <span>🟡 Pending Approval</span>
                              ) : (
                                <span>✕ Rejected</span>
                              )}
                            </span>
                          </td>
                          <td>
                            <div className="appr-actions-cell">
                              <button
                                type="button"
                                className="appr-view-btn"
                                onClick={() => handleViewPettyCash(pc)}
                                title="View exact physical Expenses Reimbursement Form & bills"
                              >
                                👁️ View
                              </button>
                              <button
                                type="button"
                                className="appr-print-btn"
                                onClick={() => handleViewPettyCash(pc)}
                                title="Print Form"
                              >
                                🖨️
                              </button>
                              {isAdmin && isPending && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-approve"
                                    onClick={() => handleApprovePc(pc._id || pc.voucherNo)}
                                    title="Approve & Deduct From Spendable Fund"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-reject"
                                    onClick={() => handleRejectPc(pc._id || pc.voucherNo)}
                                    title="Reject Request"
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: LEAVE REQUEST TABLE
            ========================================================================= */}
        {activeTab === 'leave-request' && (
          <div className="approvement-table-card">
            <table className="appr-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>Request No</th>
                  <th style={{ width: '18%' }}>Employee</th>
                  <th style={{ width: '12%' }}>Leave Type</th>
                  <th style={{ width: '18%' }}>Period / Duration</th>
                  <th style={{ width: '15%' }}>Reason</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '14%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                      Loading leave requests...
                    </td>
                  </tr>
                ) : filteredLr.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  filteredLr.map((lr) => (
                    <tr key={lr._id}>
                      <td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{lr.requestNo}</td>
                      <td>
                        <strong>{lr.employeeName}</strong>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 6px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '3px',
                            fontSize: '11px',
                            color: '#1d4ed8',
                          }}
                        >
                          {lr.leaveType}
                        </span>
                      </td>
                      <td>
                        <div>
                          {new Date(lr.startDate).toLocaleDateString()} &rarr;{' '}
                          {new Date(lr.endDate).toLocaleDateString()}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          ({lr.numberOfDays} {lr.numberOfDays === 1 ? 'day' : 'days'})
                        </span>
                      </td>
                      <td style={{ fontSize: '11px' }}>{lr.reason}</td>
                      <td>
                        <span className={`appr-status-badge ${lr.status.toLowerCase()}`}>
                          {lr.status}
                        </span>
                      </td>
                      <td>
                        {lr.status === 'Pending' ? (
                          <div className="appr-actions-cell">
                            <button
                              type="button"
                              className="btn-approve"
                              onClick={() => handleUpdateStatus('lr', lr._id, 'Approved')}
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              className="btn-reject"
                              onClick={() => handleUpdateStatus('lr', lr._id, 'Rejected')}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {lr.status === 'Approved'
                              ? `Approved by ${lr.approvedBy || 'Admin'}`
                              : 'Rejected'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODAL 1: NEW PAYMENT VOUCHER CREATION MODAL
          ========================================================================= */}
      <PaymentVoucherCreateModal
        isOpen={isCreatePvOpen}
        onClose={() => setIsCreatePvOpen(false)}
        onSuccess={handleCreatePvSubmit}
        currentUser={currentUser}
      />

      {/* =========================================================================
          MODAL 2: VOUCHER DETAILS & ATTACHMENT VIEWER / ADMIN APPROVER
          ========================================================================= */}
      <VoucherDetailsModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedVoucher(null);
        }}
        voucher={selectedVoucher}
        isAdmin={isAdmin}
        onApprove={handleApprovePv}
        onReject={handleRejectPv}
        isProcessing={isProcessingApproval}
      />

      {/* =========================================================================
          MODALS FOR PETTY CASH / EXPENSES REIMBURSEMENT
          ========================================================================= */}
      <PettyCashCreateModal
        isOpen={isCreatePcOpen}
        onClose={() => setIsCreatePcOpen(false)}
        onSubmit={handleCreatePcSubmit}
        currentUser={currentUser}
        spendableLimit={pettyCashLimit}
      />

      <PettyCashDetailsModal
        isOpen={isPcViewerOpen}
        onClose={() => {
          setIsPcViewerOpen(false);
          setSelectedPettyCash(null);
        }}
        voucher={selectedPettyCash}
        isAdmin={isAdmin}
        onApprove={handleApprovePc}
        onReject={handleRejectPc}
        isProcessing={isProcessingApproval}
        spendableLimit={pettyCashLimit}
      />

      {/* ADMIN SPENDABLE LIMIT MODAL (ADMIN ONLY) */}
      {isEditLimitOpen && isAdmin && (
        <div className="pv-modal-overlay" onClick={() => !isSubmitting && setIsEditLimitOpen(false)}>
          <div className="pv-modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <div>
                <h2 className="pv-modal-title">⚙️ Configure Spendable Fund Limit</h2>
                <p className="pv-modal-subtitle">
                  Admin Only: Set total spendable limit for petty cash expense reimbursements.
                </p>
              </div>
              <button
                type="button"
                className="pv-close-btn"
                onClick={() => setIsEditLimitOpen(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveLimitSubmit}>
              <div className="pv-modal-body" style={{ padding: '20px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                    Total Spendable Limit (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="pv-form-input"
                    value={limitForm.totalLimit}
                    onChange={(e) => setLimitForm({ ...limitForm, totalLimit: e.target.value })}
                    required
                    style={{ fontSize: '16px', fontWeight: 'bold' }}
                    autoFocus
                  />
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                    Current Spent: Rs. {Number(pettyCashLimit.totalSpent || 0).toLocaleString()} &bull;{' '}
                    New Balance: Rs.{' '}
                    {Math.max(
                      0,
                      Number(limitForm.totalLimit || 0) - Number(pettyCashLimit.totalSpent || 0)
                    ).toLocaleString()}
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                    Fund Period / Title
                  </label>
                  <input
                    type="text"
                    className="pv-form-input"
                    value={limitForm.period}
                    onChange={(e) => setLimitForm({ ...limitForm, period: e.target.value })}
                    placeholder="e.g. Monthly (October 2026)"
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="pv-preset-btn"
                    onClick={() => setLimitForm({ ...limitForm, totalLimit: 50000 })}
                  >
                    Rs. 50,000
                  </button>
                  <button
                    type="button"
                    className="pv-preset-btn"
                    onClick={() => setLimitForm({ ...limitForm, totalLimit: 75000 })}
                  >
                    Rs. 75,000
                  </button>
                  <button
                    type="button"
                    className="pv-preset-btn"
                    onClick={() => setLimitForm({ ...limitForm, totalLimit: 100000 })}
                  >
                    Rs. 100,000
                  </button>
                  <button
                    type="button"
                    className="pv-preset-btn"
                    onClick={() => setLimitForm({ ...limitForm, totalLimit: 150000 })}
                  >
                    Rs. 150,000
                  </button>
                </div>
              </div>

              <div className="pv-modal-footer">
                <button
                  type="button"
                  className="pv-btn-secondary"
                  onClick={() => setIsEditLimitOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="pv-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save & Update Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL FOR LEAVE REQUEST
          ========================================================================= */}
      {isModalOpen && activeTab === 'leave-request' && (
        <div className="appr-modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="appr-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="appr-modal-header">
              <h2>New Leave Request</h2>
              <button
                type="button"
                className="appr-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            {/* Leave Request Form */}
            <form onSubmit={handleSubmitLr}>
                <div className="appr-modal-body">
                  <div className="appr-form-field">
                    <label>Employee Name *</label>
                    <input
                      type="text"
                      className="appr-input"
                      placeholder="e.g. Kasun Silva"
                      value={lrForm.employeeName}
                      onChange={(e) => setLrForm({ ...lrForm, employeeName: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="appr-form-row">
                    <div className="appr-form-field">
                      <label>Leave Type</label>
                      <select
                        className="appr-input"
                        value={lrForm.leaveType}
                        onChange={(e) => setLrForm({ ...lrForm, leaveType: e.target.value })}
                      >
                        <option value="Annual">Annual Leave</option>
                        <option value="Casual">Casual Leave</option>
                        <option value="Medical">Medical Leave</option>
                        <option value="Half-Day">Half-Day</option>
                      </select>
                    </div>

                    <div className="appr-form-field">
                      <label>Number of Days</label>
                      <input
                        type="number"
                        className="appr-input"
                        min="0.5"
                        step="0.5"
                        value={lrForm.numberOfDays}
                        onChange={(e) => setLrForm({ ...lrForm, numberOfDays: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="appr-form-row">
                    <div className="appr-form-field">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        className="appr-input"
                        value={lrForm.startDate}
                        onChange={(e) => setLrForm({ ...lrForm, startDate: e.target.value })}
                        required
                      />
                    </div>

                    <div className="appr-form-field">
                      <label>End Date *</label>
                      <input
                        type="date"
                        className="appr-input"
                        value={lrForm.endDate}
                        onChange={(e) => setLrForm({ ...lrForm, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="appr-form-field">
                    <label>Reason for Leave *</label>
                    <textarea
                      className="appr-input"
                      rows="2"
                      placeholder="e.g. Family commitment / personal travel"
                      value={lrForm.reason}
                      onChange={(e) => setLrForm({ ...lrForm, reason: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="appr-modal-footer">
                  <button
                    type="button"
                    className="modal-btn secondary"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Submit Leave Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

export default Approvement;
