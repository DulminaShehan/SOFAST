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
          if (li.jobType === 'Labour' || li.type === 'Labour' || li.isService) return;
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

    // Group paginated items by category for the PDF paper report view
    const groupedMap = new Map();
    paginatedItems.forEach((item) => {
      const cat = item.category || 'GENERAL';
      if (!groupedMap.has(cat)) {
        groupedMap.set(cat, {
          categoryName: cat,
          items: [],
          subtotalQty: 0,
          subtotalValue: 0,
        });
      }
      const g = groupedMap.get(cat);
      g.items.push(item);
      g.subtotalQty += Number(item.quantity) || 0;
      g.subtotalValue += Number(item.value) || 0;
    });

    const grouped = Array.from(groupedMap.values()).map((g) => ({
      ...g,
      subtotalQty: Math.round(g.subtotalQty * 100) / 100,
      subtotalValue: Math.round(g.subtotalValue * 100) / 100,
    }));

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
      grouped,
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
    let supplierMasterList = [];
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

        const supDocs = await Supplier.find({}, { code: 1, name: 1 }).lean();
        const supNames = (supDocs || []).map((s) => s.name).filter(Boolean);
        const grnSups = await Grn.distinct('supplier');
        const grnSupNames = await Grn.distinct('supplierName');
        const srSupCodes = await mongoose.connection.db.collection('supplierreturns').distinct('supplierCode');
        const srSupNames = await mongoose.connection.db.collection('supplierreturns').distinct('supplierName');
        suppliersList = [...new Set([...supNames, ...(grnSups || []), ...(grnSupNames || []), ...(srSupCodes || []), ...(srSupNames || [])])].filter(Boolean).sort();
        supplierMasterList = (supDocs || []).map((s) => ({ code: s.code, name: s.name }));
        const existingCodes = new Set(supplierMasterList.map((s) => String(s.code).toUpperCase()));
        (srSupCodes || []).forEach((code) => {
          if (code && !existingCodes.has(String(code).toUpperCase())) {
            supplierMasterList.push({ code: String(code), name: String(code) });
            existingCodes.add(String(code).toUpperCase());
          }
        });

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
      supplierMaster: supplierMasterList || [],
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
        const createdQuery = buildDateRangeQuery(startDate, endDate, 'createdAt');
        const combinedDateQuery = Object.keys(dateQuery).length === 0 ? {} : {
          $or: [dateQuery, createdQuery]
        };

        // 1. Fetch from CustomerDamageReturn collection
        const custReturns = await CustomerDamageReturn.find(combinedDateQuery).lean();
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
          .find(combinedDateQuery)
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
          ...combinedDateQuery,
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

    // Group return items by invoiceNumber for the PDF paper report view
    const groupMap = new Map();
    paginatedItems.forEach((item) => {
      const invNo = item.invoiceNumber || 'INV-GENERAL';
      if (!groupMap.has(invNo)) {
        groupMap.set(invNo, {
          invoiceNumber: invNo,
          invoiceDate: item.invoiceDate || item.returnDate || '',
          customerName: item.customerName || 'CUSTOMER',
          items: [],
          subTotal: 0,
        });
      }
      const grp = groupMap.get(invNo);
      grp.items.push(item);
      grp.subTotal += Number(item.value || 0);
    });

    const invoiceGroups = Array.from(groupMap.values()).map((grp) => ({
      ...grp,
      subTotal: Number(grp.subTotal.toFixed(2)),
    }));

    const topItem = [...returnItems].sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0))[0];

    return res.status(200).json({
      success: true,
      reportType: 'invoice_returns',
      reportTitle: 'INVOICE RETURNS REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalReturnAmount: Number(totalReturnAmount.toFixed(2)),
        totalRefundValue: Number(totalReturnAmount.toFixed(2)),
        totalReturnedQty: Math.abs(totalQuantity),
        totalReturnCount: totalRecords,
        totalItemsCount: totalRecords,
        itemsCount: totalRecords,
        invoiceCount: invoiceGroups.length,
        invoicesList: invoiceGroups.map((g) => g.invoiceNumber).slice(0, 5).join(', '),
        topReturnedItem: topItem ? `${topItem.description} (${topItem.itemCode})` : 'None',
        topReturnedValue: topItem ? topItem.value : 0,
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      invoiceGroups,
      reportPeriod: startDate && endDate ? `For the period of ${startDate} to ${endDate}` : 'All Recorded Dates',
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
      fromDate = '',
      toDate = '',
      grnNumber = '',
      grnNo = '',
      supplier = 'All',
      user = 'All',
      search = '',
      sortBy = 'default',
      page = 1,
      limit = 50,
    } = req.query;

    const start = (startDate || fromDate || '').trim();
    const end = (endDate || toDate || '').trim();
    const grnNumQuery = (grnNumber || grnNo || '').trim();

    // Validate that From Date is not later than To Date
    if (start && end) {
      const dStart = new Date(start);
      const dEnd = new Date(end);
      if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime()) && dStart > dEnd) {
        return res.status(400).json({
          success: false,
          message: 'From Date cannot be later than To Date. Please correct the selected date range.',
        });
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit) === 0 ? 0 : Math.max(1, Number(limit) || 50);

    let allGrnRecords = [];

    if (isDbConnected()) {
      try {
        // Build comprehensive map of Supplier Master for code, cleanCode, ID, and name resolution
        const supDocs = await Supplier.find({}, { code: 1, name: 1 }).lean();
        const supCodeToName = new Map();
        const supCleanCodeToName = new Map();
        const supNameToCode = new Map();
        const supIdToCode = new Map();
        const supIdToName = new Map();
        const masterSuppliers = [];

        (supDocs || []).forEach((s) => {
          const sId = String(s._id);
          const sCode = s.code ? String(s.code).trim() : '';
          const sName = s.name ? String(s.name).trim() : '';
          const sClean = sCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

          masterSuppliers.push({ id: sId, code: sCode, cleanCode: sClean, name: sName });

          if (sCode) {
            supCodeToName.set(sCode.toUpperCase(), sName);
            supCodeToName.set(sCode.toLowerCase(), sName);
          }
          if (sClean) {
            supCleanCodeToName.set(sClean, sName);
          }
          if (sName) {
            supNameToCode.set(sName.toUpperCase(), sCode);
            supNameToCode.set(sName.toLowerCase(), sCode);
          }
          if (sId) {
            supIdToCode.set(sId, sCode);
            supIdToName.set(sId, sName);
          }
        });

        // 1. Fetch GRNs using receipt date query
        const dateQuery = buildDateRangeQuery(start, end, 'date');
        const grnDocs = await mongoose.connection.db
          .collection('grns')
          .find(dateQuery)
          .sort({ date: -1, createdAt: -1 })
          .toArray();

        allGrnRecords = grnDocs.map((doc) => {
          const rawCode = String(doc.supplierCode || doc.supplier || '').trim();
          const cleanCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const rawUpper = rawCode.toUpperCase();

          // Resolve accurate supplier code and name without fake fallbacks
          const resolvedName =
            (doc.supplierName && String(doc.supplierName).trim()) ||
            supCodeToName.get(rawUpper) ||
            supCleanCodeToName.get(cleanCode) ||
            supIdToName.get(rawCode) ||
            (supNameToCode.has(rawUpper) ? doc.supplier : null) ||
            rawCode ||
            'Unknown Supplier';

          const resolvedCode =
            (doc.supplierCode && String(doc.supplierCode).trim()) ||
            supNameToCode.get(resolvedName.toUpperCase()) ||
            supIdToCode.get(rawCode) ||
            rawCode ||
            '—';

          const grnNoStr = doc.grnNumber !== undefined && doc.grnNumber !== null && String(doc.grnNumber).trim() !== ''
            ? String(doc.grnNumber).trim()
            : doc.no !== undefined && doc.no !== null
            ? String(doc.no)
            : 'GRN-GEN';

          const rawDate = doc.date || doc.createdAt;
          const grnDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '';
          const isoDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';
          const payMethod =
            doc.paymentMethod ||
            (doc.paidBy === 1 ? 'Cash' : doc.paidBy === 2 ? 'Cheque' : String(doc.paidBy || 'Cash'));
          const invNo = doc.supplierInvoiceNo || doc.invoice || '';
          const userName = doc.user || doc.createdBy || 'PC004';
          const location = doc.location || doc.lineItems?.[0]?.locationCode || 'Main Store';
          const statusStr = doc.status || (doc.isPosted !== false ? 'Posted' : 'Pending');

          let totalQty = 0;
          let totalDiscVal = 0;
          let computedVal = 0;

          const lineItems = (doc.lineItems || []).map((li, idx) => {
            const qty = Number(li.quantity !== undefined ? li.quantity : li.qty || 0);
            const rate = Number(li.unitPrice !== undefined ? li.unitPrice : li.rate || 0);
            const disc = Number(li.discount || 0);
            const val = Number(
              li.totalValue !== undefined && li.totalValue !== null
                ? li.totalValue
                : li.value !== undefined && li.value !== null
                ? li.value
                : rate * qty * (1 - disc / 100)
            );
            const sellPrice = Number(li.sellingPrice || 0);
            const itemLoc = li.locationCode || li.location || location;

            totalQty += qty;
            if (disc > 0) {
              totalDiscVal += (rate * qty * disc) / 100;
            }
            computedVal += val;

            return {
              _id: li._id ? String(li._id) : `${doc._id}_${idx}`,
              grnNumber: grnNoStr,
              grnDate,
              date: grnDate,
              rawDate: isoDate,
              supplierCode: resolvedCode,
              supplierName: resolvedName,
              supplierInvoiceNo: invNo,
              code: li.code || li.itemCode || 'ITEM-GEN',
              itemCode: li.itemCode || li.code || 'ITEM-GEN',
              description: li.description || '',
              quantity: qty,
              receivedQuantity: qty,
              returnQty: Number(li.returnQty || 0),
              unitPrice: rate,
              purchasePrice: rate,
              rate,
              sellingPrice: sellPrice,
              discount: disc,
              totalValue: Number(val.toFixed(2)),
              lineValue: Number(val.toFixed(2)),
              value: Number(val.toFixed(2)),
              location: itemLoc,
              locationCode: itemLoc,
            };
          });

          const finalVal = Number(
            doc.grnValue !== undefined && doc.grnValue !== null
              ? doc.grnValue
              : doc.totalValue !== undefined && doc.totalValue !== null
              ? doc.totalValue
              : computedVal
          );

          return {
            _id: String(doc._id),
            grnId: doc._id,
            grnNumber: grnNoStr,
            no: doc.no !== undefined ? doc.no : null,
            date: grnDate,
            rawDate: isoDate,
            supplierCode: resolvedCode,
            supplierName: resolvedName,
            supplier: resolvedName,
            supplierInvoiceNo: invNo,
            invoice: invNo,
            paymentMethod: payMethod,
            paidBy: payMethod,
            totalQuantity: totalQty,
            totalDiscount: Number(totalDiscVal.toFixed(2)),
            totalValue: Number(finalVal.toFixed(2)),
            status: statusStr,
            isPosted: doc.isPosted !== false,
            location,
            user: userName,
            remark: doc.remark || '',
            itemsCount: lineItems.length,
            lineItems,
          };
        });
      } catch (err) {
        console.warn('DB GRN query error:', err.message);
      }
    }

    // 2. Filter by GRN Number (exact and partial, ranking exact matches first)
    if (grnNumQuery) {
      const q = grnNumQuery.toLowerCase();
      const qClean = q.replace(/^grn-?0*/i, '');

      allGrnRecords = allGrnRecords
        .map((g) => {
          const numStr = String(g.grnNumber || '').toLowerCase();
          const noStr = g.no !== null && g.no !== undefined ? String(g.no) : '';
          const numClean = numStr.replace(/^grn-?0*/i, '');
          const invStr = String(g.supplierInvoiceNo || '').toLowerCase();

          let matchScore = 0;
          if (numStr === q || noStr === q) {
            matchScore = 100; // Exact match on GRN Number or Sequence
          } else if (qClean && numClean === qClean) {
            matchScore = 90; // Normalized exact match (e.g. "6" vs "GRN-0006")
          } else if (numStr.startsWith(q) || (qClean && numClean.startsWith(qClean))) {
            matchScore = 70; // Prefix match
          } else if (numStr.includes(q) || noStr.includes(q)) {
            matchScore = 50; // Partial substring in GRN Number
          } else if (invStr && invStr.includes(q)) {
            matchScore = 30; // Partial match in supplier invoice #
          }

          return { record: g, matchScore };
        })
        .filter((item) => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .map((item) => item.record);
    }

    // 3. Filter by Supplier (Code or Name, matching Supplier Master reliably)
    if (supplier && supplier !== 'All') {
      const supQuery = String(supplier).trim().toLowerCase();
      const cleanSupQuery = supQuery.replace(/[^a-zA-Z0-9]/g, '');

      allGrnRecords = allGrnRecords.filter((g) => {
        const sCode = String(g.supplierCode || '').toLowerCase();
        const sCleanCode = sCode.replace(/[^a-zA-Z0-9]/g, '');
        const sName = String(g.supplierName || '').toLowerCase();

        return (
          sCode === supQuery ||
          sCleanCode === cleanSupQuery ||
          sName === supQuery ||
          (cleanSupQuery && sCleanCode.includes(cleanSupQuery)) ||
          sCode.includes(supQuery) ||
          sName.includes(supQuery)
        );
      });
    }

    // 4. Filter by User / Staff
    if (user && user !== 'All') {
      allGrnRecords = allGrnRecords.filter(
        (g) => String(g.user || '').toLowerCase() === String(user).toLowerCase()
      );
    }

    // 5. General Search (Matches GRN number, supplier code, supplier name, invoice, or line item code/desc)
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      allGrnRecords = allGrnRecords.filter((g) => {
        const matchesHeader =
          String(g.grnNumber || '').toLowerCase().includes(q) ||
          String(g.supplierCode || '').toLowerCase().includes(q) ||
          String(g.supplierName || '').toLowerCase().includes(q) ||
          String(g.supplierInvoiceNo || '').toLowerCase().includes(q) ||
          String(g.paymentMethod || '').toLowerCase().includes(q) ||
          String(g.status || '').toLowerCase().includes(q);

        if (matchesHeader) return true;

        // Check line items
        return (g.lineItems || []).some(
          (li) =>
            String(li.code || '').toLowerCase().includes(q) ||
            String(li.description || '').toLowerCase().includes(q)
        );
      });
    }

    // 6. Sorting (Preserve priority ranking when grnNumQuery is present, unless user explicitly changes sortBy)
    if (sortBy === 'value_desc') {
      allGrnRecords.sort((a, b) => b.totalValue - a.totalValue);
    } else if (sortBy === 'value_asc') {
      allGrnRecords.sort((a, b) => a.totalValue - b.totalValue);
    } else if (sortBy === 'qty_desc') {
      allGrnRecords.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } else if (sortBy === 'qty_asc') {
      allGrnRecords.sort((a, b) => a.totalQuantity - b.totalQuantity);
    } else if (sortBy === 'grn_asc') {
      allGrnRecords.sort((a, b) => String(a.grnNumber).localeCompare(String(b.grnNumber), undefined, { numeric: true }));
    } else if (sortBy === 'grn_desc') {
      allGrnRecords.sort((a, b) => String(b.grnNumber).localeCompare(String(a.grnNumber), undefined, { numeric: true }));
    } else if (sortBy === 'supplier_asc') {
      allGrnRecords.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    } else if (sortBy === 'date_asc') {
      allGrnRecords.sort((a, b) => new Date(a.rawDate || 0) - new Date(b.rawDate || 0));
    } else if (!grnNumQuery) {
      // default: date descending (latest first)
      allGrnRecords.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0) || (b.no || 0) - (a.no || 0));
    }

    // 7. Accurate Summary Calculation from filtered results
    // Exclude cancelled / reversed GRNs from posted totals while preserving them in historical display
    const postedRecords = allGrnRecords.filter(
      (g) => !['cancelled', 'reversed'].includes(String(g.status || '').toLowerCase())
    );

    const grandTotalValue = postedRecords.reduce((sum, g) => sum + (g.totalValue || 0), 0);
    const totalQuantity = postedRecords.reduce((sum, g) => sum + (g.totalQuantity || 0), 0);
    const totalDiscount = postedRecords.reduce((sum, g) => sum + (g.totalDiscount || 0), 0);
    const uniqueSuppliers = new Set(allGrnRecords.map((g) => g.supplierName || g.supplierCode));
    const totalCancelled = allGrnRecords.length - postedRecords.length;

    // 8. Pagination
    const totalRecords = allGrnRecords.length;
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? allGrnRecords : allGrnRecords.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'grn',
      reportTitle: 'GOODS RECEIVED NOTES (GRN) REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalGrns: totalRecords,
        matchingGrnsCount: totalRecords,
        totalQuantity,
        totalDiscount: Number(totalDiscount.toFixed(2)),
        grandTotalValue: Number(grandTotalValue.toFixed(2)),
        totalCancelled,
        totalSuppliers: uniqueSuppliers.size,
      },
      pagination: {
        totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      data: paginatedItems,
      dateRange: {
        from: start || '',
        to: end || '',
      },
      filters: {
        grnNumber: grnNumQuery,
        supplier: supplier || 'All',
        startDate: start,
        endDate: end,
        search,
      },
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
      fromDate = '',
      toDate = '',
      supplier = 'All',
      grenNumber = '',
      returnNumber = '',
      grenNo = '',
      search = '',
      sortBy = 'default',
      page = 1,
      limit = 50,
    } = req.query;

    const start = (startDate || fromDate || '').trim();
    const end = (endDate || toDate || '').trim();
    const grenNumQuery = (grenNumber || returnNumber || grenNo || '').trim();

    // Validate that From Date is not later than To Date
    if (start && end) {
      const dStart = new Date(start);
      const dEnd = new Date(end);
      if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime()) && dStart > dEnd) {
        return res.status(400).json({
          success: false,
          message: 'From Date cannot be later than To Date. Please correct the selected date range.',
        });
      }
    }

    let allReturnRecords = [];

    if (isDbConnected()) {
      try {
        // 1. Build map of Supplier Master for code-to-name and name-to-code resolution
        const supDocs = await Supplier.find({}, { code: 1, name: 1 }).lean();
        const supMap = new Map();
        (supDocs || []).forEach((s) => {
          if (s.code) {
            supMap.set(String(s.code).trim().toUpperCase(), s.name);
            supMap.set(String(s.code).trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), s.name);
          }
          if (s.name) {
            supMap.set(String(s.name).trim().toUpperCase(), s.name);
          }
        });

        // 2. Query supplierreturns from DB
        const dateQuery = buildDateRangeQuery(start, end, 'date');
        const returnDocs = await mongoose.connection.db
          .collection('supplierreturns')
          .find(dateQuery)
          .sort({ date: -1, no: -1, createdAt: -1 })
          .toArray();

        // 3. Collect linked GRN references to look up original GRN numbers and supplier invoices
        const grnRefs = new Set();
        returnDocs.forEach((d) => {
          const ref = String(d.grnReference || d.grnNumber || '').trim();
          if (ref && ref !== 'undefined') grnRefs.add(ref);
        });

        const grnQueries = [];
        if (grnRefs.size > 0) {
          const refArr = Array.from(grnRefs);
          grnQueries.push({ grnNumber: { $in: refArr } });
          const numericRefs = refArr.filter((r) => !isNaN(Number(r))).map((r) => ({ no: Number(r) }));
          if (numericRefs.length > 0) {
            grnQueries.push(...numericRefs);
          }
        }

        const grnDocs =
          grnQueries.length > 0
            ? await Grn.find(
                { $or: grnQueries },
                { grnNumber: 1, no: 1, supplierInvoiceNo: 1, invoice: 1, supplierCode: 1, supplierName: 1 }
              ).lean()
            : [];

        const grnMap = new Map();
        grnDocs.forEach((g) => {
          if (g.grnNumber) grnMap.set(String(g.grnNumber).trim().toLowerCase(), g);
          if (g.no !== undefined && g.no !== null) grnMap.set(String(g.no).trim().toLowerCase(), g);
        });

        // 4. Map each return document
        allReturnRecords = returnDocs.map((doc) => {
          const rawCode = String(doc.supplierCode || '').trim();
          const cleanCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const resolvedName =
            doc.supplierName ||
            supMap.get(cleanCode) ||
            supMap.get(rawCode.toUpperCase()) ||
            rawCode ||
            'RAZA AUTO TRADERS';

          const rawDate = doc.date || doc.createdAt;
          const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('en-GB') : '';
          const isoDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';

          const rawRef = String(doc.grnReference || doc.grnNumber || '').trim();
          const linkedGrn = rawRef ? grnMap.get(rawRef.toLowerCase()) : null;
          const origGrn =
            (rawRef && rawRef !== 'undefined'
              ? rawRef
              : linkedGrn
              ? linkedGrn.grnNumber || String(linkedGrn.no)
              : '') || '—';
          const invNo =
            doc.supplierInvoiceNo ||
            doc.invoice ||
            (linkedGrn ? linkedGrn.supplierInvoiceNo || linkedGrn.invoice : '') ||
            '—';

          const grenNoStr =
            doc.returnNumber && doc.returnNumber !== 'undefined'
              ? String(doc.returnNumber)
              : doc.grenNumber && doc.grenNumber !== 'undefined'
              ? String(doc.grenNumber)
              : doc.no !== undefined && doc.no !== null
              ? String(doc.no).startsWith('GREN')
                ? String(doc.no)
                : `GREN-${doc.no}`
              : 'GREN';

          const statusStr =
            doc.status === 'deleted'
              ? 'Deleted'
              : doc.status === 'cancelled'
              ? 'Cancelled'
              : doc.status === 'reversed'
              ? 'Reversed'
              : doc.isPosted !== false
              ? 'Posted'
              : doc.status || 'Active';

          let totalReturnedQty = 0;
          let computedVal = 0;

          const lineItems = (doc.lineItems || []).map((li, idx) => {
            const code = li.itemCode || li.code || 'ITEM-GEN';
            const desc = li.description || 'Returned Part';
            const unitPrice = Number(li.unitPrice !== undefined && li.unitPrice !== null ? li.unitPrice : li.rate || 0);
            const disc = Number(li.discount || 0);
            const returnQty = Number(
              li.qtyReturn !== undefined && li.qtyReturn !== null
                ? li.qtyReturn
                : li.returnQuantity !== undefined && li.returnQuantity !== null
                ? li.returnQuantity
                : li.quantity !== undefined && li.quantity !== null
                ? li.quantity
                : li.qty || 0
            );
            const lineVal = Number(
              li.totalValue !== undefined && li.totalValue !== null
                ? li.totalValue
                : li.value !== undefined && li.value !== null
                ? li.value
                : li.returnValue !== undefined && li.returnValue !== null
                ? li.returnValue
                : unitPrice * returnQty * (1 - disc / 100)
            );

            totalReturnedQty += returnQty;
            computedVal += lineVal;

            return {
              _id: li._id || `${doc._id}_${idx}`,
              no: li.no || idx + 1,
              code,
              itemCode: code,
              description: desc,
              quantity: returnQty,
              returnQuantity: returnQty,
              qtyReturn: returnQty,
              unitPrice,
              purchaseCost: unitPrice,
              purchasePrice: unitPrice,
              rate: unitPrice,
              discount: disc,
              totalValue: Number(lineVal.toFixed(2)),
              lineValue: Number(lineVal.toFixed(2)),
              value: Number(lineVal.toFixed(2)),
              returnValue: Number(lineVal.toFixed(2)),
              locationCode: li.locationCode || 'Main Store',
              location: li.locationCode || 'Main Store',
              originalQuantity: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
            };
          });

          const finalReturnVal = Number(
            doc.returnTotal !== undefined && doc.returnTotal !== null
              ? doc.returnTotal
              : doc.totalReturnValue !== undefined && doc.totalReturnValue !== null
              ? doc.totalReturnValue
              : computedVal
          );

          return {
            _id: String(doc._id),
            grenNumber: grenNoStr,
            returnNumber: grenNoStr,
            no: doc.no !== undefined ? doc.no : null,
            date: dateFormatted,
            rawDate: isoDate,
            time: doc.time || '10:00:00 AM',
            userCode: doc.userCode || 'PC004',
            supplierCode: rawCode || (linkedGrn ? linkedGrn.supplierCode : '') || '—',
            supplierName: resolvedName,
            supplier: resolvedName,
            originalGrnNumber: origGrn,
            grnReference: origGrn,
            supplierInvoiceNo: invNo,
            supplierInvoiceNumber: invNo,
            invoice: invNo,
            totalItems: lineItems.length,
            totalQuantity: totalReturnedQty,
            totalReturnedQuantity: totalReturnedQty,
            totalReturnValue: Number(finalReturnVal.toFixed(2)),
            returnTotal: Number(finalReturnVal.toFixed(2)),
            subTotal: Number(finalReturnVal.toFixed(2)),
            status: statusStr,
            isPosted: doc.isPosted !== false && doc.status !== 'deleted' && doc.status !== 'cancelled',
            remarks: doc.remarks || doc.note || '',
            note: doc.note || doc.remarks || '',
            lineItems,
            items: lineItems, // backwards compatibility
          };
        });
      } catch (err) {
        console.warn('DB goods return notes query error:', err.message);
      }
    }

    // 5. Filter by Goods Return Note Number (exact or partial, case-insensitive)
    if (grenNumQuery && grenNumQuery !== 'All') {
      const q = grenNumQuery.toLowerCase();
      allReturnRecords = allReturnRecords.filter((n) => {
        const numStr = String(n.grenNumber || '').toLowerCase();
        const noStr = n.no !== null && n.no !== undefined ? String(n.no) : '';
        return numStr.includes(q) || noStr === q;
      });
    }

    // 6. Filter by Supplier (Code or Name, case-insensitive)
    if (supplier && supplier !== 'All') {
      const supQuery = String(supplier).trim().toLowerCase();
      allReturnRecords = allReturnRecords.filter((n) => {
        const sCode = String(n.supplierCode || '').toLowerCase();
        const sName = String(n.supplierName || '').toLowerCase();
        return (
          sCode === supQuery ||
          sName === supQuery ||
          sCode.includes(supQuery) ||
          sName.includes(supQuery)
        );
      });
    }

    // 7. General Search
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      allReturnRecords = allReturnRecords.filter((n) => {
        const matchesHeader =
          String(n.grenNumber || '').toLowerCase().includes(q) ||
          String(n.supplierCode || '').toLowerCase().includes(q) ||
          String(n.supplierName || '').toLowerCase().includes(q) ||
          String(n.originalGrnNumber || '').toLowerCase().includes(q) ||
          String(n.supplierInvoiceNo || '').toLowerCase().includes(q) ||
          String(n.status || '').toLowerCase().includes(q) ||
          String(n.remarks || '').toLowerCase().includes(q);

        if (matchesHeader) return true;

        return (n.lineItems || []).some(
          (li) =>
            String(li.code || '').toLowerCase().includes(q) ||
            String(li.description || '').toLowerCase().includes(q)
        );
      });
    }

    // 8. Sorting
    if (sortBy === 'value_desc') {
      allReturnRecords.sort((a, b) => b.totalReturnValue - a.totalReturnValue);
    } else if (sortBy === 'value_asc') {
      allReturnRecords.sort((a, b) => a.totalReturnValue - b.totalReturnValue);
    } else if (sortBy === 'qty_desc') {
      allReturnRecords.sort((a, b) => b.totalReturnedQuantity - a.totalReturnedQuantity);
    } else if (sortBy === 'qty_asc') {
      allReturnRecords.sort((a, b) => a.totalReturnedQuantity - b.totalReturnedQuantity);
    } else if (sortBy === 'gren_desc' || sortBy === 'note_desc') {
      allReturnRecords.sort((a, b) =>
        String(b.grenNumber).localeCompare(String(a.grenNumber), undefined, { numeric: true })
      );
    } else if (sortBy === 'gren_asc' || sortBy === 'note_asc') {
      allReturnRecords.sort((a, b) =>
        String(a.grenNumber).localeCompare(String(b.grenNumber), undefined, { numeric: true })
      );
    } else if (sortBy === 'supplier_asc') {
      allReturnRecords.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    } else if (sortBy === 'date_asc') {
      allReturnRecords.sort((a, b) => new Date(a.rawDate || 0) - new Date(b.rawDate || 0));
    } else {
      // default: date descending (latest first), then note no descending
      allReturnRecords.sort(
        (a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0) || (b.no || 0) - (a.no || 0)
      );
    }

    // 9. Accurate Summary Calculation from filtered results
    const postedRecords = allReturnRecords.filter(
      (n) => !['cancelled', 'reversed', 'deleted'].includes(String(n.status || '').toLowerCase())
    );

    const grandTotalValue = postedRecords.reduce((sum, n) => sum + (n.totalReturnValue || 0), 0);
    const totalReturnedQuantity = postedRecords.reduce((sum, n) => sum + (n.totalReturnedQuantity || 0), 0);
    const totalItemsCount = postedRecords.reduce((sum, n) => sum + (n.totalItems || 0), 0);
    const uniqueSuppliers = new Set(allReturnRecords.map((n) => n.supplierName || n.supplierCode));
    const totalCancelled = allReturnRecords.length - postedRecords.length;
    const highestNote = [...postedRecords].sort((a, b) => b.totalReturnValue - a.totalReturnValue)[0] || {
      grenNumber: 'N/A',
      subTotal: 0,
      totalReturnValue: 0,
    };

    // 10. Generate flatItems for backward compatibility with continuous paper view
    let flatItems = [];
    allReturnRecords.forEach((note) => {
      (note.lineItems || []).forEach((it) => {
        flatItems.push({
          grenNumber: note.grenNumber,
          date: note.date,
          supplierCode: note.supplierCode,
          supplierName: note.supplierName,
          originalGrnNumber: note.originalGrnNumber,
          supplierInvoiceNo: note.supplierInvoiceNo,
          status: note.status,
          ...it,
        });
      });
    });

    return res.status(200).json({
      success: true,
      reportType: 'goods_return_notes',
      reportTitle: 'GOODS RETURN NOTES (G.RE.N) REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalNotes: allReturnRecords.length,
        matchingNotesCount: allReturnRecords.length,
        totalItemsCount,
        totalQuantity: totalReturnedQuantity,
        totalReturnedQuantity,
        grandTotalValue: Number(grandTotalValue.toFixed(2)),
        totalCancelled,
        totalSuppliers: uniqueSuppliers.size,
        primarySupplier: allReturnRecords[0]?.supplierName || 'N/A',
        highestNote: {
          grenNumber: highestNote.grenNumber,
          subTotal: highestNote.subTotal || highestNote.totalReturnValue || 0,
        },
      },
      notes: allReturnRecords,
      data: allReturnRecords, // alias for consistency
      flatItems,
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// 12. HELPER: Local Day Range (+05:30 Asia/Colombo)
// =============================================================================
const getLocalDayRange = (targetDateStr = '') => {
  const tzOffsetMs = 5.5 * 60 * 60 * 1000;
  let baseDate;
  if (targetDateStr && String(targetDateStr).trim() && !isNaN(new Date(targetDateStr).getTime())) {
    baseDate = new Date(String(targetDateStr).trim());
  } else {
    baseDate = new Date();
  }
  const localNow = new Date(baseDate.getTime() + tzOffsetMs);
  const y = localNow.getUTCFullYear();
  const m = localNow.getUTCMonth();
  const d = localNow.getUTCDate();
  const startOfDay = new Date(Date.UTC(y, m, d) - tzOffsetMs);
  const endOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - tzOffsetMs);
  const localDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { startOfDay, endOfDay, localDateStr };
};

// =============================================================================
// 13. STOCK REPORT
// =============================================================================
export const getStockReport = async (req, res, next) => {
  try {
    const {
      search = '',
      category = 'All',
      subCategory = 'All',
      location = 'All',
      status = 'all',
      sortBy = 'code_asc',
      page = 1,
      limit = 50,
    } = req.query;

    if (!isDbConnected()) {
      return res.status(200).json({
        success: false,
        message: 'Database offline mode',
        summary: {
          totalItems: 0,
          totalAvailableStock: 0,
          totalValuation: 0,
          inStockCount: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
        pagination: { page: 1, limit: 50, totalRecords: 0, totalPages: 0 },
        items: [],
        filterOptions: { categories: [], subCategories: [], locations: [] },
      });
    }

    const query = {};
    const andClauses = [];

    if (search && search.trim()) {
      const term = search.trim();
      andClauses.push({
        $or: [
          { code: { $regex: term, $options: 'i' } },
          { itemCode: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { name: { $regex: term, $options: 'i' } },
          { itemName: { $regex: term, $options: 'i' } },
          { category: { $regex: term, $options: 'i' } },
        ],
      });
    }

    if (category && category.trim() && category !== 'All') {
      andClauses.push({
        category: { $regex: new RegExp(`^${category.trim()}$`, 'i') },
      });
    }

    if (subCategory && subCategory.trim() && subCategory !== 'All') {
      andClauses.push({
        subCategory: { $regex: new RegExp(`^${subCategory.trim()}$`, 'i') },
      });
    }

    if (location && location.trim() && location !== 'All') {
      const loc = location.trim();
      if (loc.toLowerCase() === 'main store') {
        andClauses.push({
          $or: [
            { location: { $regex: /^main store$/i } },
            { location: '' },
            { location: null },
            { location: { $exists: false } },
          ],
        });
      } else {
        andClauses.push({
          location: { $regex: new RegExp(`^${loc}$`, 'i') },
        });
      }
    }

    const finalQuery = andClauses.length === 0
      ? {}
      : andClauses.length === 1
      ? andClauses[0]
      : { $and: andClauses };

    // Fetch items from the authoritative 'items' collection in MongoDB Atlas
    const dbItems = await mongoose.connection.db.collection('items').find(finalQuery, {
      projection: {
        code: 1,
        itemCode: 1,
        description: 1,
        name: 1,
        itemName: 1,
        category: 1,
        subCategory: 1,
        location: 1,
        quantity: 1,
        stockInHand: 1,
        stock: 1,
        damagedStock: 1,
        reorderLevel: 1,
        lastGrnDate: 1,
        lastGrn: 1,
        lastGrnPrice: 1,
        averageCost: 1,
        cost: 1,
        sellingPrice: 1,
        finalSellingPrice: 1,
      },
    }).toArray();

    // Map and calculate stock metrics - preserve all registered items even if stock is 0 or no GRN history
    const allMatchingItems = dbItems.map((itm) => {
      const code = String(itm.code || itm.itemCode || '').trim();
      const desc = String(itm.description || itm.name || itm.itemName || '').toUpperCase().trim();
      const qty = itm.quantity !== undefined
        ? Number(itm.quantity)
        : (itm.stockInHand !== undefined
          ? Number(itm.stockInHand)
          : (itm.stock !== undefined ? Number(itm.stock) : 0));

      const reorder = Number(itm.reorderLevel) || 0;
      const isOut = qty <= 0;
      const isLow = !isOut && (reorder > 0 ? qty <= reorder : qty <= 2);
      const stockStatus = isOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock');

      const cost = Number(itm.averageCost) || Number(itm.lastGrnPrice) || Number(itm.cost) || 0;
      const price = itm.sellingPrice !== undefined && Number(itm.sellingPrice) >= 0
        ? Number(itm.sellingPrice)
        : (itm.finalSellingPrice !== undefined ? Number(itm.finalSellingPrice) : 0);

      const unitValuation = cost > 0 ? cost : (price > 0 ? price * 0.7 : 0);
      const valuation = qty > 0 ? Number((qty * unitValuation).toFixed(2)) : 0;
      const grnDate = itm.lastGrnDate || itm.lastGrn || '';

      return {
        _id: itm._id,
        code,
        description: desc,
        category: (itm.category || '').toUpperCase().trim() || 'GENERAL',
        subCategory: (itm.subCategory || '').trim() || 'N/A',
        location: (itm.location || '').trim() || 'Main Store',
        availableStock: qty,
        damagedStock: Number(itm.damagedStock) || 0,
        reorderLevel: reorder,
        stockStatus,
        isLowStock: isLow,
        isOutOfStock: isOut,
        lastGrnDate: grnDate ? String(grnDate).slice(0, 10) : '',
        lastGrnPurchaseCost: Number(cost.toFixed(2)),
        sellingPrice: Number(price.toFixed(2)),
        valuation,
      };
    });

    // Summary calculations across matching items (before stock status filter)
    const totalItems = allMatchingItems.length;
    const totalAvailableStock = allMatchingItems.reduce((sum, it) => sum + it.availableStock, 0);
    const totalValuation = allMatchingItems.reduce((sum, it) => sum + it.valuation, 0);
    const inStockCount = allMatchingItems.filter((it) => it.stockStatus === 'In Stock').length;
    const lowStockCount = allMatchingItems.filter((it) => it.isLowStock).length;
    const outOfStockCount = allMatchingItems.filter((it) => it.isOutOfStock).length;

    // Filter by stock status for table display & pagination
    let filteredItems = allMatchingItems;
    if (status === 'in_stock') {
      filteredItems = filteredItems.filter((it) => it.stockStatus === 'In Stock');
    } else if (status === 'low_stock') {
      filteredItems = filteredItems.filter((it) => it.isLowStock);
    } else if (status === 'out_of_stock') {
      filteredItems = filteredItems.filter((it) => it.isOutOfStock);
    }

    // Sorting
    if (sortBy === 'code_desc') {
      filteredItems.sort((a, b) => b.code.localeCompare(a.code));
    } else if (sortBy === 'desc_asc') {
      filteredItems.sort((a, b) => a.description.localeCompare(b.description));
    } else if (sortBy === 'desc_desc') {
      filteredItems.sort((a, b) => b.description.localeCompare(a.description));
    } else if (sortBy === 'qty_desc') {
      filteredItems.sort((a, b) => b.availableStock - a.availableStock);
    } else if (sortBy === 'qty_asc') {
      filteredItems.sort((a, b) => a.availableStock - b.availableStock);
    } else if (sortBy === 'cost_desc') {
      filteredItems.sort((a, b) => b.lastGrnPurchaseCost - a.lastGrnPurchaseCost);
    } else if (sortBy === 'cost_asc') {
      filteredItems.sort((a, b) => a.lastGrnPurchaseCost - b.lastGrnPurchaseCost);
    } else if (sortBy === 'price_desc') {
      filteredItems.sort((a, b) => b.sellingPrice - a.sellingPrice);
    } else if (sortBy === 'price_asc') {
      filteredItems.sort((a, b) => a.sellingPrice - b.sellingPrice);
    } else {
      // Default: code_asc
      filteredItems.sort((a, b) => a.code.localeCompare(b.code));
    }

    // Pagination
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit) === 0 ? 0 : Math.max(1, Number(limit) || 50);
    const totalRecords = filteredItems.length;
    const totalPages = limitNum === 0 ? 1 : Math.ceil(totalRecords / limitNum);
    const paginatedItems = limitNum === 0 ? filteredItems : filteredItems.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Filter options directly from database collection
    const distinctCategories = await mongoose.connection.db.collection('items').distinct('category');
    const distinctSubCategories = await mongoose.connection.db.collection('items').distinct('subCategory');
    const rawLocations = await mongoose.connection.db.collection('items').distinct('location');
    const locationsList = Array.from(new Set(['Main Store', ...rawLocations.filter(Boolean)])).sort();

    return res.status(200).json({
      success: true,
      reportType: 'stock_report',
      reportTitle: 'STOCK REPORT',
      company: COMPANY_HEADER,
      summary: {
        totalItems,
        totalAvailableStock,
        totalValuation: Math.round(totalValuation * 100) / 100,
        inStockCount,
        lowStockCount,
        outOfStockCount,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages,
      },
      items: paginatedItems,
      filterOptions: {
        categories: distinctCategories.filter(Boolean).sort(),
        subCategories: distinctSubCategories.filter(Boolean).sort(),
        locations: locationsList,
      },
      softwareFooter: SOFTWARE_FOOTER,
    });
  } catch (error) {
    console.error('[Stock Report Controller Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve stock report from database: ' + error.message,
      summary: {
        totalItems: 0,
        totalAvailableStock: 0,
        totalValuation: 0,
        inStockCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      },
      pagination: { page: 1, limit: 50, totalRecords: 0, totalPages: 0 },
      items: [],
      filterOptions: { categories: [], subCategories: [], locations: ['Main Store'] },
    });
  }
};

// =============================================================================
// 14. REPORTS DASHBOARD METRICS
// =============================================================================
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const { date = '' } = req.query;

    if (!isDbConnected()) {
      return res.status(200).json({
        success: false,
        message: 'Database offline mode',
        cards: {
          totalItems: 0,
          totalAvailableStock: 0,
          outOfStockCount: 0,
          lowStockCount: 0,
          todayBills: 0,
          todaySales: 0,
          todayReturns: 0,
          todayReturnValue: 0,
          todayGrns: 0,
          todayGoodsReturns: 0,
        },
      });
    }

    const { startOfDay, endOfDay, localDateStr } = getLocalDayRange(date);

    // 1-4: Stock counts & low/out lists
    const items = await mongoose.connection.db.collection('items').find({}, {
      projection: {
        code: 1,
        description: 1,
        category: 1,
        location: 1,
        quantity: 1,
        stockInHand: 1,
        reorderLevel: 1,
        sellingPrice: 1,
        finalSellingPrice: 1,
        averageCost: 1,
        lastGrnPrice: 1,
      },
    }).toArray();

    let totalAvailableStock = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let inStockCount = 0;
    const outOfStockList = [];
    const lowStockList = [];

    for (const it of items) {
      const qty = itmStock(it);
      const reorder = Number(it.reorderLevel) || 0;
      const isOut = qty <= 0;
      const isLow = !isOut && (reorder > 0 ? qty <= reorder : qty <= 2);
      totalAvailableStock += qty;

      if (isOut) {
        outOfStockCount++;
        if (outOfStockList.length < 25) {
          outOfStockList.push({
            code: it.code,
            description: (it.description || '').toUpperCase(),
            category: it.category || 'GENERAL',
            location: it.location || 'Main Store',
            availableStock: qty,
            reorderLevel: reorder,
            sellingPrice: Number(it.finalSellingPrice) || Number(it.sellingPrice) || 0,
          });
        }
      } else if (isLow) {
        lowStockCount++;
        if (lowStockList.length < 25) {
          lowStockList.push({
            code: it.code,
            description: (it.description || '').toUpperCase(),
            category: it.category || 'GENERAL',
            location: it.location || 'Main Store',
            availableStock: qty,
            reorderLevel: reorder,
            sellingPrice: Number(it.finalSellingPrice) || Number(it.sellingPrice) || 0,
          });
        }
      } else {
        inStockCount++;
      }
    }

    // Helper for stock extraction
    function itmStock(it) {
      return it.quantity !== undefined ? Number(it.quantity) : (it.stockInHand !== undefined ? Number(it.stockInHand) : 0);
    }

    // 5-6: Today's Finalized Sales Invoices
    const todayInvoices = await mongoose.connection.db.collection('invoices').find({
      status: { $nin: ['cancelled', 'draft', 'held'] },
      isHold: { $ne: true },
      $or: [
        { date: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).toArray();

    const todayBills = todayInvoices.length;
    const todaySales = todayInvoices.reduce((sum, inv) => sum + (Number(inv.netTotal) || Number(inv.amountToPay) || 0), 0);

    // 7-8: Today's Customer Returns
    const todayCustReturns = await mongoose.connection.db.collection('customerdamagereturns').find({
      status: { $ne: 'CANCELLED' },
      $or: [
        { date: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).toArray();

    const todayReturns = todayCustReturns.length;
    const todayReturnValue = todayCustReturns.reduce((sum, r) => {
      const itm = r.returnedItem || {};
      const val = Number(r.refundAmount) || (Number(itm.returnedQuantity || 1) * Number(itm.unitPrice || 0));
      return sum + val;
    }, 0);

    // 9: Today's Goods Received Notes (GRN)
    const todayGrns = await mongoose.connection.db.collection('grns').countDocuments({
      status: { $ne: 'cancelled' },
      $or: [
        { date: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    });

    // 10: Today's Goods Return Notes (Supplier Returns)
    const todayGoodsReturns = await mongoose.connection.db.collection('supplierreturns').countDocuments({
      $or: [
        { date: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    });

    // Top Selling Items Today (aggregated from today's invoices, or recent)
    const topItemMap = new Map();
    todayInvoices.forEach((inv) => {
      (inv.lineItems || []).forEach((li) => {
        const c = String(li.code || li.itemCode || '').trim();
        if (!c) return;
        const q = Number(li.quantity || li.qty || 1);
        const v = Number(li.total || (li.unitPrice * q) || 0);
        if (!topItemMap.has(c)) {
          topItemMap.set(c, {
            code: c,
            description: li.description || 'Sales Item',
            quantity: 0,
            revenue: 0,
            source: 'Today',
          });
        }
        const entry = topItemMap.get(c);
        entry.quantity += q;
        entry.revenue += v;
      });
    });

    let topSellingToday = Array.from(topItemMap.values()).sort((a, b) => b.quantity - a.quantity);

    // If today has less than 5 items, supplement from recent completed invoices
    if (topSellingToday.length < 5) {
      const recentSalesInvoices = await mongoose.connection.db.collection('invoices')
        .find({ status: { $nin: ['cancelled', 'draft', 'held'] }, isHold: { $ne: true } })
        .sort({ createdAt: -1, date: -1 })
        .limit(20)
        .toArray();

      recentSalesInvoices.forEach((inv) => {
        (inv.lineItems || []).forEach((li) => {
          const c = String(li.code || li.itemCode || '').trim();
          if (!c || topItemMap.has(c)) return;
          const q = Number(li.quantity || li.qty || 1);
          const v = Number(li.total || (li.unitPrice * q) || 0);
          topSellingToday.push({
            code: c,
            description: li.description || 'Sales Item',
            quantity: q,
            revenue: v,
            source: 'Recent',
          });
        });
      });
      topSellingToday = topSellingToday.slice(0, 10);
    }

    // Past 7 Days Sales Trend
    const past7Days = [];
    const tzOffsetMs = 5.5 * 60 * 60 * 1000;
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(startOfDay.getTime() - i * 24 * 60 * 60 * 1000);
      const dEnd = new Date(endOfDay.getTime() - i * 24 * 60 * 60 * 1000);
      const dayDate = new Date(dStart.getTime() + tzOffsetMs);
      const label = `${String(dayDate.getUTCMonth() + 1).padStart(2, '0')}/${String(dayDate.getUTCDate()).padStart(2, '0')}`;
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayDate.getUTCDay()];
      past7Days.push({
        dStart,
        dEnd,
        label: `${dayName} ${label}`,
        fullDate: dayDate.toISOString().slice(0, 10),
        sales: 0,
        bills: 0,
      });
    }

    const past7DaysInvoices = await mongoose.connection.db.collection('invoices').find({
      status: { $nin: ['cancelled', 'draft', 'held'] },
      isHold: { $ne: true },
      $or: [
        { date: { $gte: past7Days[0].dStart, $lte: endOfDay } },
        { createdAt: { $gte: past7Days[0].dStart, $lte: endOfDay } },
      ],
    }).toArray();

    past7DaysInvoices.forEach((inv) => {
      const invDate = new Date(inv.date || inv.createdAt);
      for (const d of past7Days) {
        if (invDate >= d.dStart && invDate <= d.dEnd) {
          d.sales += Number(inv.netTotal) || Number(inv.amountToPay) || 0;
          d.bills += 1;
          break;
        }
      }
    });

    // Recent Finalized Invoices (up to 8)
    const recentInvoicesRaw = await mongoose.connection.db.collection('invoices')
      .find({ status: { $nin: ['cancelled', 'draft'] }, isHold: { $ne: true } })
      .sort({ createdAt: -1, date: -1 })
      .limit(8)
      .toArray();

    const recentInvoices = recentInvoicesRaw.map((inv) => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber || String(inv.no || ''),
      date: inv.date || inv.createdAt,
      customerName: inv.customerName || inv.cusname || 'Walk-in Customer',
      amount: Number(inv.netTotal) || Number(inv.amountToPay) || 0,
      paymentMethod: inv.paymentMethod || inv.paidBy || 'Cash',
      status: inv.status || 'completed',
    }));

    // Recent GRNs (up to 8)
    const recentGrnsRaw = await mongoose.connection.db.collection('grns')
      .find({ status: { $ne: 'cancelled' } })
      .sort({ createdAt: -1, date: -1 })
      .limit(8)
      .toArray();

    const recentGrns = recentGrnsRaw.map((grn) => ({
      _id: grn._id,
      grnNumber: grn.grnNumber || String(grn.no || ''),
      date: grn.date || grn.createdAt,
      supplierName: grn.supplierName || grn.supplier || 'N/A',
      amount: Number(grn.totalValue) || Number(grn.grnValue) || 0,
      paymentMethod: grn.paidBy || grn.paymentMethod || 'Cash',
      status: grn.status || 'active',
    }));

    // Recent Customer Returns (up to 8)
    const recentCustReturnsRaw = await mongoose.connection.db.collection('customerdamagereturns')
      .find({ status: { $ne: 'CANCELLED' } })
      .sort({ createdAt: -1, date: -1 })
      .limit(8)
      .toArray();

    const recentCustomerReturns = recentCustReturnsRaw.map((ret) => {
      const itm = ret.returnedItem || {};
      const val = Number(ret.refundAmount) || (Number(itm.returnedQuantity || 1) * Number(itm.unitPrice || 0));
      return {
        _id: ret._id,
        returnNumber: ret.returnNumber || String(ret.no || ''),
        invoiceNumber: ret.invoiceNumber || 'N/A',
        date: ret.date || ret.createdAt,
        customerName: ret.customerName || 'Customer',
        itemCode: itm.itemCode || itm.code || 'ITEM',
        description: itm.description || 'Returned Item',
        quantity: Number(itm.returnedQuantity || 1),
        value: Number(val.toFixed(2)),
        reason: itm.damageReason || ret.remarks || 'Warranty/Return',
      };
    });

    return res.status(200).json({
      success: true,
      reportType: 'dashboard_metrics',
      company: COMPANY_HEADER,
      dateInfo: {
        currentDate: localDateStr,
        timezone: 'Asia/Colombo (UTC+05:30)',
        asOfTime: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' }),
      },
      cards: {
        totalItems: items.length,
        totalAvailableStock,
        stockUnit: 'Pcs',
        outOfStockCount,
        lowStockCount,
        inStockCount,
        todayBills,
        todaySales: Number(todaySales.toFixed(2)),
        todayReturns,
        todayReturnValue: Number(todayReturnValue.toFixed(2)),
        todayGrns,
        todayGoodsReturns,
      },
      past7Days: past7Days.map((d) => ({
        label: d.label,
        fullDate: d.fullDate,
        sales: Number(d.sales.toFixed(2)),
        bills: d.bills,
      })),
      topSellingToday,
      lowStockList,
      outOfStockList,
      recentInvoices,
      recentGrns,
      recentCustomerReturns,
    });
  } catch (error) {
    console.error('[Dashboard Metrics Controller Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard metrics from database: ' + error.message,
      cards: {
        totalItems: 0,
        totalAvailableStock: 0,
        stockUnit: 'Pcs',
        outOfStockCount: 0,
        lowStockCount: 0,
        inStockCount: 0,
        todayBills: 0,
        todaySales: 0,
        todayReturns: 0,
        todayReturnValue: 0,
        todayGrns: 0,
        todayGoodsReturns: 0,
      },
    });
  }
};

/**
 * =============================================================================
 * INVOICE REPORT (Complete Invoice List with Settlements and KPI Dashboard)
 * =============================================================================
 */
export const getInvoiceReport = async (req, res, next) => {
  try {
    const {
      search = '',
      invoiceNumber = '',
      customer = '',
      dateFrom = '',
      dateTo = '',
      invoiceType = 'all',
      paymentMethod = 'all',
      paymentStatus = 'all',
      sortBy = 'date_desc',
      page = 1,
      limit = 50,
    } = req.query;

    if (!isDbConnected()) {
      return res.status(200).json({
        success: false,
        message: 'Database offline mode',
        data: [],
        summary: {
          totalInvoices: 0,
          todayInvoices: 0,
          todaySales: 0,
          totalOutstandingBalance: 0,
          matchingCount: 0,
          matchingNetTotal: 0,
          matchingAmountPaid: 0,
          matchingOutstanding: 0,
        },
        pagination: {
          page: 1,
          limit: 50,
          totalRecords: 0,
          totalPages: 1,
        },
      });
    }

    // Fetch all saved invoices and settlements from database
    const [invoices, settlements] = await Promise.all([
      Invoice.find({}).sort({ date: -1, createdAt: -1, no: -1 }).lean(),
      Settlement.find({}).sort({ date: 1, createdAt: 1 }).lean(),
    ]);

    // Map settlements by normalized invoiceNumber and invoiceNo
    const settMap = new Map();
    for (const s of settlements) {
      const keys = [];
      if (s.invoiceNumber) keys.push(String(s.invoiceNumber).trim().toLowerCase());
      if (s.invoiceNo) keys.push(String(s.invoiceNo).trim().toLowerCase());
      for (const k of keys) {
        if (!settMap.has(k)) settMap.set(k, []);
        settMap.get(k).push(s);
      }
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

    let totalInvoices = invoices.length;
    let todayInvoices = 0;
    let todaySales = 0;
    let totalOutstandingBalance = 0;

    // Process every invoice with real financials and actual settlement records
    const allInvoices = invoices.map((inv) => {
      const invNum = String(
        inv.invoiceNumber || (inv.no !== undefined && inv.no !== null ? String(inv.no) : '') || (inv._id ? inv._id.toString() : '')
      ).trim();
      const invKey = invNum.toLowerCase();
      const invNoKey = inv.no !== undefined && inv.no !== null ? String(inv.no).trim().toLowerCase() : null;

      // Match linked settlements
      const matchedSettlements = [];
      const seenReceipts = new Set();
      const candidates = [...(settMap.get(invKey) || []), ...(invNoKey ? (settMap.get(invNoKey) || []) : [])];
      for (const c of candidates) {
        const rKey = c.receiptNo || (c._id ? c._id.toString() : '');
        if (!seenReceipts.has(rKey)) {
          seenReceipts.add(rKey);
          matchedSettlements.push({
            receiptNo: c.receiptNo || 'N/A',
            no: c.no,
            date: c.date || c.createdAt,
            amount: Number(parseFloat(c.amount || 0).toFixed(2)),
            method: c.method || 'Cash',
            bank: c.bank || '',
            chequeNo: c.chequeNo || '',
            dateRealized: c.dateRealized || '',
            remark: c.remark || '',
            createdBy: c.createdBy || 'Staff',
          });
        }
      }

      const isCancelled = String(inv.status || '').toLowerCase() === 'cancelled';
      const isTemp = inv.isTemporary === true || String(inv.invoiceType || '').toLowerCase() === 'temporary';
      const isManual = inv.isManualInvoice === true || String(inv.invoiceType || '').toLowerCase() === 'manual' || invNum.startsWith('MAN-');
      const resolvedType = isTemp ? 'Temporary Bill' : (isManual ? 'Manual Invoice' : 'Normal Sales Invoice');

      // Gross SubTotal and Line Discounts
      let subTotal = 0;
      let lineDiscount = 0;
      if (inv.lineItems && Array.isArray(inv.lineItems) && inv.lineItems.length > 0) {
        subTotal = inv.lineItems.reduce((acc, li) => {
          const p = parseFloat(li.price !== undefined ? li.price : (li.unitPrice !== undefined ? li.unitPrice : (li.rate || 0)));
          const q = parseFloat(li.quantity !== undefined ? li.quantity : (li.qty || 1));
          return acc + (p * q);
        }, 0);
        lineDiscount = inv.lineItems.reduce((acc, li) => acc + parseFloat(li.discountAmount || 0), 0);
      } else {
        subTotal = parseFloat(inv.subTotal || inv.amountToPay || inv.netTotal || 0);
      }

      const specialDiscount = parseFloat(inv.specialDiscount || 0);
      const totalDiscount = Math.round((lineDiscount + specialDiscount) * 100) / 100;

      let netTotal = parseFloat(
        inv.netTotal !== undefined && inv.netTotal !== null && !isNaN(inv.netTotal)
          ? inv.netTotal
          : (inv.amountToPay !== undefined && inv.amountToPay !== null && !isNaN(inv.amountToPay)
              ? inv.amountToPay
              : Math.max(0, subTotal - totalDiscount))
      );
      if (isNaN(netTotal) || netTotal < 0) netTotal = 0;
      netTotal = Math.round(netTotal * 100) / 100;
      subTotal = Math.round(subTotal * 100) / 100;

      // Actual Payments Received
      const settlementSum = Math.round(matchedSettlements.reduce((acc, s) => acc + s.amount, 0) * 100) / 100;
      const initialPaid = parseFloat(inv.paidAmount || inv.amountReceived || inv.customerPaidAmount || inv.cashReceived || 0);

      let amountPaid = 0;
      if (matchedSettlements.length > 0) {
        amountPaid = Math.max(settlementSum, initialPaid);
      } else {
        amountPaid = initialPaid;
      }
      if (amountPaid < 0) amountPaid = 0;
      if (String(inv.status || '').toLowerCase() === 'paid' && amountPaid === 0 && netTotal > 0) {
        amountPaid = netTotal;
      }
      amountPaid = Math.round(Math.min(netTotal, amountPaid) * 100) / 100;

      let outstandingBalance = isCancelled ? 0 : Math.round(Math.max(0, netTotal - amountPaid) * 100) / 100;

      let paymentStatus = 'Unpaid';
      if (isCancelled) {
        paymentStatus = 'Cancelled';
      } else if (outstandingBalance <= 0.01) {
        paymentStatus = 'Paid';
      } else if (amountPaid > 0.01 && outstandingBalance > 0.01) {
        paymentStatus = 'Partially Paid';
      } else {
        paymentStatus = 'Unpaid';
      }

      let payMethod = (inv.paymentMethod || inv.paidBy || (matchedSettlements[0]?.method) || 'Cash').trim();
      if (payMethod.toUpperCase() === 'CASH') payMethod = 'Cash';

      const invDate = inv.date || inv.createdAt || new Date();
      let invDateStr = '';
      try {
        invDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(invDate));
      } catch (e) {
        invDateStr = new Date(invDate).toISOString().split('T')[0];
      }

      // Update Dashboard KPIs (Real database totals)
      if (invDateStr === todayStr) {
        todayInvoices++;
        if (!isCancelled && !isTemp) {
          todaySales += netTotal;
        }
      }

      if (!isCancelled && !isTemp) {
        totalOutstandingBalance += outstandingBalance;
      }

      return {
        _id: inv._id,
        invoiceNumber: invNum,
        no: inv.no,
        date: invDate,
        dateStr: invDateStr,
        customerCode: inv.customerCode || inv.cuscode || '',
        customerName: inv.customerName || inv.cusname || 'Walk-in Customer',
        customerAddress: inv.customerAddress || '',
        customerTelephone: inv.customerTelephone || inv.telephone || '',
        invoiceType: resolvedType,
        isManualInvoice: isManual,
        isTemporary: isTemp,
        paymentMethod: payMethod,
        subTotal,
        discount: totalDiscount,
        lineDiscount,
        specialDiscount,
        netTotal,
        amountPaid,
        outstandingBalance,
        status: paymentStatus,
        rawStatus: inv.status || '',
        settlements: matchedSettlements,
        lineItems: (inv.lineItems || []).map((li) => {
          const liPrice = parseFloat(li.price !== undefined ? li.price : (li.unitPrice !== undefined ? li.unitPrice : (li.rate || 0)));
          const liQty = parseFloat(li.quantity !== undefined ? li.quantity : (li.qty || 1));
          const liDiscAmt = parseFloat(li.discountAmount || 0);
          const liVal = parseFloat(li.value !== undefined ? li.value : Math.max(0, (liPrice * liQty) - liDiscAmt));
          return {
            code: li.code || li.itemCode || '',
            itemCode: li.itemCode || li.code || '',
            description: li.description || '',
            unit: li.unit || 'PCS',
            location: li.location || 'Main Store',
            quantity: liQty,
            sellingPrice: liPrice,
            rate: liPrice,
            discountPercentage: parseFloat(li.discountPercentage || 0),
            discountAmount: liDiscAmt,
            lineValue: liVal,
            jobType: li.jobType || li.type || 'Material',
          };
        }),
        remark: inv.remark || inv.note || '',
      };
    });

    // Apply combined filters
    let filtered = allInvoices;

    // Filter: Search Keyword (Invoice Number, Customer Name/Code, Item Codes)
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((i) => {
        return (
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerCode.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.customerTelephone.toLowerCase().includes(q) ||
          i.lineItems.some((li) => li.itemCode.toLowerCase().includes(q) || li.description.toLowerCase().includes(q))
        );
      });
    }

    // Filter: Invoice Number (exact or partial)
    if (invoiceNumber && invoiceNumber.trim() !== '') {
      const invQ = invoiceNumber.trim().toLowerCase();
      filtered = filtered.filter((i) => i.invoiceNumber.toLowerCase().includes(invQ));
    }

    // Filter: Customer Code or Customer Name
    if (customer && customer.trim() !== '') {
      const cusQ = customer.trim().toLowerCase();
      filtered = filtered.filter(
        (i) => i.customerCode.toLowerCase().includes(cusQ) || i.customerName.toLowerCase().includes(cusQ)
      );
    }

    // Filter: Date Range (dateFrom & dateTo)
    if (dateFrom && dateFrom.trim() && dateFrom !== 'all') {
      const startD = new Date(dateFrom.trim());
      startD.setHours(0, 0, 0, 0);
      filtered = filtered.filter((i) => new Date(i.date) >= startD);
    }
    if (dateTo && dateTo.trim() && dateTo !== 'all') {
      const endD = new Date(dateTo.trim());
      endD.setHours(23, 59, 59, 999);
      filtered = filtered.filter((i) => new Date(i.date) <= endD);
    }

    // Filter: Invoice Type
    if (invoiceType && invoiceType !== 'all') {
      const itNorm = invoiceType.toLowerCase();
      if (itNorm.includes('manual')) {
        filtered = filtered.filter((i) => i.invoiceType === 'Manual Invoice');
      } else if (itNorm.includes('temp')) {
        filtered = filtered.filter((i) => i.invoiceType === 'Temporary Bill');
      } else if (itNorm.includes('normal') || itNorm.includes('sales') || itNorm.includes('standard')) {
        filtered = filtered.filter((i) => i.invoiceType === 'Normal Sales Invoice');
      }
    }

    // Filter: Payment Method
    if (paymentMethod && paymentMethod !== 'all') {
      const pmNorm = paymentMethod.toLowerCase();
      filtered = filtered.filter((i) => i.paymentMethod.toLowerCase().includes(pmNorm));
    }

    // Filter: Payment Status
    if (paymentStatus && paymentStatus !== 'all') {
      const psNorm = paymentStatus.toLowerCase();
      filtered = filtered.filter((i) => {
        if (psNorm === 'paid') return i.status === 'Paid';
        if (psNorm === 'unpaid') return i.status === 'Unpaid';
        if (psNorm.includes('part')) return i.status === 'Partially Paid';
        if (psNorm === 'cancelled') return i.status === 'Cancelled';
        return true;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'date_asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'date_desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'invoice_asc') return a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true });
      if (sortBy === 'invoice_desc') return b.invoiceNumber.localeCompare(a.invoiceNumber, undefined, { numeric: true });
      if (sortBy === 'net_desc') return b.netTotal - a.netTotal;
      if (sortBy === 'net_asc') return a.netTotal - b.netTotal;
      if (sortBy === 'balance_desc') return b.outstandingBalance - a.outstandingBalance;
      if (sortBy === 'balance_asc') return a.outstandingBalance - b.outstandingBalance;
      return new Date(b.date) - new Date(a.date);
    });

    // Summary of matching invoices
    const matchingCount = filtered.length;
    const matchingNetTotal = Math.round(filtered.reduce((sum, i) => sum + i.netTotal, 0) * 100) / 100;
    const matchingAmountPaid = Math.round(filtered.reduce((sum, i) => sum + i.amountPaid, 0) * 100) / 100;
    const matchingOutstanding = Math.round(filtered.reduce((sum, i) => sum + i.outstandingBalance, 0) * 100) / 100;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10) === 0 ? 0 : Math.min(250, Math.max(1, parseInt(limit, 10) || 50));
    const totalPages = limitNum === 0 ? 1 : Math.max(1, Math.ceil(matchingCount / limitNum));
    const paginatedInvoices = limitNum === 0 ? filtered : filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      reportType: 'invoice_report',
      company: COMPANY_HEADER,
      summary: {
        totalInvoices,
        todayInvoices,
        todaySales: Number(todaySales.toFixed(2)),
        totalOutstandingBalance: Number(totalOutstandingBalance.toFixed(2)),
        matchingCount,
        matchingNetTotal,
        matchingAmountPaid,
        matchingOutstanding,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords: matchingCount,
        totalPages,
      },
      data: paginatedInvoices,
    });
  } catch (error) {
    console.error('[Invoice Report Controller Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoice report from database: ' + error.message,
    });
  }
};


