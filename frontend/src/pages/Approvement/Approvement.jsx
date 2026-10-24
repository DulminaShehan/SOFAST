import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainMenu from '../../components/navigation/MainMenu';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import windowIcon from '../../assets/window-icon.png';
import './Approvement.css';

/**
 * SOFAST MOTORS - Approvement Module
 * Sub-sections:
 * 1. Payment Voucher (payment vauture)
 * 2. Petty Cash
 * 3. Leave Request (lever requerst)
 */
function Approvement({ defaultSection }) {
  const { currentUser, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect active tab from prop or URL
  const getInitialTab = () => {
    if (defaultSection) return defaultSection;
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [pvForm, setPvForm] = useState({
    payeeName: '',
    amount: '',
    paymentMethod: 'Bank Transfer',
    description: '',
    remarks: '',
  });

  const [pcForm, setPcForm] = useState({
    requestedBy: '',
    department: 'POS Cashier Counter',
    amount: '',
    category: 'Office Supplies',
    purpose: '',
    remarks: '',
  });

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
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync tab with URL if prop or pathname changes
  useEffect(() => {
    if (location.pathname.includes('petty-cash')) {
      setActiveTab('petty-cash');
    } else if (location.pathname.includes('leave-request')) {
      setActiveTab('leave-request');
    } else if (location.pathname.includes('payment-voucher')) {
      setActiveTab('payment-voucher');
    }
  }, [location.pathname]);

  // Fetch all approval records
  const fetchData = async () => {
    try {
      setLoading(true);
      const [pvRes, pcRes, lrRes] = await Promise.all([
        api.get('/approvement/payment-vouchers'),
        api.get('/approvement/petty-cash'),
        api.get('/approvement/leave-requests'),
      ]);

      if (pvRes.data?.success) setPaymentVouchers(pvRes.data.data);
      if (pcRes.data?.success) setPettyCashList(pcRes.data.data);
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
  }, []);

  // Status Update Handler (Approve / Reject)
  const handleUpdateStatus = async (type, id, newStatus) => {
    try {
      let endpoint = '';
      if (type === 'pv') endpoint = `/approvement/payment-vouchers/${id}/status`;
      else if (type === 'pc') endpoint = `/approvement/petty-cash/${id}/status`;
      else if (type === 'lr') endpoint = `/approvement/leave-requests/${id}/status`;

      const res = await api.put(endpoint, {
        status: newStatus,
        approvedBy: currentUser?.username || 'admin',
      });

      if (res.data?.success) {
        showToast(`Record marked as ${newStatus}!`);
        fetchData();
      }
    } catch (err) {
      showToast('Failed to update approval status', 'error');
    }
  };

  // Form Submissions
  const handleSubmitPv = async (e) => {
    e.preventDefault();
    if (!pvForm.payeeName || !pvForm.amount) {
      showToast('Payee name and amount are required', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.post('/approvement/payment-vouchers', pvForm);
      if (res.data?.success) {
        showToast(`Payment Voucher ${res.data.data?.voucherNo} created successfully!`);
        setIsModalOpen(false);
        setPvForm({ payeeName: '', amount: '', paymentMethod: 'Bank Transfer', description: '', remarks: '' });
        fetchData();
      }
    } catch (err) {
      showToast('Failed to create payment voucher', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPc = async (e) => {
    e.preventDefault();
    if (!pcForm.requestedBy || !pcForm.amount || !pcForm.purpose) {
      showToast('Requester, amount, and purpose are required', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.post('/approvement/petty-cash', pcForm);
      if (res.data?.success) {
        showToast(`Petty Cash Voucher ${res.data.data?.voucherNo} created successfully!`);
        setIsModalOpen(false);
        setPcForm({ requestedBy: '', department: 'POS Cashier Counter', amount: '', category: 'Office Supplies', purpose: '', remarks: '' });
        fetchData();
      }
    } catch (err) {
      showToast('Failed to create petty cash request', 'error');
    } finally {
      setIsSubmitting(false);
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
        setLrForm({ employeeName: '', leaveType: 'Annual', startDate: '', endDate: '', numberOfDays: 1, reason: '', remarks: '' });
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
  const filteredPc = filterList(pettyCashList, 'requestedBy');
  const filteredLr = filterList(leaveRequests, 'employeeName');

  const pendingPvCount = paymentVouchers.filter((v) => v.status === 'Pending').length;
  const pendingPcCount = pettyCashList.filter((v) => v.status === 'Pending').length;
  const pendingLrCount = leaveRequests.filter((v) => v.status === 'Pending').length;

  return (
    <div className="approvement-page-container">
      {/* 1. Header Bar */}
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

      {/* 3. Main Workspace */}
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
        </div>

        {/* Overview Banner Card */}
        <div className="approvement-banner">
          <div className="approvement-banner-left">
            <div className="approvement-banner-icon">
              {activeTab === 'payment-voucher' ? '💳' : activeTab === 'petty-cash' ? '💵' : '📅'}
            </div>
            <div className="approvement-banner-titles">
              <h1>
                {activeTab === 'payment-voucher'
                  ? 'Payment Voucher Approvals & Settlements'
                  : activeTab === 'petty-cash'
                  ? 'Petty Cash Requests & Disbursements'
                  : 'Employee Leave Requests & Attendance Approvals'}
              </h1>
              <p>
                {activeTab === 'payment-voucher'
                  ? 'Manage vendor supplier payments, cheque disbursements, and transaction authorizations.'
                  : activeTab === 'petty-cash'
                  ? 'Approve day-to-day office expenses, branch cash requirements, and store maintenance funds.'
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

        {/* Toolbar */}
        <div className="approvement-toolbar">
          <div className="appr-toolbar-left">
            <button
              type="button"
              className="appr-add-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <span>+</span>
              <span>
                {activeTab === 'payment-voucher'
                  ? 'New Payment Voucher'
                  : activeTab === 'petty-cash'
                  ? 'New Petty Cash Request'
                  : 'New Leave Request'}
              </span>
            </button>

            <div className="appr-search-wrapper">
              <span className="appr-search-icon">🔍</span>
              <input
                type="text"
                className="appr-search-input"
                placeholder={
                  activeTab === 'payment-voucher'
                    ? 'Search by payee or voucher #...'
                    : activeTab === 'petty-cash'
                    ? 'Search by requester or PC #...'
                    : 'Search by employee or LR #...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

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

        {/* Tab 1: Payment Voucher Table */}
        {activeTab === 'payment-voucher' && (
          <div className="approvement-table-card">
            <table className="appr-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>Voucher No</th>
                  <th style={{ width: '11%' }}>Date</th>
                  <th style={{ width: '22%' }}>Payee / Vendor</th>
                  <th style={{ width: '13%' }}>Amount (LKR)</th>
                  <th style={{ width: '13%' }}>Payment Method</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '16%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                      Loading payment vouchers...
                    </td>
                  </tr>
                ) : filteredPv.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No payment vouchers found.
                    </td>
                  </tr>
                ) : (
                  filteredPv.map((v) => (
                    <tr key={v._id}>
                      <td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{v.voucherNo}</td>
                      <td>{new Date(v.date || v.createdAt).toLocaleDateString()}</td>
                      <td>
                        <strong>{v.payeeName}</strong>
                        {v.description && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{v.description}</div>
                        )}
                      </td>
                      <td style={{ fontWeight: '600', color: '#0f172a' }}>
                        Rs. {Number(v.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>{v.paymentMethod}</td>
                      <td>
                        <span className={`appr-status-badge ${v.status.toLowerCase()}`}>
                          {v.status}
                        </span>
                      </td>
                      <td>
                        {v.status === 'Pending' ? (
                          <div className="appr-actions-cell">
                            <button
                              type="button"
                              className="btn-approve"
                              onClick={() => handleUpdateStatus('pv', v._id, 'Approved')}
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              className="btn-reject"
                              onClick={() => handleUpdateStatus('pv', v._id, 'Rejected')}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {v.status === 'Approved'
                              ? `By ${v.approvedBy || 'Admin'}`
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

        {/* Tab 2: Petty Cash Table */}
        {activeTab === 'petty-cash' && (
          <div className="approvement-table-card">
            <table className="appr-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>PC Number</th>
                  <th style={{ width: '11%' }}>Date</th>
                  <th style={{ width: '18%' }}>Requested By</th>
                  <th style={{ width: '14%' }}>Department / Cat</th>
                  <th style={{ width: '13%' }}>Amount (LKR)</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '16%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                      Loading petty cash vouchers...
                    </td>
                  </tr>
                ) : filteredPc.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No petty cash records found.
                    </td>
                  </tr>
                ) : (
                  filteredPc.map((pc) => (
                    <tr key={pc._id}>
                      <td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{pc.voucherNo}</td>
                      <td>{new Date(pc.date || pc.createdAt).toLocaleDateString()}</td>
                      <td>
                        <strong>{pc.requestedBy}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{pc.purpose}</div>
                      </td>
                      <td>
                        <div>{pc.department}</div>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>({pc.category})</span>
                      </td>
                      <td style={{ fontWeight: '600', color: '#0f172a' }}>
                        Rs. {Number(pc.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`appr-status-badge ${pc.status.toLowerCase()}`}>
                          {pc.status}
                        </span>
                      </td>
                      <td>
                        {pc.status === 'Pending' ? (
                          <div className="appr-actions-cell">
                            <button
                              type="button"
                              className="btn-approve"
                              onClick={() => handleUpdateStatus('pc', pc._id, 'Approved')}
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              className="btn-reject"
                              onClick={() => handleUpdateStatus('pc', pc._id, 'Rejected')}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {pc.status === 'Approved'
                              ? `Disbursed by ${pc.approvedBy || 'Admin'}`
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

        {/* Tab 3: Leave Request Table */}
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

      {/* Modal Dialogs */}
      {isModalOpen && (
        <div className="appr-modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="appr-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="appr-modal-header">
              <h2>
                {activeTab === 'payment-voucher'
                  ? 'New Payment Voucher'
                  : activeTab === 'petty-cash'
                  ? 'New Petty Cash Request'
                  : 'New Leave Request'}
              </h2>
              <button
                type="button"
                className="appr-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            {/* Payment Voucher Modal Form */}
            {activeTab === 'payment-voucher' && (
              <form onSubmit={handleSubmitPv}>
                <div className="appr-modal-body">
                  <div className="appr-form-field">
                    <label>Payee / Vendor Name *</label>
                    <input
                      type="text"
                      className="appr-input"
                      placeholder="e.g. Toyota Lanka (Pvt) Ltd"
                      value={pvForm.payeeName}
                      onChange={(e) => setPvForm({ ...pvForm, payeeName: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="appr-form-row">
                    <div className="appr-form-field">
                      <label>Amount (LKR) *</label>
                      <input
                        type="number"
                        className="appr-input"
                        placeholder="e.g. 50000"
                        value={pvForm.amount}
                        onChange={(e) => setPvForm({ ...pvForm, amount: e.target.value })}
                        required
                      />
                    </div>

                    <div className="appr-form-field">
                      <label>Payment Method</label>
                      <select
                        className="appr-input"
                        value={pvForm.paymentMethod}
                        onChange={(e) => setPvForm({ ...pvForm, paymentMethod: e.target.value })}
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                        <option value="Credit Card">Credit Card</option>
                      </select>
                    </div>
                  </div>

                  <div className="appr-form-field">
                    <label>Description / Invoice Reference</label>
                    <textarea
                      className="appr-input"
                      rows="2"
                      placeholder="e.g. Settlement for GRN-9981 spare parts invoice"
                      value={pvForm.description}
                      onChange={(e) => setPvForm({ ...pvForm, description: e.target.value })}
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
                    {isSubmitting ? 'Saving...' : 'Submit Payment Voucher'}
                  </button>
                </div>
              </form>
            )}

            {/* Petty Cash Modal Form */}
            {activeTab === 'petty-cash' && (
              <form onSubmit={handleSubmitPc}>
                <div className="appr-modal-body">
                  <div className="appr-form-row">
                    <div className="appr-form-field">
                      <label>Requested By *</label>
                      <input
                        type="text"
                        className="appr-input"
                        placeholder="Staff member name"
                        value={pcForm.requestedBy}
                        onChange={(e) => setPcForm({ ...pcForm, requestedBy: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="appr-form-field">
                      <label>Department</label>
                      <input
                        type="text"
                        className="appr-input"
                        placeholder="e.g. Cashier Counter"
                        value={pcForm.department}
                        onChange={(e) => setPcForm({ ...pcForm, department: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="appr-form-row">
                    <div className="appr-form-field">
                      <label>Amount (LKR) *</label>
                      <input
                        type="number"
                        className="appr-input"
                        placeholder="e.g. 3500"
                        value={pcForm.amount}
                        onChange={(e) => setPcForm({ ...pcForm, amount: e.target.value })}
                        required
                      />
                    </div>

                    <div className="appr-form-field">
                      <label>Expense Category</label>
                      <select
                        className="appr-input"
                        value={pcForm.category}
                        onChange={(e) => setPcForm({ ...pcForm, category: e.target.value })}
                      >
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Staff Refreshments">Staff Refreshments</option>
                        <option value="Transport & Fuel">Transport & Fuel</option>
                        <option value="Minor Repairs">Minor Repairs</option>
                        <option value="Postage & Delivery">Postage & Delivery</option>
                        <option value="Miscellaneous">Miscellaneous</option>
                      </select>
                    </div>
                  </div>

                  <div className="appr-form-field">
                    <label>Purpose / Expenditure Details *</label>
                    <textarea
                      className="appr-input"
                      rows="2"
                      placeholder="State exact purpose of expense..."
                      value={pcForm.purpose}
                      onChange={(e) => setPcForm({ ...pcForm, purpose: e.target.value })}
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
                    {isSubmitting ? 'Saving...' : 'Submit Petty Cash Request'}
                  </button>
                </div>
              </form>
            )}

            {/* Leave Request Modal Form */}
            {activeTab === 'leave-request' && (
              <form onSubmit={handleSubmitLr}>
                <div className="appr-modal-body">
                  <div className="appr-form-row">
                    <div className="appr-form-field">
                      <label>Employee Name *</label>
                      <input
                        type="text"
                        className="appr-input"
                        placeholder="Staff full name"
                        value={lrForm.employeeName}
                        onChange={(e) => setLrForm({ ...lrForm, employeeName: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>

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
                        <option value="Half-Day">Half-Day Leave</option>
                      </select>
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

                  <div className="appr-form-row">
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

                  <div className="appr-form-field">
                    <label>Reason for Leave *</label>
                    <textarea
                      className="appr-input"
                      rows="2"
                      placeholder="Briefly state reason..."
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
                    {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default Approvement;
