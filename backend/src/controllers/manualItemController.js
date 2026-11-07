import mongoose from 'mongoose';
import ManualItem from '../models/ManualItem.js';
import ManualStockTransaction from '../models/ManualStockTransaction.js';
import Item from '../models/Item.js';
import Invoice from '../models/Invoice.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Generate next unique manual item code: MI-0001, MI-0002...
 */
export const computeNextManualItemCode = async () => {
  const latest = await ManualItem.find({ manualCode: /^MI-\d+$/i })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  let maxNum = 0;
  for (const item of latest) {
    const match = String(item.manualCode).match(/^MI-(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  // Also check count to avoid any duplicates
  const totalCount = await ManualItem.countDocuments();
  if (totalCount > maxNum) maxNum = totalCount;

  let nextNo = maxNum + 1;
  let candidate = `MI-${String(nextNo).padStart(4, '0')}`;
  while (await ManualItem.findOne({ manualCode: candidate })) {
    nextNo++;
    candidate = `MI-${String(nextNo).padStart(4, '0')}`;
  }

  return candidate;
};

/**
 * Record a manual invoice line item in the Manual Stock system.
 * Only records items that do NOT exist in the authoritative Item Master.
 */
export const recordManualSaleItem = async ({
  invoiceNumber,
  invoiceDate = new Date(),
  lineItem,
  customerName = 'Walk In Customer',
  performedBy = 'Cashier',
}) => {
  const code = (lineItem.code || lineItem.itemCode || '').trim();
  const desc = (lineItem.description || '').trim();
  const qty = Math.max(0.01, parseFloat(lineItem.quantity !== undefined ? lineItem.quantity : lineItem.qty) || 1);
  const price = Math.max(0, parseFloat(lineItem.price !== undefined ? lineItem.price : lineItem.unitPrice) || 0);
  const unit = (lineItem.unit || 'PCS').trim().toUpperCase();

  if (!desc) return null;

  // 1. Check if item exists in Item Master
  if (code) {
    const existingMaster = await Item.findOne({
      $or: [{ code }, { barcode: code }, { barCode: code }],
    }).lean();
    if (existingMaster) {
      // Item exists in Item Master: It is an inventory item sold manually.
      // Do not record as an unregistered manual item, and do not modify normal stock.
      return null;
    }
  }

  // 2. Search for existing ManualItem
  const normDesc = desc.toLowerCase();
  let manualItem = null;

  // Match by code if valid user code (not generic MAN-1, MAN-2, etc.)
  if (code && !/^MAN-\d+$/i.test(code)) {
    manualItem = await ManualItem.findOne({
      $or: [
        { manualCode: code },
        { manualCode: code.toUpperCase() },
        { normalizedDescription: normDesc },
      ],
    });
  } else {
    manualItem = await ManualItem.findOne({ normalizedDescription: normDesc });
  }

  const txDate = invoiceDate ? new Date(invoiceDate) : new Date();

  if (manualItem) {
    // Update existing manual item sales tally
    manualItem.totalSalesQty = Math.round(((manualItem.totalSalesQty || 0) + qty) * 100) / 100;
    manualItem.availableStock = Math.round(((manualItem.totalStockAdded || 0) - manualItem.totalSalesQty) * 100) / 100;
    if (price > 0) manualItem.sellingPrice = price;
    manualItem.lastTransactionDate = txDate;
    await manualItem.save();
  } else {
    // Generate new unique manual code
    const newCode = (code && !/^MAN-\d+$/i.test(code)) ? code : await computeNextManualItemCode();
    manualItem = new ManualItem({
      manualCode: newCode,
      description: desc,
      normalizedDescription: normDesc,
      unit,
      sellingPrice: price,
      costPrice: 0,
      totalSalesQty: qty,
      totalStockAdded: 0,
      availableStock: -qty,
      firstTransactionDate: txDate,
      lastTransactionDate: txDate,
      status: 'Active',
      location: 'Main Store',
    });
    await manualItem.save();
  }

  // 3. Create audit transaction record
  const transaction = new ManualStockTransaction({
    manualItemId: manualItem._id,
    manualCode: manualItem.manualCode,
    description: manualItem.description,
    transactionType: 'MANUAL_SALE',
    date: txDate,
    referenceNumber: String(invoiceNumber),
    quantity: qty,
    unitPrice: price,
    costPrice: manualItem.costPrice || 0,
    balanceAfter: manualItem.availableStock,
    performedBy: performedBy || 'Cashier',
    notes: `Manual Invoice sale to ${customerName || 'Walk In Customer'}`,
  });

  await transaction.save();
  return manualItem;
};

/**
 * GET /api/manual-items & /api/reports/manual-stock
 * Retrieve Manual Stock items with search, filters, sorting, summary KPIs, and pagination.
 */
export const getManualItems = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: false,
        message: 'Database offline',
        data: [],
        summary: {
          totalManualItems: 0,
          totalActiveItems: 0,
          totalConvertedItems: 0,
          totalStockAdded: 0,
          totalManualSales: 0,
          totalAvailableStock: 0,
          totalValuation: 0,
        },
        pagination: { page: 1, limit: 25, totalRecords: 0, totalPages: 0 },
      });
    }

    const {
      search = '',
      status = 'all',
      startDate,
      endDate,
      sortBy = 'lastDate_desc',
      page = 1,
      limit = 25,
    } = req.query;

    const query = {};
    const andClauses = [];

    // Search filter
    if (search && search.trim()) {
      const term = search.trim();
      andClauses.push({
        $or: [
          { manualCode: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { convertedItemCode: { $regex: term, $options: 'i' } },
          { supplier: { $regex: term, $options: 'i' } },
        ],
      });
    }

    // Status filter
    if (status && status !== 'all') {
      andClauses.push({ status: status.trim() });
    }

    // Date range filter
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      andClauses.push({ lastTransactionDate: dateQuery });
    }

    if (andClauses.length > 0) {
      query.$and = andClauses;
    }

    // Sorting
    let sortOptions = { lastTransactionDate: -1 };
    switch (sortBy) {
      case 'lastDate_asc':
        sortOptions = { lastTransactionDate: 1 };
        break;
      case 'code_asc':
        sortOptions = { manualCode: 1 };
        break;
      case 'code_desc':
        sortOptions = { manualCode: -1 };
        break;
      case 'description_asc':
        sortOptions = { description: 1 };
        break;
      case 'description_desc':
        sortOptions = { description: -1 };
        break;
      case 'stock_desc':
        sortOptions = { availableStock: -1 };
        break;
      case 'stock_asc':
        sortOptions = { availableStock: 1 };
        break;
      case 'sales_desc':
        sortOptions = { totalSalesQty: -1 };
        break;
      default:
        sortOptions = { lastTransactionDate: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = limit === 'all' ? 10000 : Math.max(1, parseInt(limit, 10) || 25);
    const skip = (pageNum - 1) * limitNum;

    const [items, totalRecords, allItemsForSummary] = await Promise.all([
      ManualItem.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ManualItem.countDocuments(query),
      ManualItem.find({}).lean(),
    ]);

    // Compute KPI Summary over all manual items
    let totalStockAdded = 0;
    let totalManualSales = 0;
    let totalAvailableStock = 0;
    let totalValuation = 0;
    let activeCount = 0;
    let convertedCount = 0;

    for (const it of allItemsForSummary) {
      const added = Number(it.totalStockAdded) || 0;
      const sales = Number(it.totalSalesQty) || 0;
      const avail = Math.round((added - sales) * 100) / 100;
      const cost = Number(it.costPrice) || 0;

      totalStockAdded += added;
      totalManualSales += sales;
      totalAvailableStock += avail;
      if (avail > 0 && cost > 0) {
        totalValuation += Math.round(avail * cost * 100) / 100;
      }

      if (it.status === 'Converted') {
        convertedCount++;
      } else {
        activeCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Manual items retrieved successfully',
      data: items,
      summary: {
        totalManualItems: allItemsForSummary.length,
        totalActiveItems: activeCount,
        totalConvertedItems: convertedCount,
        totalStockAdded: Math.round(totalStockAdded * 100) / 100,
        totalManualSales: Math.round(totalManualSales * 100) / 100,
        totalAvailableStock: Math.round(totalAvailableStock * 100) / 100,
        totalValuation: Math.round(totalValuation * 100) / 100,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/manual-items/:id
 * Retrieve a single manual item by ID
 */
export const getManualItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let item = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      item = await ManualItem.findById(id).lean();
    }
    if (!item) {
      item = await ManualItem.findOne({ manualCode: id }).lean();
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Manual item not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/manual-items/:id/history
 * Retrieve full transaction audit history for a manual item
 */
export const getManualItemHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    let manualItem = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      manualItem = await ManualItem.findById(id).lean();
    }
    if (!manualItem) {
      manualItem = await ManualItem.findOne({ manualCode: id }).lean();
    }

    if (!manualItem) {
      return res.status(404).json({
        success: false,
        message: 'Manual item not found',
      });
    }

    const transactions = await ManualStockTransaction.find({ manualItemId: manualItem._id })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      manualItem,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/manual-items/add-stock
 * Controlled stock receipt for a manual item.
 * Records supplier, purchase cost, reference number, and increments available stock.
 */
export const addManualStock = async (req, res, next) => {
  try {
    const {
      manualItemId,
      manualCode,
      description,
      supplier = '',
      supplierCode = '',
      date = new Date(),
      quantity,
      costPrice,
      sellingPrice,
      location = 'Main Store',
      referenceNumber,
      notes = '',
    } = req.body;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity received must be a positive number greater than zero',
      });
    }

    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase cost cannot be negative',
      });
    }

    const sp = sellingPrice !== undefined && sellingPrice !== '' ? parseFloat(sellingPrice) : null;
    if (sp !== null && (isNaN(sp) || sp < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Selling price cannot be negative',
      });
    }

    const refNum = String(referenceNumber || '').trim();
    if (!refNum) {
      return res.status(400).json({
        success: false,
        message: 'Reference Number (e.g. Supplier Invoice/Delivery Note) is required',
      });
    }

    let manualItem = null;
    if (manualItemId && mongoose.Types.ObjectId.isValid(manualItemId)) {
      manualItem = await ManualItem.findById(manualItemId);
    } else if (manualCode) {
      manualItem = await ManualItem.findOne({ manualCode: manualCode.trim() });
    } else if (description) {
      manualItem = await ManualItem.findOne({
        normalizedDescription: description.trim().toLowerCase(),
      });
    }

    const txDate = date ? new Date(date) : new Date();

    if (!manualItem) {
      const cleanDesc = String(description || '').trim();
      if (!cleanDesc) {
        return res.status(400).json({
          success: false,
          message: 'Item description is required for new manual item',
        });
      }

      const generatedCode = manualCode && manualCode.trim()
        ? manualCode.trim()
        : await computeNextManualItemCode();

      manualItem = new ManualItem({
        manualCode: generatedCode,
        description: cleanDesc,
        normalizedDescription: cleanDesc.toLowerCase(),
        unit: 'PCS',
        sellingPrice: sp !== null ? sp : 0,
        costPrice: cost,
        totalSalesQty: 0,
        totalStockAdded: qty,
        availableStock: qty,
        firstTransactionDate: txDate,
        lastTransactionDate: txDate,
        status: 'Active',
        location: location || 'Main Store',
        supplier: supplier || '',
        supplierCode: supplierCode || '',
        notes: notes || '',
      });
      await manualItem.save();
    } else {
      // Prevent stock addition to already converted items
      if (manualItem.status === 'Converted') {
        return res.status(400).json({
          success: false,
          message: `This manual item has already been converted to Item Master code '${manualItem.convertedItemCode}'. Please use regular GRN to receive stock for converted items.`,
        });
      }

      manualItem.totalStockAdded = Math.round(((manualItem.totalStockAdded || 0) + qty) * 100) / 100;
      manualItem.availableStock = Math.round((manualItem.totalStockAdded - (manualItem.totalSalesQty || 0)) * 100) / 100;
      manualItem.costPrice = cost;
      if (sp !== null && sp > 0) manualItem.sellingPrice = sp;
      if (supplier) manualItem.supplier = supplier;
      if (supplierCode) manualItem.supplierCode = supplierCode;
      if (location) manualItem.location = location;
      manualItem.lastTransactionDate = txDate;
      await manualItem.save();
    }

    // Record stock receipt transaction
    const tx = new ManualStockTransaction({
      manualItemId: manualItem._id,
      manualCode: manualItem.manualCode,
      description: manualItem.description,
      transactionType: 'STOCK_ADDITION',
      date: txDate,
      referenceNumber: refNum,
      quantity: qty,
      unitPrice: manualItem.sellingPrice || 0,
      costPrice: cost,
      supplier: supplier || manualItem.supplier || '',
      supplierCode: supplierCode || manualItem.supplierCode || '',
      location: location || manualItem.location || 'Main Store',
      balanceAfter: manualItem.availableStock,
      performedBy: req.user?.username || 'Admin',
      notes: notes || `Stock addition via Ref #${refNum}`,
    });

    await tx.save();

    return res.status(200).json({
      success: true,
      message: `Successfully received ${qty} units for manual item '${manualItem.description}'. Available stock is now ${manualItem.availableStock}.`,
      data: manualItem,
      transaction: tx,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: An item or reference with this identifier already exists.',
        conflict: true,
      });
    }
    next(error);
  }
};

/**
 * POST /api/manual-items/convert
 * Convert a Manual Item into a formal Item Master record.
 * Transfers available stock exactly once, marks manual item as 'Converted',
 * and makes the item available for normal Sales Invoices.
 */
export const convertManualItem = async (req, res, next) => {
  try {
    const {
      manualItemId,
      targetCode,
      description,
      category = 'General',
      subCategory = '',
      location = 'Main Store',
      sellingPrice,
      costPrice,
      reorderLevel = 0,
      reorderQty = 0,
      supplier = '',
      supplierCode = '',
      barcode = '',
      unit = 'PCS',
      notes = '',
    } = req.body;

    if (!manualItemId) {
      return res.status(400).json({
        success: false,
        message: 'Manual item ID is required for conversion',
      });
    }

    const manualItem = await ManualItem.findById(manualItemId);
    if (!manualItem) {
      return res.status(404).json({
        success: false,
        message: 'Manual item record not found',
      });
    }

    // Prevent duplicate conversion
    if (manualItem.status === 'Converted') {
      return res.status(400).json({
        success: false,
        message: `This manual item has already been converted to Item Master code '${manualItem.convertedItemCode}' on ${manualItem.convertedAt?.toLocaleDateString() || 'earlier date'}. Duplicate conversion is prevented.`,
      });
    }

    const finalCode = String(targetCode || manualItem.manualCode || '').trim();
    if (!finalCode) {
      return res.status(400).json({
        success: false,
        message: 'Target Item Code is required for Item Master',
      });
    }

    const finalDesc = String(description || manualItem.description || '').trim();
    if (!finalDesc) {
      return res.status(400).json({
        success: false,
        message: 'Item Description is required for Item Master',
      });
    }

    // Check if targetCode already exists in Item Master
    const existingMaster = await Item.findOne({
      $or: [
        { code: { $regex: new RegExp(`^${finalCode}$`, 'i') } },
        ...(barcode ? [{ barcode: barcode.trim() }] : []),
      ],
    });

    if (existingMaster) {
      return res.status(409).json({
        success: false,
        message: `An Item with code '${finalCode}' already exists in Item Master. Please provide a unique Item Code.`,
        conflict: true,
      });
    }

    // Calculate eligible stock to transfer into Item Master (non-negative)
    const eligibleStock = Math.max(0, Math.round((Number(manualItem.availableStock) || 0) * 100) / 100);

    const finalSp = Math.max(0, parseFloat(sellingPrice !== undefined ? sellingPrice : manualItem.sellingPrice) || 0);
    const finalCp = Math.max(0, parseFloat(costPrice !== undefined ? costPrice : manualItem.costPrice) || 0);

    // 1. Create standard Item Master document
    const newItem = new Item({
      code: finalCode,
      description: finalDesc,
      category: category ? category.trim() : 'General',
      subCategory: subCategory ? subCategory.trim() : '',
      location: location ? location.trim() : 'Main Store',
      quantity: eligibleStock,
      stockInHand: eligibleStock,
      damagedStock: 0,
      sellingPrice: finalSp,
      finalSellingPrice: finalSp,
      costPrice: finalCp,
      averageCost: finalCp,
      lastGrnPrice: finalCp,
      reorderLevel: Math.max(0, parseFloat(reorderLevel) || 0),
      reorderQty: Math.max(0, parseFloat(reorderQty) || 0),
      supplier: (supplier || manualItem.supplier || '').trim(),
      supplierCode: (supplierCode || manualItem.supplierCode || '').trim(),
      suppCode: (supplierCode || manualItem.supplierCode || '').trim(),
      barcode: barcode ? barcode.trim() : '',
      unit: unit ? unit.trim() : (manualItem.unit || 'PCS'),
      status: 'A',
      remark: notes ? notes.trim() : `Converted from Manual Item ${manualItem.manualCode}`,
    });

    await newItem.save();

    // 2. Mark ManualItem as Converted & link references
    manualItem.status = 'Converted';
    manualItem.convertedItemCode = finalCode;
    manualItem.convertedItemId = newItem._id;
    manualItem.convertedAt = new Date();
    manualItem.convertedBy = req.user?.username || 'Admin';
    if (finalSp > 0) manualItem.sellingPrice = finalSp;
    if (finalCp > 0) manualItem.costPrice = finalCp;
    await manualItem.save();

    // 3. Record conversion transfer transaction
    const convTx = new ManualStockTransaction({
      manualItemId: manualItem._id,
      manualCode: manualItem.manualCode,
      description: manualItem.description,
      transactionType: 'CONVERSION_TRANSFER',
      date: new Date(),
      referenceNumber: `CONV-${finalCode}`,
      quantity: eligibleStock,
      unitPrice: finalSp,
      costPrice: finalCp,
      supplier: newItem.supplier || '',
      location: newItem.location || 'Main Store',
      balanceAfter: 0,
      performedBy: req.user?.username || 'Admin',
      notes: `Transferred ${eligibleStock} units to official Item Master record [${finalCode}]`,
    });

    await convTx.save();

    return res.status(200).json({
      success: true,
      message: `Successfully converted manual item '${manualItem.description}' into Item Master code '${finalCode}' with ${eligibleStock} units of initial stock.`,
      item: newItem,
      manualItem,
      transaction: convTx,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate key conflict: An item with this code or barcode already exists in Item Master.',
        conflict: true,
      });
    }
    next(error);
  }
};

/**
 * GET /api/manual-items/lookup
 * Autocomplete / search active manual items for Manual Invoice item entry
 */
export const lookupManualItems = async (req, res, next) => {
  try {
    const { q = '', limit = 1000 } = req.query;
    const query = {};
    if (q && q.trim()) {
      const term = q.trim();
      query.$or = [
        { manualCode: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
      ];
    }

    const limitNum = limit === 'all' || limit === '0' ? 0 : Math.max(Number(limit) || 1000, 1);
    let queryBuilder = ManualItem.find(query).sort({ lastTransactionDate: -1 });
    if (limitNum > 0) {
      queryBuilder = queryBuilder.limit(limitNum);
    }
    const items = await queryBuilder.lean();

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/manual-items/sync-history
 * Inspects all historical manual invoices and ensures any unregistered items
 * are catalogued in the Manual Stock system with exact historical sales quantities.
 */
export const syncHistoricalManualInvoices = async (req, res, next) => {
  try {
    const manualInvoices = await Invoice.find({
      $or: [
        { isManualInvoice: true },
        { invoiceType: 'Manual' },
        { invoiceNumber: { $regex: /^MAN-/i } },
      ],
    }).lean();

    let processedCount = 0;
    let createdCount = 0;

    for (const inv of manualInvoices) {
      if (!Array.isArray(inv.lineItems)) continue;

      for (const line of inv.lineItems) {
        const desc = (line.description || '').trim();
        const code = (line.code || line.itemCode || '').trim();
        if (!desc) continue;

        // Check if item exists in Item Master
        if (code) {
          const master = await Item.findOne({
            $or: [{ code }, { barcode: code }],
          }).lean();
          if (master) continue; // Already in Item Master
        }

        // Check if transaction already recorded for this invoice and item
        const existingTx = await ManualStockTransaction.findOne({
          referenceNumber: String(inv.invoiceNumber),
          description: desc,
          transactionType: 'MANUAL_SALE',
        });

        if (existingTx) continue; // Already recorded

        const result = await recordManualSaleItem({
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.date || inv.createdAt,
          lineItem: line,
          customerName: inv.customerName || inv.cusname || 'Walk In Customer',
          performedBy: 'System Migration',
        });

        if (result) {
          processedCount++;
          createdCount++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Historical sync completed. Processed ${processedCount} unregistered manual line items.`,
      processedCount,
      createdCount,
    });
  } catch (error) {
    next(error);
  }
};

