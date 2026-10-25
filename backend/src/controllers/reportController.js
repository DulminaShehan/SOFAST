import mongoose from 'mongoose';
import Item from '../models/Item.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import Settlement from '../models/Settlement.js';
import Grn from '../models/Grn.js';
import CustomerDamageReturn from '../models/CustomerDamageReturn.js';
import SupplierReturn from '../models/SupplierReturn.js';
import Supplier from '../models/Supplier.js';
import Customer from '../models/Customer.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Standard Company Header for Reports
 */
const COMPANY_HEADER = {
  name: 'SOFAST (PVT) LTD',
  address: '7E, MADDEGODA ROAD, MATHUGAMA',
  phones: '034-2210680, 074-0295088',
};

const SOFTWARE_FOOTER = '';

/**
 * Helper to construct date range filters that work with both Date objects and ISO strings.
 * If startDate and endDate are omitted or 'all', returns empty object (no date restriction).
 */
const buildDateRangeQuery = (startDate, endDate, dateField = 'date') => {
  if (!startDate && !endDate) return {};

  const clauses = [];
  let startD = null;
  let endD = null;

  if (startDate && String(startDate).trim() && String(startDate).toLowerCase() !== 'all') {
    startD = new Date(String(startDate).trim());
    if (!isNaN(startD.getTime())) {
      startD.setHours(0, 0, 0, 0);
    } else {
      startD = null;
    }
  }

  if (endDate && String(endDate).trim() && String(endDate).toLowerCase() !== 'all') {
    endD = new Date(String(endDate).trim());
    if (!isNaN(endD.getTime())) {
      endD.setHours(23, 59, 59, 999);
    } else {
      endD = null;
    }
  }

  if (!startD && !endD) return {};

  // 1. Comparison on dateField as Date object
  const dateObjFilter = {};
  if (startD) dateObjFilter.$gte = startD;
  if (endD) dateObjFilter.$lte = endD;
  if (Object.keys(dateObjFilter).length > 0) {
    clauses.push({ [dateField]: dateObjFilter });
  }

  // 2. Also match createdAt if dateField !== 'createdAt'
  if (dateField !== 'createdAt') {
    const createdFilter = {};
    if (startD) createdFilter.$gte = startD;
    if (endD) createdFilter.$lte = endD;
    if (Object.keys(createdFilter).length > 0) {
      clauses.push({ createdAt: createdFilter });
    }
  }

  return clauses.length === 1 ? clauses[0] : (clauses.length > 1 ? { $or: clauses } : {});
};

// =============================================================================
// 1. CLOSING STOCK REPORT
// =============================================================================
export const getClosingStockReport = async (req, res, next) => {
  try {
    const {
      search = '',
      category = '',
      sortBy = 'default',
      stockStatus = 'all',
      staff = '',
      bin = '',
      page = 1,
      limit = 35,
    } = req.query;

    if (!isDbConnected()) {
      return res.status(200).json({
        success: false,
        message: 'Database offline mode',
        data: [],
        summary: {},
      });
    }

    // 1. Gather product usage map from live invoices
    const productUsageMap = new Map();
    try {
      const invoices = await Invoice.find(
        { status: { $ne: 'cancelled' } },
        { lineItems: 1, userId: 1, cashier: 1, user: 1, createdBy: 1 }
      ).lean();

      invoices.forEach((inv) => {
        const staffUser = inv.cashier || inv.user || inv.createdBy || (inv.userId ? String(inv.userId) : 'cashier');
        (inv.lineItems || []).forEach((li) => {
          const code = String(li.code || li.itemCode || '').trim();
          if (!code) return;
          const qty = Number(li.quantity || li.qty || 1);
          const val = Number(li.total || (li.unitPrice * qty) || 0);

          if (!productUsageMap.has(code)) {
            productUsageMap.set(code, {
              totalSold: 0,
              totalRevenue: 0,
              invoiceCount: 0,
              staffMembers: new Set(),
            });
          }
          const pStat = productUsageMap.get(code);
          pStat.totalSold += qty;
          pStat.totalRevenue += val;
          pStat.invoiceCount += 1;
          pStat.staffMembers.add(staffUser);
        });
      });
    } catch (invErr) {
      console.warn('Could not aggregate invoice usage for closing stock:', invErr.message);
    }

    // 2. Fetch Items from DB
    const query = {};
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { code: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { location: { $regex: term, $options: 'i' } },
      ];
    }

    if (category && category.trim() && category !== 'All') {
      query.category = category.trim();
    }

    const dbItems = await Item.find(query).sort({ category: 1, code: 1 }).lean();

    let items = dbItems.map((itm) => {
      const code = String(itm.code || '').trim();
      const usage = productUsageMap.get(code) || {
        totalSold: 0,
        totalRevenue: 0,
        invoiceCount: 0,
        staffMembers: new Set(['cashier']),
      };

      const qty = itm.quantity !== undefined ? Number(itm.quantity) : (itm.stockInHand !== undefined ? Number(itm.stockInHand) : 0);
      const avgCost = Number(itm.averageCost) || Number(itm.lastGrnPrice) || 0;
      const val = itm.value !== undefined && Number(itm.value) > 0 ? Number(itm.value) : Math.round(qty * avgCost * 100) / 100;
      const selPrice = Number(itm.finalSellingPrice) || Number(itm.sellingPrice) || 0;

      // Multi-location distribution simulation
      const loc1_qty = Math.round(qty * 0.7 * 100) / 100;
      const loc1_val = Math.round(val * 0.7 * 100) / 100;
      const loc2_qty = Math.round((qty - loc1_qty) * 100) / 100;
      const loc2_val = Math.round((val - loc1_val) * 100) / 100;

      return {
        _id: itm._id,
        code,
        description: String(itm.description || '').toUpperCase().trim(),
        category: String(itm.category || '2W').toUpperCase().trim(),
        bin: String(itm.location || itm.bin || 'R1-A-1').trim(),
        quantity: qty,
        value: val,
        loc1_qty,
        loc1_val,
        loc2_qty,
        loc2_val,
        loc3_qty: 0,
        loc3_val: 0,
        sellingPrice: selPrice,
        totalSold: usage.totalSold,
        totalRevenue: usage.totalRevenue,
        invoiceCount: usage.invoiceCount,
        staff: Array.from(usage.staffMembers).join(', ') || 'cashier',
        reorderLevel: Number(itm.reorderLevel) || 0,
      };
    });

    // 3. In-memory Filters
    let filtered = [...items];

    if (stockStatus === 'in_stock') {
      filtered = filtered.filter((it) => it.quantity > 0);
    } else if (stockStatus === 'out_of_stock') {
      filtered = filtered.filter((it) => it.quantity <= 0);
    } else if (stockStatus === 'low_stock') {
      filtered = filtered.filter((it) => it.quantity <= (it.reorderLevel || 2));
    } else if (stockStatus === 'high_value') {
      filtered = filtered.filter((it) => it.value >= 10000);
    }

    if (staff && staff.trim() && staff !== 'All') {
      filtered = filtered.filter((it) => it.staff.toLowerCase().includes(staff.toLowerCase()));
    }

    if (bin && bin.trim() && bin !== 'All') {
      filtered = filtered.filter((it) => it.bin.toLowerCase().startsWith(bin.toLowerCase()));
    }

    // 4. Sorting
    if (sortBy === 'qty_desc') {
      filtered.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === 'qty_asc') {
      filtered.sort((a, b) => a.quantity - b.quantity);
    } else if (sortBy === 'val_desc') {
      filtered.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'val_asc') {
      filtered.sort((a, b) => a.value - b.value);
    } else if (sortBy === 'sold_desc') {
      filtered.sort((a, b) => b.totalSold - a.totalSold);
    } else if (sortBy === 'code_asc') {
      filtered.sort((a, b) => a.code.localeCompare(b.code));
    } else if (sortBy === 'desc_asc') {
      filtered.sort((a, b) => a.description.localeCompare(b.description));
    }

    // 5. Calculate Summary Stats directly from matching database items
    const totalStockValue = filtered.reduce((sum, it) => sum + (it.value || 0), 0);
    const totalQuantity = filtered.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const inStockCount = filtered.filter((it) => it.quantity > 0).length;
    const outOfStockCount = filtered.filter((it) => it.quantity <= 0).length;
    const lowStockCount = filtered.filter((it) => it.quantity > 0 && it.quantity <= (it.reorderLevel || 2)).length;

    const catMap = new Map();
    filtered.forEach((it) => {
      catMap.set(it.category, (catMap.get(it.category) || 0) + it.value);
    });

    const categoryBreakdown = Array.from(catMap.entries()).map(([category, value]) => ({
      category,
      value: Math.round(value * 100) / 100,
    }));

    // Top item
    const topItem = [...filtered].sort((a, b) => b.totalSold - a.totalSold)[0];

    // 6. Pagination
    const totalRecords = filtered.length;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit) === 0 ? 0 : Math.max(1, Number(limit) || 35);
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? filtered : filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'closing_stock',
      reportTitle: 'CLOSING STOCK REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        totalQuantity,
        totalItemsCount: totalRecords,
        inStockCount,
        outOfStockCount,
        lowStockCount,
        categoriesCount: categoryBreakdown.length,
        categoryBreakdown,
        topProduct: topItem ? `${topItem.code} - ${topItem.description} (${topItem.totalSold} sold)` : 'N/A',
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 2. REPORT FILTER OPTIONS
// =============================================================================
export const getReportFilterOptions = async (req, res, next) => {
  try {
    let categories = [];
    let bins = [];
    let staffList = ['admin', 'cashier', 'testcashier', 'admin_new'];
    let suppliersList = [];
    let customersList = [];

    if (isDbConnected()) {
      try {
        const itemCats = await Item.distinct('category');
        const nmCats = await mongoose.connection.db.collection('nonmovingitems').distinct('category');
        categories = [...new Set([...(itemCats || []), ...(nmCats || [])])].filter(Boolean).sort();

        bins = (await Item.distinct('location')).filter(Boolean).sort();

        const users = await User.find({}, { username: 1, fullName: 1, role: 1 }).lean();
        if (users.length > 0) {
          staffList = users.map((u) => u.username).filter(Boolean);
        }

        const supNames = await Supplier.distinct('name');
        const grnSups = await Grn.distinct('supplier');
        suppliersList = [...new Set([...(supNames || []), ...(grnSups || [])])].filter(Boolean).sort();

        const cusNames = await Customer.distinct('name');
        const invCus = await Invoice.distinct('customerName');
        const stlCus = await mongoose.connection.db.collection('invoicesettlements').distinct('customer');
        customersList = [...new Set([...(cusNames || []), ...(invCus || []), ...(stlCus || [])])].filter(Boolean).sort();
      } catch (err) {
        console.warn('Filter options fetch warning:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      categories: categories.length > 0 ? categories : ['2W', '2W-BODY', '2W-ELEC', '2W-ENG', '3W', '3W-BODY', 'OIL'],
      bins: bins.length > 0 ? bins : ['R1', 'R2', 'R3', 'DISPLAY', 'Main Store'],
      staff: staffList,
      suppliers: suppliersList,
      customers: customersList,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 3. MOST USED PRODUCTS
// =============================================================================
export const getMostUsedProducts = async (req, res, next) => {
  try {
    const { limit = 25 } = req.query;
    const limitNum = Math.min(Number(limit) || 25, 200);

    const productUsageMap = new Map();

    if (isDbConnected()) {
      try {
        const invoices = await Invoice.find(
          { status: { $ne: 'cancelled' } },
          { lineItems: 1, date: 1, invoiceNumber: 1, userId: 1, cashier: 1, user: 1, createdBy: 1 }
        ).lean();

        invoices.forEach((inv) => {
          const staffUser = inv.cashier || inv.user || inv.createdBy || (inv.userId ? String(inv.userId) : 'cashier');
          (inv.lineItems || []).forEach((li) => {
            const code = String(li.code || li.itemCode || '').trim();
            if (!code) return;
            const qty = Number(li.quantity || li.qty || 1);
            const val = Number(li.total || (li.unitPrice * qty) || 0);

            if (!productUsageMap.has(code)) {
              productUsageMap.set(code, {
                code,
                description: li.description || '',
                totalSold: 0,
                totalRevenue: 0,
                invoiceCount: 0,
                lastBilledDate: inv.date || null,
                staffMembers: new Set(),
              });
            }
            const p = productUsageMap.get(code);
            p.totalSold += qty;
            p.totalRevenue += val;
            p.invoiceCount += 1;
            p.staffMembers.add(staffUser);
          });
        });
      } catch (err) {
        console.warn('Invoice aggregation error:', err.message);
      }
    }

    const sortedUsage = Array.from(productUsageMap.values())
      .map((p) => ({
        ...p,
        staff: Array.from(p.staffMembers).join(', ') || 'cashier',
      }))
      .sort((a, b) => b.totalSold - a.totalSold || b.invoiceCount - a.invoiceCount)
      .slice(0, limitNum);

    return res.status(200).json({
      success: true,
      count: sortedUsage.length,
      data: sortedUsage,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 4. DAILY SALES & PROFIT REPORT
// =============================================================================
export const getDailySalesReport = async (req, res, next) => {
  try {
    const {
      startDate = '',
      endDate = '',
      staff = 'All',
      section = 'all',
      search = '',
      sortBy = 'default',
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit) === 0 ? 0 : Math.max(1, Number(limit) || 50);

    let itemsList = [];

    if (isDbConnected()) {
      try {
        const dateQuery = buildDateRangeQuery(startDate, endDate, 'date');
        const invoiceFilter = {
          status: { $ne: 'cancelled' },
          ...dateQuery,
        };

        const invoices = await Invoice.find(invoiceFilter).lean();

        // Build item cost map from items collection
        const itemCodes = new Set();
        invoices.forEach((inv) => {
          (inv.lineItems || []).forEach((li) => {
            const c = (li.code || li.itemCode || '').trim();
            if (c) itemCodes.add(c);
          });
        });

        const dbItems = await Item.find(
          { code: { $in: Array.from(itemCodes) } },
          { code: 1, averageCost: 1, lastGrnPrice: 1, value: 1, quantity: 1, sellingPrice: 1 }
        ).lean();

        const costMap = new Map();
        dbItems.forEach((it) => {
          const unitCost = Number(it.averageCost) || Number(it.lastGrnPrice) || (it.quantity > 0 && it.value ? it.value / it.quantity : 0);
          costMap.set(it.code, unitCost);
        });

        invoices.forEach((inv) => {
          const invStaff = inv.cashier || inv.user || inv.createdBy || 'cashier';
          const invDate = inv.date || inv.createdAt;
          const dateStr = invDate ? new Date(invDate).toISOString().slice(0, 10) : '';

          (inv.lineItems || []).forEach((li) => {
            const code = String(li.code || li.itemCode || 'ITEM-GEN').trim();
            const desc = String(li.description || 'Sales Item').trim();
            const qty = Number(li.quantity || li.qty || 1);
            const val = Number(li.total || (li.unitPrice * qty) || 0);

            // Determine if service or material
            const isService =
              code.startsWith('SRV') ||
              code === 'AD' ||
              desc.toLowerCase().includes('service') ||
              desc.toLowerCase().includes('advance') ||
              desc.toLowerCase().includes('labor') ||
              desc.toLowerCase().includes('repair');

            const sectionName = isService ? 'Servicing & Repairs' : 'Materials';
            const unitCost = costMap.get(code) || (isService ? 0 : val * 0.65);
            const purVal = Number((unitCost * qty).toFixed(2));
            const profit = Number((val - purVal).toFixed(2));

            itemsList.push({
              _id: li._id || `${inv._id}_${code}`,
              invoiceNumber: inv.invoiceNumber || String(inv.no || ''),
              code,
              description: desc,
              quantity: qty,
              purVal,
              value: val,
              profit,
              section: sectionName,
              staff: invStaff,
              date: dateStr,
            });
          });
        });
      } catch (dbErr) {
        console.warn('Daily sales invoice fetch failed:', dbErr.message);
      }
    }

    // Apply Staff Filter
    if (staff && staff !== 'All') {
      itemsList = itemsList.filter(
        (i) => (i.staff || '').toLowerCase() === staff.toLowerCase()
      );
    }

    // Apply Section Filter
    if (section && section !== 'all') {
      itemsList = itemsList.filter(
        (i) => (i.section || '').toLowerCase() === section.toLowerCase()
      );
    }

    // Apply Search Filter
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      itemsList = itemsList.filter(
        (i) =>
          (i.code && i.code.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'profit_desc') {
      itemsList.sort((a, b) => b.profit - a.profit);
    } else if (sortBy === 'profit_asc') {
      itemsList.sort((a, b) => a.profit - b.profit);
    } else if (sortBy === 'value_desc') {
      itemsList.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'qty_desc') {
      itemsList.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === 'code_asc') {
      itemsList.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    } else if (sortBy === 'desc_asc') {
      itemsList.sort((a, b) => (a.description || '').localeCompare(b.description || ''));
    }

    // Compute Summary Stats directly from live database items
    const totalSales = itemsList.reduce((sum, i) => sum + (i.value || 0), 0);
    const totalCost = itemsList.reduce((sum, i) => sum + (i.purVal || 0), 0);
    const totalProfit = itemsList.reduce((sum, i) => sum + (i.profit || 0), 0);
    const profitMargin = totalSales > 0 ? Number(((totalProfit / totalSales) * 100).toFixed(2)) : 0;

    const materialsItems = itemsList.filter((i) => i.section === 'Materials');
    const serviceItems = itemsList.filter((i) => i.section === 'Servicing & Repairs');

    const materialsSales = materialsItems.reduce((sum, i) => sum + (i.value || 0), 0);
    const serviceSales = serviceItems.reduce((sum, i) => sum + (i.value || 0), 0);
    const materialsProfit = materialsItems.reduce((sum, i) => sum + (i.profit || 0), 0);
    const serviceProfit = serviceItems.reduce((sum, i) => sum + (i.profit || 0), 0);

    const totalRecords = itemsList.length;
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? itemsList : itemsList.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'daily_sales',
      reportTitle: 'DAILY SALES & PROFIT REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalSales: Number(totalSales.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2)),
        profitMargin,
        materialsSales: Number(materialsSales.toFixed(2)),
        serviceSales: Number(serviceSales.toFixed(2)),
        materialsProfit: Number(materialsProfit.toFixed(2)),
        serviceProfit: Number(serviceProfit.toFixed(2)),
        totalItemsCount: totalRecords,
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 5. INVOICE RETURNS REPORT
// =============================================================================
export const getInvoiceReturnsReport = async (req, res, next) => {
  try {
    const {
      startDate = '',
      endDate = '',
      staff = 'All',
      search = '',
      sortBy = 'default',
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit) === 0 ? 0 : Math.max(1, Number(limit) || 50);

    let returnItems = [];

    if (isDbConnected()) {
      try {
        const dateQuery = buildDateRangeQuery(startDate, endDate, 'date');

        // 1. Fetch from CustomerDamageReturn collection
        const custReturns = await CustomerDamageReturn.find(dateQuery).lean();
        custReturns.forEach((cdr) => {
          const rawDate = cdr.date || cdr.createdAt;
          const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '';
          const invDateStr = cdr.invoiceDate ? new Date(cdr.invoiceDate).toLocaleDateString('en-GB') : dateStr;
          const itm = cdr.returnedItem || {};
          const qty = Number(itm.returnedQuantity || 1);
          const unitPrice = Number(itm.unitPrice || 0);
          const val = Number(unitPrice * qty);

          returnItems.push({
            _id: cdr._id,
            returnNumber: cdr.returnNumber || 'CDR-GEN',
            invoiceNumber: cdr.invoiceNumber || 'INV-GEN',
            invoiceDate: invDateStr,
            customerName: cdr.customerName || 'Walk-in Customer',
            itemCode: itm.itemCode || itm.code || 'ITEM-GEN',
            description: itm.description || 'Returned Part',
            quantity: -Math.abs(qty),
            unitPrice,
            discount: 0,
            value: -Math.abs(val),
            returnDate: dateStr,
            rawDate: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '',
            staff: cdr.createdBy || cdr.staff || 'cashier',
            reason: itm.damageReason || itm.returnReason || cdr.remarks || 'Customer Return',
          });
        });

        // 2. Fetch from returnnotes collection
        const returnNotes = await mongoose.connection.db
          .collection('returnnotes')
          .find(dateQuery)
          .toArray();

        returnNotes.forEach((rn) => {
          const invNo = rn.originalInvoiceNo || rn.returnNo || 'RTN-GEN';
          const rawDate = rn.date || rn.createdAt;
          const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '';
          const invDateStr = rn.invoiceDate ? new Date(rn.invoiceDate).toLocaleDateString('en-GB') : dateStr;
          const cusName = rn.customerName || 'DAILY SALES';

          (rn.lineItems || []).forEach((li) => {
            const qty = Number(li.quantity || 1);
            const unitPrice = Number(li.unitPrice || li.rate || 0);
            const val = Number(li.value || (unitPrice * qty) || 0);
            returnItems.push({
              _id: li._id || rn._id,
              returnNumber: rn.returnNo || 'RTN-GEN',
              invoiceNumber: invNo,
              invoiceDate: invDateStr,
              customerName: cusName,
              itemCode: li.itemCode || li.code || 'ITEM-GEN',
              description: li.description || 'Returned Part',
              quantity: -Math.abs(qty),
              unitPrice,
              discount: Number(li.discount || 0),
              value: -Math.abs(val),
              returnDate: dateStr,
              rawDate: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '',
              staff: rn.staff || rn.createdBy || 'cashier',
              reason: li.reason || 'Customer Return',
            });
          });
        });

        // 3. Invoices with negative line item amounts or negative paidAmount
        const returnedInvoices = await Invoice.find({
          ...dateQuery,
          status: { $ne: 'cancelled' },
          $or: [{ 'lineItems.quantity': { $lt: 0 } }, { paidAmount: { $lt: 0 } }],
        }).lean();

        returnedInvoices.forEach((inv) => {
          const invNo = inv.invoiceNumber || String(inv.no);
          const rawDate = inv.date || inv.createdAt;
          const invDateStr = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '';
          const cusName = inv.customerName || inv.cusname || 'DAILY SALES';
          const invStaff = inv.cashier || inv.user || inv.createdBy || 'cashier';

          (inv.lineItems || []).forEach((li) => {
            if (li.quantity < 0 || (inv.paidAmount < 0 && li.total <= 0)) {
              returnItems.push({
                _id: li._id || `${inv._id}_${li.code}`,
                returnNumber: `INV-RET-${invNo}`,
                invoiceNumber: invNo,
                invoiceDate: invDateStr,
                customerName: cusName,
                itemCode: li.code || li.itemCode || 'ITEM-GEN',
                description: li.description || 'Returned Item',
                quantity: li.quantity < 0 ? li.quantity : -1,
                unitPrice: Number(li.unitPrice || 0),
                discount: Number(li.discount || li.discount1 || 0),
                value: li.total < 0 ? li.total : (inv.paidAmount < 0 ? inv.paidAmount : -li.total),
                returnDate: invDateStr,
                rawDate: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '',
                staff: invStaff,
                reason: 'Credit / Adjustment Refund',
              });
            }
          });
        });
      } catch (err) {
        console.warn('DB invoice returns query error:', err.message);
      }
    }

    // Apply Staff Filter
    if (staff && staff !== 'All') {
      returnItems = returnItems.filter(
        (i) => (i.staff || '').toLowerCase() === staff.toLowerCase()
      );
    }

    // Apply Search Filter
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      returnItems = returnItems.filter(
        (i) =>
          (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(q)) ||
          (i.customerName && i.customerName.toLowerCase().includes(q)) ||
          (i.itemCode && i.itemCode.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'value_desc') {
      returnItems.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    } else if (sortBy === 'qty_desc') {
      returnItems.sort((a, b) => Math.abs(b.quantity) - Math.abs(a.quantity));
    } else if (sortBy === 'date_desc') {
      returnItems.sort((a, b) => (b.rawDate || '').localeCompare(a.rawDate || ''));
    } else if (sortBy === 'inv_asc') {
      returnItems.sort((a, b) => (a.invoiceNumber || '').localeCompare(b.invoiceNumber || ''));
    }

    // Summary calculation directly from live return documents
    const totalReturnAmount = returnItems.reduce((sum, i) => sum + (i.value || 0), 0);
    const totalQuantity = returnItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const totalRecords = returnItems.length;
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? returnItems : returnItems.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'invoice_returns',
      reportTitle: 'INVOICE RETURNS REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalReturnAmount: Number(totalReturnAmount.toFixed(2)),
        totalReturnCount: totalRecords,
        totalItemsCount: totalRecords,
        totalQuantity: Math.abs(totalQuantity),
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 6. GOODS RECEIVED NOTES (GRN) REPORT
// =============================================================================
export const getGrnReport = async (req, res, next) => {
  try {
    const {
      startDate = '',
      endDate = '',
      supplier = 'All',
      user = 'All',
      search = '',
      sortBy = 'default',
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit) === 0 ? 0 : Math.max(1, Number(limit) || 50);

    let grnItems = [];

    if (isDbConnected()) {
      try {
        const dateQuery = buildDateRangeQuery(startDate, endDate, 'date');
        const grnDocs = await mongoose.connection.db
          .collection('grns')
          .find(dateQuery)
          .toArray();

        grnDocs.forEach((doc) => {
          const grnNo = doc.grnNumber || String(doc.no) || 'GRN-GEN';
          const rawDate = doc.date || doc.createdAt;
          const grnDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '';
          const supName = doc.supplierName || doc.supplier || doc.supplierCode || 'RAZA AUTO TRADERS';
          const payMethod = doc.paymentMethod || (doc.paidBy === 1 ? 'Cash' : 'Cheque');
          const invNo = doc.supplierInvoiceNo || doc.invoice || '';
          const userName = doc.user || doc.createdBy || 'PC004';

          (doc.lineItems || []).forEach((li) => {
            const qty = Number(li.quantity || li.qty || 1);
            const rate = Number(li.unitPrice || li.rate || 0);
            const disc = Number(li.discount || 0);
            const val = Number(li.totalValue || li.value || (rate * qty * (1 - disc / 100)));

            grnItems.push({
              _id: li._id || `${doc._id}_${li.code}`,
              grnId: doc._id,
              grnNumber: grnNo,
              date: grnDate,
              rawDate: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '',
              supplier: supName,
              supplierCode: doc.supplierCode || '',
              paidBy: payMethod,
              invoice: invNo,
              user: userName,
              code: li.code || li.itemCode || 'ITEM-GEN',
              description: li.description || 'Received Part',
              quantity: qty,
              returnQty: Number(li.returnQty || 0),
              rate,
              discount: disc,
              value: Number(val.toFixed(2)),
            });
          });
        });
      } catch (err) {
        console.warn('DB GRN query error:', err.message);
      }
    }

    // Filter by Supplier
    if (supplier && supplier !== 'All') {
      grnItems = grnItems.filter(
        (i) => String(i.supplier || '').toLowerCase() === String(supplier).toLowerCase()
      );
    }

    // Filter by User / Staff
    if (user && user !== 'All') {
      grnItems = grnItems.filter(
        (i) => String(i.user || '').toLowerCase() === String(user).toLowerCase()
      );
    }

    // Filter by Search Query
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      grnItems = grnItems.filter(
        (i) =>
          (i.code && i.code.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q)) ||
          (i.grnNumber && i.grnNumber.toLowerCase().includes(q)) ||
          (i.supplier && i.supplier.toLowerCase().includes(q)) ||
          (i.invoice && i.invoice.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'value_desc') {
      grnItems.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'value_asc') {
      grnItems.sort((a, b) => a.value - b.value);
    } else if (sortBy === 'qty_desc') {
      grnItems.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === 'most_received') {
      grnItems.sort((a, b) => b.quantity - a.quantity || b.value - a.value);
    } else if (sortBy === 'has_returns') {
      grnItems.sort((a, b) => (b.returnQty || 0) - (a.returnQty || 0));
    } else if (sortBy === 'code_asc') {
      grnItems.sort((a, b) => a.code.localeCompare(b.code));
    } else if (sortBy === 'desc_asc') {
      grnItems.sort((a, b) => a.description.localeCompare(b.description));
    }

    // Summary calculation directly from live GRN records
    const grandTotalValue = grnItems.reduce((sum, i) => sum + (i.value || 0), 0);
    const totalQuantity = grnItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const uniqueGrns = new Set(grnItems.map((i) => i.grnNumber));
    const uniqueSuppliers = new Set(grnItems.map((i) => i.supplier));

    const totalRecords = grnItems.length;
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? grnItems : grnItems.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'grn',
      reportTitle: 'GOODS RECEIVED NOTES (GRN) REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalGrns: uniqueGrns.size,
        totalItemsCount: totalRecords,
        totalQuantity,
        grandTotalValue: Number(grandTotalValue.toFixed(2)),
        totalSuppliers: uniqueSuppliers.size,
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 7. DAILY SETTLEMENTS DETAILS REPORT
// =============================================================================
export const getDailySettlementsReport = async (req, res, next) => {
  try {
    const {
      startDate = '',
      endDate = '',
      customer,
      paymentMethod,
      search,
      sortBy = 'default',
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) === 0 ? 0 : (parseInt(limit, 10) || 50);

    let settlements = [];

    if (isDbConnected()) {
      try {
        const dateQuery = buildDateRangeQuery(startDate, endDate, 'date');
        const dbSettlements = await mongoose.connection.db
          .collection('invoicesettlements')
          .find(dateQuery)
          .sort({ date: 1, _id: 1 })
          .toArray();

        settlements = dbSettlements.map((doc, idx) => {
          const rawDate = doc.date || doc.createdAt;
          const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '';
          const invVal = Number(doc.amount || doc.invValue || doc.total || 0);
          const methodStr = String(doc.method || doc.settlementType || 'Cash').toLowerCase();
          const isCheque = methodStr.includes('cheque');
          const isNeg = invVal < 0 || String(doc.customer || '').toLowerCase().includes('refund');
          const isAdvance = String(doc.customer || '').toUpperCase().includes('ADVANCE');

          return {
            _id: doc._id,
            inNo: doc.invoiceNo || doc.invoiceNumber || String(doc.no || 47550 + idx),
            jobNo: doc.jobNo !== undefined ? String(doc.jobNo) : String(idx + 1),
            date: dateStr,
            rawDate: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '',
            customer: doc.customer || doc.customerName || (isAdvance ? 'ADVANCE BILL' : 'DAILY SALES'),
            invValue: isNeg ? 0.0 : Math.abs(invVal),
            cash: isNeg ? invVal : (isCheque ? 0.0 : invVal),
            cheque: isCheque ? Math.abs(invVal) : 0.0,
            discount: Number(doc.specialDiscount || doc.discount || 0),
            balance: Number(doc.balance || doc.balanceAfter || 0),
            isNegative: isNeg,
            isAdvance: isAdvance,
            chequeNo: doc.chequeNo || '',
            bank: doc.bank || '',
            method: doc.method || doc.settlementType || (isCheque ? 'Cheque' : 'Cash'),
          };
        });
      } catch (dbErr) {
        console.warn('DB error reading settlements:', dbErr.message);
      }
    }

    // Filter by customer if specified
    if (customer && customer !== 'All') {
      const cLower = customer.toLowerCase();
      settlements = settlements.filter((s) => (s.customer || '').toLowerCase().includes(cLower));
    }

    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'All') {
      if (paymentMethod === 'cash') {
        settlements = settlements.filter((s) => s.cash > 0);
      } else if (paymentMethod === 'cheque') {
        settlements = settlements.filter((s) => s.cheque > 0);
      } else if (paymentMethod === 'negative' || paymentMethod === 'adjustment') {
        settlements = settlements.filter((s) => s.cash < 0 || s.isNegative);
      } else if (paymentMethod === 'advance') {
        settlements = settlements.filter((s) => s.isAdvance || s.customer === 'ADVANCE BILL');
      } else if (paymentMethod === 'named_customer') {
        settlements = settlements.filter((s) => s.customer !== 'DAILY SALES');
      }
    }

    // Filter by search query
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      settlements = settlements.filter(
        (s) =>
          (s.inNo || '').toLowerCase().includes(q) ||
          (s.customer || '').toLowerCase().includes(q) ||
          (s.jobNo || '').toLowerCase().includes(q) ||
          (s.date || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    switch (sortBy) {
      case 'inv_value_desc':
        settlements.sort((a, b) => b.invValue - a.invValue);
        break;
      case 'cash_desc':
        settlements.sort((a, b) => b.cash - a.cash);
        break;
      case 'cheque_desc':
        settlements.sort((a, b) => b.cheque - a.cheque);
        break;
      case 'negative_first':
        settlements.sort((a, b) => (a.cash < 0 ? -1 : 1) - (b.cash < 0 ? -1 : 1) || a.cash - b.cash);
        break;
      case 'in_no_asc':
        settlements.sort((a, b) => (a.inNo || '').localeCompare(b.inNo || ''));
        break;
      case 'date_desc':
        settlements.sort((a, b) => (b.rawDate || '').localeCompare(a.rawDate || ''));
        break;
      default:
        break;
    }

    // Calculate Summary Stats directly from database settlements
    const totalCash = settlements.reduce((sum, s) => sum + (s.cash || 0), 0);
    const totalCheque = settlements.reduce((sum, s) => sum + (s.cheque || 0), 0);
    const netTotal = totalCash + totalCheque;
    const totalDiscount = settlements.reduce((sum, s) => sum + (s.discount || 0), 0);
    const negativeCount = settlements.filter((s) => s.cash < 0 || s.isNegative).length;
    const chequeCount = settlements.filter((s) => s.cheque > 0).length;

    const totalRecords = settlements.length;
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedSettlements = limitNum === 0 ? settlements : settlements.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'daily_settlements',
      reportTitle: 'DAILY SETTLEMENTS DETAILS',
      company: COMPANY_HEADER,
      summary: {
        totalSettlements: totalRecords,
        totalCash: Number(totalCash.toFixed(2)),
        totalCheque: Number(totalCheque.toFixed(2)),
        netTotal: Number(netTotal.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        negativeCount,
        chequeCount,
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedSettlements,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 8. SUPPLIER WISE PURCHASES REPORT
// =============================================================================
export const getSupplierWisePurchasesReport = async (req, res, next) => {
  try {
    const {
      startDate = '',
      endDate = '',
      supplier = 'All',
      search = '',
      hasReturns = 'all',
      sortBy = 'default',
    } = req.query;

    let items = [];

    if (isDbConnected()) {
      try {
        const dateQuery = buildDateRangeQuery(startDate, endDate, 'date');

        const [grnDocs, supReturnDocs] = await Promise.all([
          mongoose.connection.db.collection('grns').find(dateQuery).toArray(),
          mongoose.connection.db.collection('supplierreturns').find(dateQuery).toArray(),
        ]);

        // Map supplier returns
        const returnMap = new Map();
        supReturnDocs.forEach((r) => {
          const sCode = r.supplierCode || 'SUP';
          const rVal = Number(r.returnTotal || 0);
          returnMap.set(sCode, (returnMap.get(sCode) || 0) + rVal);
        });

        grnDocs.forEach((doc) => {
          const rawNo = doc.grnNumber || doc.no || '0';
          const grnFormatted = String(rawNo);
          const d = doc.date ? new Date(doc.date) : new Date(doc.createdAt || Date.now());
          const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          const sCode = doc.supplierCode || doc.supplier || 'SUP';
          const sName = doc.supplierName || doc.supplier || 'SUPPLIER';
          const inv = doc.supplierInvoiceNo || doc.invoice || '';
          const val = Number(doc.grnValue || doc.totalValue || doc.value || 0);
          const ret = Number(doc.returnValue || returnMap.get(sCode) || 0);
          const tot = Number(doc.setValue || (val - ret));
          const disc = Number(doc.discount || 0);

          items.push({
            _id: doc._id,
            supplierCode: sCode,
            supplierName: sName,
            grnNo: grnFormatted,
            date: dateFormatted,
            invoice: inv,
            value: Number(val.toFixed(2)),
            returnVal: Number(ret.toFixed(2)),
            totalValue: Number(tot.toFixed(2)),
            discount: Number(disc.toFixed(2)),
          });
        });
      } catch (err) {
        console.warn('DB supplier purchases query error:', err.message);
      }
    }

    // Filter by Supplier
    if (supplier && supplier !== 'All') {
      const supQ = supplier.trim().toLowerCase();
      items = items.filter(
        (i) =>
          (i.supplierCode && i.supplierCode.toLowerCase() === supQ) ||
          (i.supplierName && i.supplierName.toLowerCase() === supQ)
      );
    }

    // Filter by Returns
    if (hasReturns === 'with_returns') {
      items = items.filter((i) => Number(i.returnVal || 0) > 0);
    } else if (hasReturns === 'no_returns') {
      items = items.filter((i) => Number(i.returnVal || 0) === 0);
    }

    // Filter by Search Query
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          (i.grnNo && i.grnNo.toLowerCase().includes(q)) ||
          (i.invoice && i.invoice.toLowerCase().includes(q)) ||
          (i.supplierCode && i.supplierCode.toLowerCase().includes(q)) ||
          (i.supplierName && i.supplierName.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'value_desc') {
      items.sort((a, b) => (b.value || 0) - (a.value || 0));
    } else if (sortBy === 'discount_desc') {
      items.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    } else if (sortBy === 'return_desc') {
      items.sort((a, b) => (b.returnVal || 0) - (a.returnVal || 0));
    } else if (sortBy === 'supplier_asc') {
      items.sort((a, b) => (a.supplierName || '').localeCompare(b.supplierName || ''));
    } else if (sortBy === 'grn_asc') {
      items.sort((a, b) => String(a.grnNo || '').localeCompare(String(b.grnNo || '')));
    }

    // Grouping by Supplier
    const supplierGroupsMap = new Map();
    items.forEach((item) => {
      const sKey = `${item.supplierCode} ${item.supplierName}`;
      if (!supplierGroupsMap.has(sKey)) {
        supplierGroupsMap.set(sKey, {
          supplierCode: item.supplierCode,
          supplierName: item.supplierName,
          items: [],
          subtotalValue: 0,
          subtotalReturn: 0,
          subtotalTotalValue: 0,
        });
      }
      const grp = supplierGroupsMap.get(sKey);
      grp.items.push(item);
      grp.subtotalValue += item.value || 0;
      grp.subtotalReturn += item.returnVal || 0;
      grp.subtotalTotalValue += item.totalValue || 0;
    });

    const supplierGroups = Array.from(supplierGroupsMap.values()).map((grp) => ({
      ...grp,
      subtotalValue: Number(grp.subtotalValue.toFixed(2)),
      subtotalReturn: Number(grp.subtotalReturn.toFixed(2)),
      subtotalTotalValue: Number(grp.subtotalTotalValue.toFixed(2)),
    }));

    // Summary calculation directly from database purchase records
    const grandTotalValue = items.reduce((sum, i) => sum + (i.value || 0), 0);
    const grandReturnVal = items.reduce((sum, i) => sum + (i.returnVal || 0), 0);
    const grandNetValue = items.reduce((sum, i) => sum + (i.totalValue || 0), 0);

    return res.status(200).json({
      success: true,
      reportType: 'supplier_purchases',
      reportTitle: 'Supplier Wise Purchases',
      company: COMPANY_HEADER,
      summary: {
        grandTotalValue: Number(grandTotalValue.toFixed(2)),
        grandReturnVal: Number(grandReturnVal.toFixed(2)),
        grandNetValue: Number(grandNetValue.toFixed(2)),
        totalGrnsCount: items.length,
        suppliersCount: supplierGroups.length,
      },
      supplierGroups,
      items,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 9. TOP SELLING ITEMS REPORT
// =============================================================================
export const getTopSellingItemsReport = async (req, res, next) => {
  try {
    const {
      search = '',
      minQty = '0',
      sortBy = 'total_desc',
      page = 1,
      limit = 33,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit) === 0 ? 0 : Math.max(1, Number(limit) || 33);

    let items = [];

    if (isDbConnected()) {
      try {
        const invoices = await Invoice.find(
          { status: { $ne: 'cancelled' } },
          { lineItems: 1, date: 1, createdAt: 1 }
        ).lean();

        const salesMap = new Map();

        invoices.forEach((inv) => {
          const invDate = inv.date ? new Date(inv.date) : (inv.createdAt ? new Date(inv.createdAt) : null);
          const monthNum = invDate ? invDate.getMonth() + 1 : 8; // 1-12

          (inv.lineItems || []).forEach((li) => {
            const code = String(li.code || li.itemCode || '').trim();
            if (!code) return;
            const desc = String(li.description || '').trim();
            const qty = Number(li.quantity || li.qty || 1);
            const val = Number(li.total || (li.unitPrice * qty) || 0);

            if (!salesMap.has(code)) {
              salesMap.set(code, {
                code,
                description: desc,
                m05_qty: 0,
                m06_qty: 0,
                m07_qty: 0,
                m08_qty: 0,
                total_qty: 0,
                total_revenue: 0,
                invoice_count: 0,
              });
            }

            const s = salesMap.get(code);
            s.total_qty += qty;
            s.total_revenue += val;
            s.invoice_count += 1;
            if (!s.description && desc) s.description = desc;

            if (monthNum === 5) s.m05_qty += qty;
            else if (monthNum === 6) s.m06_qty += qty;
            else if (monthNum === 7) s.m07_qty += qty;
            else s.m08_qty += qty;
          });
        });

        // Enrich with item master descriptions if needed
        const itemCodes = Array.from(salesMap.keys());
        const masterItems = await Item.find({ code: { $in: itemCodes } }, { code: 1, description: 1 }).lean();
        masterItems.forEach((mi) => {
          if (salesMap.has(mi.code) && mi.description) {
            salesMap.get(mi.code).description = mi.description;
          }
        });

        items = Array.from(salesMap.values());
      } catch (err) {
        console.warn('DB top selling query error:', err.message);
      }
    }

    // Apply Min Qty Filter
    const minQ = Number(minQty) || 0;
    if (minQ > 0) {
      items = items.filter((i) => (i.total_qty || 0) >= minQ);
    }

    // Apply Search Filter
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          (i.code && i.code.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'total_desc') {
      items.sort((a, b) => (b.total_qty || 0) - (a.total_qty || 0));
    } else if (sortBy === 'total_asc') {
      items.sort((a, b) => (a.total_qty || 0) - (b.total_qty || 0));
    } else if (sortBy === 'revenue_desc') {
      items.sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
    } else if (sortBy === 'm05_desc') {
      items.sort((a, b) => (b.m05_qty || 0) - (a.m05_qty || 0));
    } else if (sortBy === 'm06_desc') {
      items.sort((a, b) => (b.m06_qty || 0) - (a.m06_qty || 0));
    } else if (sortBy === 'm07_desc') {
      items.sort((a, b) => (b.m07_qty || 0) - (a.m07_qty || 0));
    } else if (sortBy === 'm08_desc') {
      items.sort((a, b) => (b.m08_qty || 0) - (a.m08_qty || 0));
    } else if (sortBy === 'code_asc') {
      items.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    } else if (sortBy === 'desc_asc') {
      items.sort((a, b) => (a.description || '').localeCompare(b.description || ''));
    }

    // Summary calculation directly from database aggregated sales
    const totalQty = items.reduce((sum, i) => sum + (i.total_qty || 0), 0);
    const m05_total = items.reduce((sum, i) => sum + (i.m05_qty || 0), 0);
    const m06_total = items.reduce((sum, i) => sum + (i.m06_qty || 0), 0);
    const m07_total = items.reduce((sum, i) => sum + (i.m07_qty || 0), 0);
    const m08_total = items.reduce((sum, i) => sum + (i.m08_qty || 0), 0);
    const topItem = items.length > 0 ? [...items].sort((a, b) => b.total_qty - a.total_qty)[0] : null;

    const totalRecords = items.length;
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? items : items.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'top_selling',
      reportTitle: 'TOP SELLING ITEMS REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalQty,
        m05_total,
        m06_total,
        m07_total,
        m08_total,
        totalItemsCount: totalRecords,
        topProduct: topItem ? `${topItem.code} - ${topItem.description} (${topItem.total_qty} Units)` : 'N/A',
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 10. NON MOVING INVENTORY REPORT
// =============================================================================
export const getNonMovingReport = async (req, res, next) => {
  try {
    const {
      category = 'All',
      search = '',
      minValue = '0',
      sortBy = 'default',
      page = 1,
      limit = 50,
    } = req.query;

    let items = [];

    if (isDbConnected()) {
      try {
        const query = {};
        if (category && category !== 'All') {
          query.category = category;
        }

        if (search && search.trim()) {
          const q = search.trim();
          query.$or = [
            { code: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
          ];
        }

        const minValNum = parseFloat(minValue) || 0;
        if (minValNum > 0) {
          query.value = { $gte: minValNum };
        }

        const dbItems = await mongoose.connection.db
          .collection('nonmovingitems')
          .find(query)
          .toArray();

        items = dbItems.map((doc) => ({
          _id: doc._id,
          category: doc.category || '2W',
          code: doc.code,
          description: doc.description,
          quantity: Number(doc.quantity || 0),
          value: Number(doc.value || 0),
        }));
      } catch (err) {
        console.warn('DB non moving items query error:', err.message);
      }
    }

    // Sorting
    if (sortBy === 'value_desc') {
      items.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'value_asc') {
      items.sort((a, b) => a.value - b.value);
    } else if (sortBy === 'qty_desc') {
      items.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === 'code_asc') {
      items.sort((a, b) => a.code.localeCompare(b.code));
    } else if (sortBy === 'desc_asc') {
      items.sort((a, b) => a.description.localeCompare(b.description));
    }

    // Summary calculation directly from live non-moving items in DB
    const grandTotalValue = items.reduce((sum, it) => sum + (it.value || 0), 0);
    const catMap = new Map();
    items.forEach((it) => {
      catMap.set(it.category, (catMap.get(it.category) || 0) + (it.value || 0));
    });

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([cat, subtotal]) => ({ category: cat, subtotal: Number(subtotal.toFixed(2)) }))
      .sort((a, b) => b.subtotal - a.subtotal);

    const highestCategory = categoryBreakdown[0] || { category: 'N/A', subtotal: 0 };
    const secondCategory = categoryBreakdown[1] || { category: 'N/A', subtotal: 0 };
    const topProductItem = [...items].sort((a, b) => b.value - a.value)[0];

    const totalRecords = items.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) === 0 ? 0 : (parseInt(limit, 10) || 50);
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? items : items.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Group items by category for paper layout
    const groupedByCategory = {};
    paginatedItems.forEach((it) => {
      if (!groupedByCategory[it.category]) {
        groupedByCategory[it.category] = [];
      }
      groupedByCategory[it.category].push(it);
    });

    return res.status(200).json({
      success: true,
      reportType: 'non_moving',
      reportTitle: 'NON MOVING REPORT',
      company: COMPANY_HEADER,
      summary: {
        grandTotalValue: Number(grandTotalValue.toFixed(2)),
        totalItemsCount: totalRecords,
        categoriesCount: categoryBreakdown.length,
        categoryBreakdown,
        highestCategory,
        secondCategory,
        topProduct: topProductItem ? `${topProductItem.code} - ${topProductItem.description} (Rs. ${topProductItem.value.toLocaleString()})` : 'N/A',
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      groupedData: groupedByCategory,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 11. GOODS RETURN NOTES (G.RE.N) REPORT
// =============================================================================
export const getGoodsReturnNotes = async (req, res, next) => {
  try {
    const {
      startDate = '',
      endDate = '',
      supplier = 'All',
      grenNumber = 'All',
      search = '',
      sortBy = 'default',
    } = req.query;

    let notes = [];

    if (isDbConnected()) {
      try {
        const dateQuery = buildDateRangeQuery(startDate, endDate, 'date');
        const returnDocs = await mongoose.connection.db
          .collection('supplierreturns')
          .find(dateQuery)
          .sort({ date: -1, no: -1 })
          .toArray();

        notes = returnDocs.map((doc) => {
          const rawDate = doc.date ? new Date(doc.date).toISOString().slice(0, 10) : '';
          const dateFormatted = doc.date ? new Date(doc.date).toLocaleDateString('en-GB') : '';

          const items = (doc.lineItems || []).map((li, idx) => ({
            no: li.no || idx + 1,
            code: li.code || li.itemCode || 'ITEM-GEN',
            description: li.description || 'Returned Part',
            quantity: Number(li.quantity || li.qty || 1),
            rate: Number(li.unitPrice || li.rate || 0),
            discount: Number(li.discount || 0),
            value: Number(li.totalValue || li.value || 0),
          }));

          const subTotal = Number(doc.returnTotal || items.reduce((sum, it) => sum + it.value, 0));

          return {
            _id: doc._id,
            grenNumber: doc.returnNumber || `GREN-${doc.no || 0}`,
            no: doc.no,
            date: dateFormatted,
            rawDate,
            time: doc.time || '10:00:00 AM',
            userCode: doc.userCode || 'PC004',
            supplierCode: doc.supplierCode || 'SUP',
            supplierName: doc.supplierName || 'SUPPLIER',
            items,
            subTotal: Number(subTotal.toFixed(2)),
          };
        });
      } catch (err) {
        console.warn('DB goods return notes query error:', err.message);
      }
    }

    // Filter by supplier
    if (supplier && supplier !== 'All') {
      notes = notes.filter(
        (n) =>
          n.supplierCode.toLowerCase() === supplier.toLowerCase() ||
          n.supplierName.toLowerCase() === supplier.toLowerCase()
      );
    }

    // Filter by G.RE.N number
    if (grenNumber && grenNumber !== 'All') {
      notes = notes.filter((n) => n.grenNumber === grenNumber);
    }

    // Filter by search query (item code or description or grenNumber)
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      notes = notes
        .map((note) => ({
          ...note,
          items: note.items.filter(
            (it) =>
              it.code.toLowerCase().includes(q) ||
              it.description.toLowerCase().includes(q) ||
              note.grenNumber.toLowerCase().includes(q)
          ),
        }))
        .filter((note) => note.items.length > 0);

      // Recalculate note subtotals based on filtered items
      notes.forEach((note) => {
        note.subTotal = Number(note.items.reduce((sum, it) => sum + it.value, 0).toFixed(2));
      });
    }

    // Flatten items for modern table view
    let flatItems = [];
    notes.forEach((note) => {
      note.items.forEach((it) => {
        flatItems.push({
          grenNumber: note.grenNumber,
          date: note.date,
          supplierCode: note.supplierCode,
          supplierName: note.supplierName,
          ...it,
        });
      });
    });

    // Sort flat items if requested
    if (sortBy === 'value_desc') {
      flatItems.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'value_asc') {
      flatItems.sort((a, b) => a.value - b.value);
    } else if (sortBy === 'qty_desc') {
      flatItems.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === 'date_desc') {
      flatItems.sort((a, b) => b.date.localeCompare(a.date));
    } else if (sortBy === 'code_asc') {
      flatItems.sort((a, b) => a.code.localeCompare(b.code));
    }

    const grandTotal = notes.reduce((sum, n) => sum + (n.subTotal || 0), 0);
    const totalQty = flatItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const primarySupplier = notes.length > 0 ? notes[0].supplierName : 'N/A';
    const highestNote = [...notes].sort((a, b) => b.subTotal - a.subTotal)[0] || { grenNumber: 'N/A', subTotal: 0 };

    return res.status(200).json({
      success: true,
      reportType: 'goods_return_notes',
      reportTitle: 'Goods Return Notes',
      company: COMPANY_HEADER,
      summary: {
        totalNotes: notes.length,
        totalItemsCount: flatItems.length,
        totalQuantity: totalQty,
        grandTotalValue: Number(grandTotal.toFixed(2)),
        primarySupplier,
        highestNote: { grenNumber: highestNote.grenNumber, subTotal: highestNote.subTotal },
      },
      notes,
      flatItems,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};
