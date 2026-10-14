import mongoose from 'mongoose';
import CustomerDamageReturn from '../models/CustomerDamageReturn.js';
import SupplierDamageClaim from '../models/SupplierDamageClaim.js';
import DamageStockMovement from '../models/DamageStockMovement.js';
import Invoice from '../models/Invoice.js';
import Item from '../models/Item.js';
import Grn from '../models/Grn.js';
import Supplier from '../models/Supplier.js';
import Customer from '../models/Customer.js';

/**
 * Get next sequential return number (e.g. CDR-0001)
 */
export const getNextReturnNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'CDR' });
    const latestReturn = await CustomerDamageReturn.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const returnCurrent = latestReturn && Number(latestReturn.no) ? Number(latestReturn.no) : 0;
    const currentMax = Math.max(docCurrent, returnCurrent);
    const nextNo = currentMax + 1;
    const returnNumber = `CDR-${String(nextNo).padStart(4, '0')}`;

    return res.status(200).json({
      success: true,
      data: {
        no: nextNo,
        returnNumber,
        prefix: 'CDR',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get next sequential damage claim number (e.g. DC-2025-0008)
 */
export const getNextDamageClaimNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const currentYear = new Date().getFullYear();
    const docNum = await db.collection('docnumbers').findOne({ docType: 'DC' });
    
    // Find latest claim matching DC- pattern or highest numerical no
    const latestClaim = await CustomerDamageReturn.findOne({
      $or: [
        { claimNumber: new RegExp(`^DC-${currentYear}-`, 'i') },
        { claimNumber: /^DC-/i },
        { no: { $exists: true, $ne: null } },
      ],
    })
      .sort({ createdAt: -1, no: -1 })
      .lean();

    let docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    let claimCurrent = 0;

    if (latestClaim && latestClaim.claimNumber) {
      const match = latestClaim.claimNumber.match(/DC-\d{4}-(\d+)/i) || latestClaim.claimNumber.match(/DC-(\d+)/i);
      if (match && match[1]) {
        claimCurrent = parseInt(match[1], 10) || 0;
      }
    }
    if (latestClaim && Number(latestClaim.no) && Number(latestClaim.no) > claimCurrent) {
      claimCurrent = Number(latestClaim.no);
    }

    const currentMax = Math.max(docCurrent, claimCurrent);
    const nextNo = currentMax + 1;
    const claimNumber = `DC-${currentYear}-${String(nextNo).padStart(4, '0')}`;

    return res.status(200).json({
      success: true,
      data: {
        no: nextNo,
        claimNumber,
        year: currentYear,
        prefix: `DC-${currentYear}-`,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Look up original sales invoice by invoice number,
 * enrich customer details, and calculate previous return history per line item.
 */
export const getInvoiceForReturn = async (req, res, next) => {
  try {
    const { invoiceNumber } = req.params;
    if (!invoiceNumber || !invoiceNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number is required',
      });
    }

    const cleanInv = invoiceNumber.trim();
    const query = {
      $or: [
        { invoiceNumber: cleanInv },
        { invoiceNumber: new RegExp(`^${cleanInv}$`, 'i') },
      ],
    };

    if (!isNaN(cleanInv)) {
      query.$or.push({ no: Number(cleanInv) });
    }

    const invoice = await Invoice.findOne(query).lean();
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${cleanInv}' not found`,
      });
    }

    const invNum = invoice.invoiceNumber || String(invoice.no);

    // Fetch customer details if phone or address are missing
    let customer = {
      code: invoice.customerCode || invoice.cuscode || '',
      name: invoice.customerName || invoice.cusname || 'Walk-in Customer',
      telephone: invoice.customerTelephone || invoice.telephone || '',
      address: invoice.customerAddress || '',
    };

    if ((!customer.telephone || !customer.address) && customer.code) {
      const cusRecord = await Customer.findOne({
        $or: [
          { code: customer.code },
          { customerCode: customer.code },
        ],
      }).lean();

      if (cusRecord) {
        if (!customer.telephone) {
          customer.telephone = cusRecord.telephone || cusRecord.telephone1 || cusRecord.telephone2 || '';
        }
        if (!customer.address) {
          customer.address = cusRecord.address || '';
        }
      }
    }

    // Fetch all existing damage returns for this invoice to compute return limits
    const existingReturns = await CustomerDamageReturn.find({
      invoiceNumber: invNum,
      status: { $ne: 'CANCELLED' },
    }).lean();

    // Map previous returned quantities by item code
    const previousReturnsByItem = {};
    existingReturns.forEach((ret) => {
      const code = String(ret.returnedItem?.itemCode || '').trim().toUpperCase();
      if (code) {
        if (!previousReturnsByItem[code]) {
          previousReturnsByItem[code] = 0;
        }
        previousReturnsByItem[code] += Number(ret.returnedItem?.returnedQuantity || 0);
      }
    });

    // Fetch current live stock for each line item
    const lineItemCodes = (invoice.lineItems || []).map((li) => String(li.code || li.itemCode || '').trim()).filter(Boolean);
    const itemStockRecords = await Item.find({ code: { $in: lineItemCodes } }, 'code description quantity stockInHand damagedStock sellingPrice suppCode').lean();
    const itemStockMap = {};
    itemStockRecords.forEach((itm) => {
      itemStockMap[String(itm.code).trim().toUpperCase()] = itm;
    });

    // Enrich line items with returnable quantities and stock info
    const enrichedLineItems = (invoice.lineItems || []).map((li, idx) => {
      const itemCode = String(li.code || li.itemCode || '').trim();
      const codeUpper = itemCode.toUpperCase();
      const purchasedQty = Math.max(0, Number(li.quantity || li.qty || 1));
      const prevReturnedQty = Math.round((previousReturnsByItem[codeUpper] || 0) * 100) / 100;
      const availableReturnQty = Math.max(0, Math.round((purchasedQty - prevReturnedQty) * 100) / 100);
      const stockInfo = itemStockMap[codeUpper] || null;

      return {
        lineIndex: idx,
        itemCode,
        description: li.description || (stockInfo ? stockInfo.description : ''),
        purchasedQuantity: purchasedQty,
        previousReturnedQuantity: prevReturnedQty,
        availableReturnQuantity: availableReturnQty,
        canReturn: availableReturnQty > 0,
        unitPrice: Number(li.price || li.unitPrice || 0),
        discountAmount: Number(li.discountAmount || 0),
        total: Number(li.total || li.value || 0),
        currentSellableStock: stockInfo ? (Number(stockInfo.quantity) || Number(stockInfo.stockInHand) || 0) : 0,
        currentDamagedStock: stockInfo ? (Number(stockInfo.damagedStock) || 0) : 0,
        suppCode: stockInfo ? stockInfo.suppCode : '',
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        invoice: {
          _id: invoice._id,
          invoiceNumber: invNum,
          date: invoice.date,
          netTotal: invoice.netTotal || invoice.amountToPay || invoice.subTotal || 0,
          customer,
        },
        lineItems: enrichedLineItems,
        previousReturns: existingReturns,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supplier Traceability:
 * Inspect existing GRN records, supplier invoices, item purchase history, and stock records.
 * Identifies supplier(s), GRN #, purchase date, supplier invoice #, and telephone.
 */
export const getItemSupplierTraceability = async (req, res, next) => {
  try {
    const { itemCode } = req.params;
    if (!itemCode || !itemCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Item code is required',
      });
    }

    const cleanCode = itemCode.trim();
    const codeRegex = new RegExp(`^${cleanCode}$`, 'i');

    // 1. Query GRNs containing this item code in lineItems
    const matchingGrns = await Grn.find({
      $or: [
        { 'lineItems.code': codeRegex },
        { 'lineItems.itemCode': codeRegex },
      ],
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // 2. Fetch Supplier information for each supplierCode in matching GRNs
    const suppCodes = [...new Set(matchingGrns.map((g) => g.supplierCode).filter(Boolean))];
    const suppliers = await Supplier.find({ code: { $in: suppCodes } }).lean();
    const supplierMap = {};
    suppliers.forEach((s) => {
      supplierMap[String(s.code).trim().toUpperCase()] = s;
    });

    // 3. Inspect Item master record for suppCode, lastGrn, lastGrnPrice
    const itemMaster = await Item.findOne({ code: codeRegex }).lean();

    // 4. Construct Purchase History
    const purchaseHistory = matchingGrns.map((grn) => {
      const supp = supplierMap[String(grn.supplierCode).trim().toUpperCase()] || null;
      const matchedLine = (grn.lineItems || []).find(
        (li) =>
          String(li.code || li.itemCode || '').trim().toLowerCase() === cleanCode.toLowerCase()
      );

      return {
        grnId: grn._id,
        grnNumber: grn.grnNumber || String(grn.no),
        date: grn.date || grn.createdAt,
        supplierCode: grn.supplierCode,
        supplierName: grn.supplierName || (supp ? supp.name : 'Unknown Supplier'),
        supplierTelephone: supp ? (supp.telephone || supp.telephone1 || supp.telephone2 || '') : '',
        supplierAddress: supp ? supp.address : '',
        supplierInvoiceNo: grn.supplierInvoiceNo || grn.invoice || '',
        purchasedQuantity: matchedLine ? Number(matchedLine.quantity || matchedLine.qty || 0) : 0,
        unitPrice: matchedLine ? Number(matchedLine.unitPrice || matchedLine.rate || 0) : 0,
        batchInfo: grn.masterPo || matchedLine?.locationCode || '',
        remark: grn.remark || '',
      };
    });

    // 5. Determine source ambiguity:
    // If multiple distinct suppliers were used across GRNs, flag multiple sources
    const distinctSuppliers = [...new Set(purchaseHistory.map((p) => p.supplierCode))];
    const isSingleSource = distinctSuppliers.length === 1;

    let suggestedSupplier = null;
    if (purchaseHistory.length > 0) {
      // Most recent purchase as suggested default
      const latest = purchaseHistory[0];
      suggestedSupplier = {
        supplierCode: latest.supplierCode,
        supplierName: latest.supplierName,
        supplierTelephone: latest.supplierTelephone,
        supplierInvoiceNo: latest.supplierInvoiceNo,
        grnNumber: latest.grnNumber,
        purchaseDate: latest.date,
        batchInfo: latest.batchInfo,
        verificationStatus: isSingleSource ? 'VERIFIED' : 'SELECTED_FROM_HISTORY',
      };
    } else if (itemMaster && itemMaster.suppCode) {
      // Fallback to Item.suppCode if no GRN exists yet
      const supp = await Supplier.findOne({ code: itemMaster.suppCode }).lean();
      if (supp) {
        suggestedSupplier = {
          supplierCode: supp.code,
          supplierName: supp.name,
          supplierTelephone: supp.telephone || supp.telephone1 || '',
          supplierInvoiceNo: '',
          grnNumber: itemMaster.lastGrn || '',
          purchaseDate: null,
          batchInfo: '',
          verificationStatus: 'MANUAL_OVERRIDE',
        };
      }
    }

    // 6. Fetch all available suppliers so authorized user can choose if source differs
    const allSuppliers = await Supplier.find({}, 'code name telephone telephone1 address')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        itemCode: cleanCode,
        itemDescription: itemMaster ? itemMaster.description : '',
        purchaseHistory,
        distinctSuppliersCount: distinctSuppliers.length,
        isSingleSource,
        hasPurchaseHistory: purchaseHistory.length > 0,
        suggestedSupplier,
        allSuppliers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Customer Damage Return & Replacement
 * Handles validation, return limits, stock segregation, replacements, and supplier claims.
 */
export const createCustomerDamageReturn = async (req, res, next) => {
  try {
    const {
      claimNumber,
      claimDate,
      invoiceNumber,
      itemCode,
      returnedQuantity,
      returnReason,
      damageReason,
      damageNotes,
      notes,
      itemCondition,
      workflowType,
      returnType,
      disposition = 'QUARANTINE',
      damageStatus,
      inspection,
      replacement,
      verifiedSupplier,
      supplierDetails,
      remarks,
    } = req.body;

    // 0. Duplicate prevention if claimNumber is provided
    if (claimNumber && claimNumber.trim()) {
      const existingClaim = await CustomerDamageReturn.findOne({
        claimNumber: claimNumber.trim(),
      }).lean();
      if (existingClaim) {
        return res.status(409).json({
          success: false,
          message: `Damage Claim '${claimNumber.trim()}' has already been saved. Please click 'New' to start a new claim or 'Update' to modify.`,
          data: existingClaim,
        });
      }
    }

    // 1. Mandatory Validations
    if (!invoiceNumber || !invoiceNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Original invoice number is required' });
    }
    if (!itemCode || !itemCode.trim()) {
      return res.status(400).json({ success: false, message: 'Item code is required' });
    }
    const returnQtyNum = Number(returnedQuantity);
    if (isNaN(returnQtyNum) || returnQtyNum <= 0) {
      return res.status(400).json({ success: false, message: 'Returned quantity must be greater than zero' });
    }

    const effectiveReason = (damageReason || returnReason || 'Broken').trim();

    // Determine condition & workflow
    const isExchangeType =
      returnType === 'EXCHANGE' ||
      workflowType === 'EXCHANGE' ||
      itemCondition === 'GOOD' ||
      effectiveReason === 'Exchange — item is in good condition';

    const isGoodCondition = isExchangeType || inspection?.conditionResult === 'SELLABLE_STOCK';
    const finalWorkflow = isGoodCondition ? 'EXCHANGE' : 'DAMAGE_RETURN';
    const finalCondition = isGoodCondition ? 'GOOD' : 'DAMAGED';

    const cleanInv = invoiceNumber.trim();
    const cleanItemCode = itemCode.trim();

    // 2. Lookup Invoice & Line Item
    const invoice = await Invoice.findOne({
      $or: [
        { invoiceNumber: cleanInv },
        { invoiceNumber: new RegExp(`^${cleanInv}$`, 'i') },
      ],
    });
    if (!invoice) {
      return res.status(404).json({ success: false, message: `Invoice '${cleanInv}' does not exist` });
    }


    const matchedLine = (invoice.lineItems || []).find(
      (li) =>
        String(li.code || li.itemCode || '').trim().toLowerCase() === cleanItemCode.toLowerCase()
    );
    if (!matchedLine) {
      return res.status(400).json({
        success: false,
        message: `Item '${cleanItemCode}' was not found on Invoice '${cleanInv}'`,
      });
    }

    const purchasedQty = Math.max(0, Number(matchedLine.quantity || matchedLine.qty || 1));
    const returnedItemUnitPrice = Number(matchedLine.price || matchedLine.unitPrice || 0);

    // 3. Prevent returns exceeding original purchased quantity minus previous accepted returns
    const previousReturns = await CustomerDamageReturn.find({
      invoiceNumber: invoice.invoiceNumber || cleanInv,
      'returnedItem.itemCode': new RegExp(`^${cleanItemCode}$`, 'i'),
      status: { $ne: 'CANCELLED' },
    }).lean();

    const alreadyReturnedQty = previousReturns.reduce(
      (sum, r) => sum + (Number(r.returnedItem?.returnedQuantity) || 0),
      0
    );

    const availableToReturn = Math.max(0, Math.round((purchasedQty - alreadyReturnedQty) * 100) / 100);

    if (returnQtyNum > availableToReturn) {
      return res.status(400).json({
        success: false,
        message: `Returned quantity (${returnQtyNum}) exceeds allowable quantity (${availableToReturn}). Original purchased: ${purchasedQty}, Already returned: ${alreadyReturnedQty}.`,
      });
    }

    // 4. Replacement & Pricing Calculation (if replacement requested or disposition === 'REPLACEMENT')
    let replacementData = {
      issued: false,
      itemCode: '',
      description: '',
      quantity: 0,
      unitPrice: 0,
      valueDifference: 0,
      additionalPaymentRequired: 0,
      refundAmount: 0,
      settlementType: 'NONE',
      notes: '',
    };

    const hasReplacement =
      disposition === 'REPLACEMENT' ||
      (replacement && (replacement.itemCode || replacement.replacementItemCode));

    if (hasReplacement) {
      const replCode = replacement ? (replacement.itemCode || replacement.replacementItemCode || '').trim() : '';
      if (!replCode) {
        return res.status(400).json({
          success: false,
          message: 'Replacement item code is required when issuing an exchange / replacement',
        });
      }
      const replQty = Number(replacement.quantity || replacement.replacementQuantity || 1);
      if (isNaN(replQty) || replQty <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Replacement quantity must be greater than zero',
        });
      }

      const replItemCode = replCode;
      const replItem = await Item.findOne({ code: new RegExp(`^${replItemCode}$`, 'i') });
      if (!replItem) {
        return res.status(404).json({
          success: false,
          message: `Replacement item '${replItemCode}' not found in inventory`,
        });
      }

      // Check sellable stock of replacement item
      const curSellable = Math.max(0, Number(replItem.quantity || replItem.stockInHand || 0));
      if (curSellable < replQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient sellable stock for replacement item '${replItemCode}'. Available: ${curSellable}, Requested: ${replQty}`,
        });
      }

      const replItemUnitPrice = Number(replItem.finalSellingPrice || replItem.sellingPrice || 0);
      const valDiff = Math.round(((replItemUnitPrice * replQty) - (returnedItemUnitPrice * returnQtyNum)) * 100) / 100;

      let settlementType = 'EVEN';
      let addPay = 0;
      let refAmt = 0;

      if (valDiff > 0) {
        settlementType = 'CUSTOMER_PAYS_DIFFERENCE';
        addPay = valDiff;
      } else if (valDiff < 0) {
        settlementType = 'REFUND_TO_CUSTOMER';
        refAmt = Math.abs(valDiff);
      }

      replacementData = {
        issued: true,
        itemCode: replItem.code,
        description: replItem.description,
        quantity: replQty,
        unitPrice: replItemUnitPrice,
        valueDifference: valDiff,
        additionalPaymentRequired: addPay,
        refundAmount: refAmt,
        settlementType,
        notes: replacement.notes || '',
      };
    }

    // 5. Sequence generation for Return / Exchange Reference (CDR-XXXX & DC-YYYY-XXXX)
    const db = mongoose.connection.db;
    const currentYear = (claimDate ? new Date(claimDate) : new Date()).getFullYear();

    const docNum = await db.collection('docnumbers').findOne({ docType: 'CDR' });
    const latestReturn = await CustomerDamageReturn.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const returnCurrent = latestReturn && Number(latestReturn.no) ? Number(latestReturn.no) : 0;
    const nextNo = Math.max(docCurrent, returnCurrent) + 1;
    const finalReturnNumber = `CDR-${String(nextNo).padStart(4, '0')}`;

    // Manage Damage Claim Number (e.g. DC-2025-0008)
    let finalClaimNumber = (claimNumber || '').trim();
    if (!finalClaimNumber) {
      const dcDocNum = await db.collection('docnumbers').findOne({ docType: 'DC' });
      const dcDocCurrent = dcDocNum && Number(dcDocNum.currentNumber) ? Number(dcDocNum.currentNumber) : 0;
      const nextDcNo = Math.max(dcDocCurrent, nextNo);
      finalClaimNumber = `DC-${currentYear}-${String(nextDcNo).padStart(4, '0')}`;
    }

    // 6. Traceability structure (merging verifiedSupplier and supplierDetails)
    const suppSrc = supplierDetails || verifiedSupplier || {};
    const traceData = {
      supplierCode: suppSrc.supplierCode || '',
      supplierName: suppSrc.supplierName || '',
      supplierTelephone: suppSrc.supplierTelephone || '',
      supplierInvoiceNo: suppSrc.supplierInvoiceNo || '',
      grnNumber: suppSrc.grnNumber || '',
      purchaseDate: suppSrc.purchaseDate ? new Date(suppSrc.purchaseDate) : null,
      purchaseQuantity: Number(suppSrc.purchaseQuantity) || 0,
      batchInfo: suppSrc.batchInfo || '',
      verificationStatus: suppSrc.verificationStatus || 'VERIFIED',
      purchaseHistorySnapshot: suppSrc.purchaseHistorySnapshot || [],
      claimStatus: suppSrc.claimStatus || (isGoodCondition ? 'Resolved' : 'Claim to Supplier'),
      supplierNotes: suppSrc.supplierNotes || '',
    };

    // 7. Atomic Stock Updates & Segregation:
    if (isGoodCondition) {
      // WORKFLOW A — Good Item Returned for Exchange:
      // Item inspected and accepted back into normal sellable stock!
      await Item.updateOne(
        { code: new RegExp(`^${cleanItemCode}$`, 'i') },
        {
          $inc: {
            quantity: returnQtyNum,
            stockInHand: returnQtyNum,
          },
        }
      );
    } else {
      // WORKFLOW B — Damaged / Defective Item Returned:
      // Quarantine damaged goods into damagedStock. Do NOT increase normal sellable stock!
      await Item.updateOne(
        { code: new RegExp(`^${cleanItemCode}$`, 'i') },
        { $inc: { damagedStock: returnQtyNum } }
      );

      // Log DamageStockMovement audit trail
      try {
        const dsmDocNum = await db.collection('docnumbers').findOne({ docType: 'DSM' });
        const latestDsm = await DamageStockMovement.findOne({ no: { $exists: true, $ne: null } })
          .sort({ no: -1, createdAt: -1 })
          .lean();
        const dsmDocCurrent = dsmDocNum && Number(dsmDocNum.currentNumber) ? Number(dsmDocNum.currentNumber) : 0;
        const dsmLatestNo = latestDsm && Number(latestDsm.no) ? Number(latestDsm.no) : 0;
        const nextDsmNo = Math.max(dsmDocCurrent, dsmLatestNo) + 1;
        const dsmNumber = `DSM-${String(nextDsmNo).padStart(4, '0')}`;

        const damageMovement = new DamageStockMovement({
          movementNumber: dsmNumber,
          no: nextDsmNo,
          date: new Date(),
          itemCode: cleanItemCode,
          description: matchedLine.description || '',
          category: matchedLine.category || '',
          quantity: returnQtyNum,
          movementType: 'IN_CUSTOMER_RETURN',
          origin: 'CUSTOMER RETURN',
          referenceNumber: finalClaimNumber || finalReturnNumber,
          invoiceNumber: invoice.invoiceNumber || cleanInv,
          customerName: invoice.customerName || invoice.cusname || '',
          supplierCode: traceData.supplierCode || '',
          supplierName: traceData.supplierName || '',
          unitCost: returnedItemUnitPrice,
          totalValue: Math.round(returnedItemUnitPrice * returnQtyNum * 100) / 100,
          damageReason: effectiveReason,
          notes: notes || damageNotes || `Damage Claim ${finalClaimNumber} from invoice #${cleanInv}`,
          recordedBy: req.user?.username || req.user?.userCode || 'Admin',
        });
        await damageMovement.save();

        await db.collection('docnumbers').updateOne(
          { docType: 'DSM' },
          { $set: { currentNumber: nextDsmNo, prefix: 'DSM', padding: 4 } },
          { upsert: true }
        );
      } catch (dsmErr) {
        console.warn('Failed to log DSM record:', dsmErr);
      }
    }

    // If a replacement is issued, deduct replacement item from sellable stock
    if (replacementData.issued) {
      await Item.updateOne(
        { code: new RegExp(`^${replacementData.itemCode}$`, 'i') },
        {
          $inc: {
            quantity: -replacementData.quantity,
            stockInHand: -replacementData.quantity,
          },
        }
      );
    }

    // 8. If disposition === 'SUPPLIER_CLAIM' or damage workflow with supplier details
    let linkedClaim = null;
    const shouldLinkSupplierClaim =
      disposition === 'SUPPLIER_CLAIM' ||
      (!isGoodCondition && (traceData.supplierName || traceData.supplierCode));

    if (shouldLinkSupplierClaim) {
      const claimDocNum = await db.collection('docnumbers').findOne({ docType: 'SDC' });
      const latestClaim = await SupplierDamageClaim.findOne({ no: { $exists: true, $ne: null } })
        .sort({ no: -1, createdAt: -1 })
        .lean();
      const claimDocCurrent = claimDocNum && Number(claimDocNum.currentNumber) ? Number(claimDocNum.currentNumber) : 0;
      const claimLatestNo = latestClaim && Number(latestClaim.no) ? Number(latestClaim.no) : 0;
      const nextClaimNo = Math.max(claimDocCurrent, claimLatestNo) + 1;
      const supplierClaimNum = `SDC-${String(nextClaimNo).padStart(4, '0')}`;

      linkedClaim = new SupplierDamageClaim({
        claimNumber: supplierClaimNum,
        no: nextClaimNo,
        date: new Date(),
        customerReturnNumber: finalClaimNumber || finalReturnNumber,
        supplierCode: traceData.supplierCode || 'GEN-SUPP',
        supplierName: traceData.supplierName || 'General Supplier / Inspection',
        supplierTelephone: traceData.supplierTelephone || '',
        supplierInvoiceNo: traceData.supplierInvoiceNo || '',
        grnNumber: traceData.grnNumber || '',
        itemCode: cleanItemCode,
        description: matchedLine.description || '',
        quantity: returnQtyNum,
        unitCost: Number(matchedLine.itemCost || matchedLine.price || 0),
        totalValue: Math.round(Number(matchedLine.itemCost || matchedLine.price || 0) * returnQtyNum * 100) / 100,
        damageReason: effectiveReason,
        claimStatus: traceData.claimStatus === 'Claim to Supplier' ? 'PENDING' : (traceData.claimStatus || 'PENDING'),
        notes: `Damage Claim #${finalClaimNumber}. ${notes || damageNotes || traceData.supplierNotes || ''}`.trim(),
        createdBy: req.user?.username || req.user?.userCode || 'Admin',
      });

      await linkedClaim.save();

      // Update SDC docnumbers
      await db.collection('docnumbers').updateOne(
        { docType: 'SDC' },
        { $set: { currentNumber: nextClaimNo, prefix: 'SDC', padding: 4 } },
        { upsert: true }
      );
    }

    // Determine initial damage status
    const initialDamageStatus = isGoodCondition
      ? 'COMPLETED_EXCHANGE'
      : (damageStatus || (traceData.claimStatus ? traceData.claimStatus.toUpperCase() : 'RECEIVED'));

    // 9. Save Customer Damage Return / Claim Document
    const parsedClaimDate = claimDate ? new Date(claimDate) : new Date();

    const customerReturn = new CustomerDamageReturn({
      returnNumber: finalReturnNumber,
      claimNumber: finalClaimNumber,
      claimDate: parsedClaimDate,
      no: nextNo,
      date: parsedClaimDate,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber || cleanInv,
      invoiceDate: invoice.date,
      customerCode: invoice.customerCode || invoice.cuscode || '',
      customerName: invoice.customerName || invoice.cusname || 'Walk-in Customer',
      customerTelephone: invoice.customerTelephone || invoice.telephone || '',
      customerAddress: invoice.customerAddress || '',
      returnedItem: {
        itemCode: cleanItemCode,
        description: matchedLine.description || '',
        purchasedQuantity: purchasedQty,
        unitPrice: returnedItemUnitPrice,
        returnedQuantity: returnQtyNum,
        returnReason: effectiveReason,
        damageReason: effectiveReason,
        itemCondition: finalCondition,
        damageNotes: (notes || damageNotes || '').trim(),
      },
      workflowType: finalWorkflow,
      itemCondition: finalCondition,
      disposition: isGoodCondition ? 'REPLACEMENT' : disposition,
      damageStatus: initialDamageStatus,
      inspection: {
        inspected: Boolean(inspection?.inspected || isGoodCondition),
        inspectedBy: inspection?.inspectedBy || req.user?.username || 'Admin',
        inspectionDate: new Date(),
        conditionResult: isGoodCondition ? 'SELLABLE_STOCK' : (inspection?.conditionResult || 'DAMAGED_QUARANTINE'),
        inspectionNotes: inspection?.inspectionNotes || '',
      },
      replacement: replacementData,
      supplierTraceability: traceData,
      supplierClaimId: linkedClaim ? linkedClaim._id : undefined,
      supplierClaimNumber: linkedClaim ? linkedClaim.claimNumber : finalClaimNumber,
      supplierClaim: {
        claimNumber: finalClaimNumber,
        supplierCode: traceData.supplierCode || '',
        supplierName: traceData.supplierName || '',
        supplierTelephone: traceData.supplierTelephone || '',
        supplierInvoiceNo: traceData.supplierInvoiceNo || '',
        grnNumber: traceData.grnNumber || '',
        claimDate: parsedClaimDate,
        claimStatus: traceData.claimStatus || (isGoodCondition ? 'Resolved' : 'Claim to Supplier'),
        resolutionType: isGoodCondition ? 'EXCHANGE' : 'PENDING',
        notes: traceData.supplierNotes || notes || '',
      },
      status: 'COMPLETED',
      stockUpdated: true,
      createdBy: req.user?.username || req.user?.userCode || 'Admin',
      remarks: remarks || notes || '',
    });

    await customerReturn.save();

    // 10. Update docnumbers sequence for CDR and DC
    await db.collection('docnumbers').updateOne(
      { docType: 'CDR' },
      { $set: { currentNumber: nextNo, prefix: 'CDR', padding: 4 } },
      { upsert: true }
    );

    const matchDcNo = finalClaimNumber.match(/DC-\d{4}-(\d+)/i) || finalClaimNumber.match(/DC-(\d+)/i);
    const dcNumeric = matchDcNo && matchDcNo[1] ? parseInt(matchDcNo[1], 10) : nextNo;
    await db.collection('docnumbers').updateOne(
      { docType: 'DC' },
      { $set: { currentNumber: dcNumeric, prefix: `DC-${currentYear}-`, padding: 4 } },
      { upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: `Damage Claim '${finalClaimNumber}' recorded successfully`,
      data: {
        claimNumber: finalClaimNumber,
        returnNumber: customerReturn.returnNumber,
        returnRecord: customerReturn,
        claimRecord: linkedClaim,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update existing Customer Damage Claim
 * Allows updating claim status, supplier notes, supplier details, or receiving replacement goods
 */
export const updateCustomerDamageClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      claimStatus,
      supplierDetails,
      supplierNotes,
      damageNotes,
      notes,
      damageReason,
      remarks,
      replacementReceived,
    } = req.body;

    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      query = {
        $or: [
          { claimNumber: id.trim() },
          { returnNumber: id.trim() },
        ],
      };
    }

    const claimRecord = await CustomerDamageReturn.findOne(query);
    if (!claimRecord) {
      return res.status(404).json({
        success: false,
        message: `Damage Claim '${id}' not found`,
      });
    }

    // Update supplier details
    if (supplierDetails) {
      if (!claimRecord.supplierTraceability) {
        claimRecord.supplierTraceability = {};
      }
      if (supplierDetails.supplierName) claimRecord.supplierTraceability.supplierName = supplierDetails.supplierName;
      if (supplierDetails.supplierTelephone) claimRecord.supplierTraceability.supplierTelephone = supplierDetails.supplierTelephone;
      if (supplierDetails.supplierInvoiceNo) claimRecord.supplierTraceability.supplierInvoiceNo = supplierDetails.supplierInvoiceNo;
      if (supplierDetails.grnNumber) claimRecord.supplierTraceability.grnNumber = supplierDetails.grnNumber;
      if (supplierDetails.purchaseDate) claimRecord.supplierTraceability.purchaseDate = new Date(supplierDetails.purchaseDate);
      if (supplierDetails.purchaseQuantity !== undefined) claimRecord.supplierTraceability.purchaseQuantity = Number(supplierDetails.purchaseQuantity);
      if (supplierDetails.claimStatus) claimRecord.supplierTraceability.claimStatus = supplierDetails.claimStatus;
      if (supplierDetails.supplierNotes) claimRecord.supplierTraceability.supplierNotes = supplierDetails.supplierNotes;
    }

    if (claimStatus) {
      if (!claimRecord.supplierClaim) claimRecord.supplierClaim = {};
      claimRecord.supplierClaim.claimStatus = claimStatus;
      if (claimRecord.supplierTraceability) {
        claimRecord.supplierTraceability.claimStatus = claimStatus;
      }
      claimRecord.damageStatus = claimStatus.toUpperCase();
    }

    if (supplierNotes) {
      if (!claimRecord.supplierClaim) claimRecord.supplierClaim = {};
      claimRecord.supplierClaim.notes = supplierNotes;
      if (claimRecord.supplierTraceability) {
        claimRecord.supplierTraceability.supplierNotes = supplierNotes;
      }
    }

    if (damageReason && claimRecord.returnedItem) {
      claimRecord.returnedItem.damageReason = damageReason;
      claimRecord.returnedItem.returnReason = damageReason;
    }

    if (damageNotes || notes) {
      const combinedNotes = (notes || damageNotes || '').trim();
      if (claimRecord.returnedItem) {
        claimRecord.returnedItem.damageNotes = combinedNotes;
      }
      claimRecord.remarks = combinedNotes;
    }

    if (remarks) {
      claimRecord.remarks = remarks;
    }

    // If replacement was physically received from supplier and accepted
    if (replacementReceived && Number(replacementReceived.quantityReceived) > 0) {
      if (!claimRecord.supplierClaim?.replacementReceived?.received) {
        const qtyRec = Number(replacementReceived.quantityReceived);
        const targetItemCode = replacementReceived.replacementItemCode || claimRecord.returnedItem?.itemCode;
        const replItem = await Item.findOne({ code: new RegExp(`^${targetItemCode}$`, 'i') });

        if (replItem) {
          // Increment sellable stock and decrement damaged quarantine stock
          await Item.updateOne(
            { _id: replItem._id },
            {
              $inc: {
                quantity: qtyRec,
                stockInHand: qtyRec,
                damagedStock: -qtyRec,
              },
            }
          );
          await Item.updateOne(
            { _id: replItem._id, damagedStock: { $lt: 0 } },
            { $set: { damagedStock: 0 } }
          );

          if (!claimRecord.supplierClaim) claimRecord.supplierClaim = {};
          claimRecord.supplierClaim.replacementReceived = {
            received: true,
            receivedDate: new Date(),
            quantityReceived: qtyRec,
            replacementItemCode: replItem.code,
            receivedBy: req.user?.username || 'Admin',
          };
          claimRecord.damageStatus = 'RESOLVED';
          claimRecord.supplierClaim.claimStatus = 'Replaced';
        }
      }
    }

    await claimRecord.save();

    return res.status(200).json({
      success: true,
      message: `Damage Claim '${claimRecord.claimNumber || claimRecord.returnNumber}' updated successfully`,
      data: claimRecord,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Update Return Inspection Result & Damage Status
 */
export const updateReturnInspectionAndStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      damageStatus,
      conditionResult, // 'SELLABLE_STOCK', 'DAMAGED_QUARANTINE', 'REJECTED_RETURN'
      inspectionNotes,
      inspectedBy,
    } = req.body;

    const returnRecord = await CustomerDamageReturn.findById(id);
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: 'Return record not found' });
    }

    if (damageStatus) {
      returnRecord.damageStatus = damageStatus;
    }

    returnRecord.inspection = {
      inspected: true,
      inspectedBy: inspectedBy || req.user?.username || 'Admin',
      inspectionDate: new Date(),
      conditionResult: conditionResult || returnRecord.inspection?.conditionResult || 'DAMAGED_QUARANTINE',
      inspectionNotes: inspectionNotes || returnRecord.inspection?.inspectionNotes || '',
    };

    // If inspection proves the quarantined item is good / sellable stock:
    // Move from damagedStock to normal sellable stock
    if (
      conditionResult === 'SELLABLE_STOCK' &&
      returnRecord.returnedItem?.itemCondition !== 'GOOD'
    ) {
      const itemCode = returnRecord.returnedItem?.itemCode;
      const qty = Number(returnRecord.returnedItem?.returnedQuantity || 1);

      await Item.updateOne(
        { code: new RegExp(`^${itemCode}$`, 'i') },
        {
          $inc: {
            damagedStock: -qty,
            quantity: qty,
            stockInHand: qty,
          },
        }
      );

      // Log movement restoring stock
      try {
        const db = mongoose.connection.db;
        const dsmDocNum = await db.collection('docnumbers').findOne({ docType: 'DSM' });
        const latestDsm = await DamageStockMovement.findOne({ no: { $exists: true, $ne: null } })
          .sort({ no: -1, createdAt: -1 })
          .lean();
        const dsmDocCurrent = dsmDocNum && Number(dsmDocNum.currentNumber) ? Number(dsmDocNum.currentNumber) : 0;
        const dsmLatestNo = latestDsm && Number(latestDsm.no) ? Number(latestDsm.no) : 0;
        const nextDsmNo = Math.max(dsmDocCurrent, dsmLatestNo) + 1;
        const dsmNumber = `DSM-${String(nextDsmNo).padStart(4, '0')}`;

        const damageMovement = new DamageStockMovement({
          movementNumber: dsmNumber,
          no: nextDsmNo,
          date: new Date(),
          itemCode,
          description: returnRecord.returnedItem?.description || '',
          quantity: qty,
          movementType: 'OUT_RESTORED_TO_SELLABLE',
          origin: 'STOCK ADJUSTMENT',
          referenceNumber: returnRecord.returnNumber,
          notes: `Inspection result: Approved for sellable inventory. Notes: ${inspectionNotes || ''}`,
          recordedBy: inspectedBy || 'Admin',
        });
        await damageMovement.save();

        await db.collection('docnumbers').updateOne(
          { docType: 'DSM' },
          { $set: { currentNumber: nextDsmNo, prefix: 'DSM', padding: 4 } },
          { upsert: true }
        );
      } catch (e) {
        console.warn('Failed to log DSM on inspection update:', e);
      }

      returnRecord.returnedItem.itemCondition = 'GOOD';
    }

    await returnRecord.save();

    return res.status(200).json({
      success: true,
      message: `Return '${returnRecord.returnNumber}' inspection updated successfully`,
      data: returnRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all customer damage returns with search and pagination
 */
export const getCustomerDamageReturns = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      disposition = '',
      status = '',
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {};

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { returnNumber: regex },
        { invoiceNumber: regex },
        { customerName: regex },
        { customerTelephone: regex },
        { 'returnedItem.itemCode': regex },
        { 'returnedItem.description': regex },
        { 'supplierTraceability.supplierName': regex },
      ];
    }

    if (disposition && disposition.trim()) {
      query.disposition = disposition.trim();
    }

    if (status && status.trim()) {
      query.status = status.trim();
    }

    const [returns, totalCount] = await Promise.all([
      CustomerDamageReturn.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      CustomerDamageReturn.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: returns,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalCount,
        pages: Math.ceil(totalCount / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all damaged items recorded through the Damage Claim workflow
 * Supports search, item filter, invoice filter, supplier filter, claim status filter, and date ranges.
 * Strictly read-only: does not alter stock quantities or create duplicate records.
 */
export const getDamageItems = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      claimNumber = '',
      invoiceNumber = '',
      itemCode = '',
      supplier = '',
      claimStatus = '',
      startDate = '',
      endDate = '',
      fromDate = '',
      toDate = '',
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const andConditions = [];

    // Filter to damaged workflow records
    andConditions.push({
      $or: [
        { workflowType: 'DAMAGE_RETURN' },
        { workflowType: { $ne: 'EXCHANGE' } },
        { itemCondition: { $ne: 'GOOD' } },
        { 'returnedItem.itemCondition': { $ne: 'GOOD' } },
      ],
    });

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      andConditions.push({
        $or: [
          { claimNumber: regex },
          { returnNumber: regex },
          { invoiceNumber: regex },
          { customerName: regex },
          { customerTelephone: regex },
          { 'returnedItem.itemCode': regex },
          { 'returnedItem.description': regex },
          { 'returnedItem.damageReason': regex },
          { 'supplierTraceability.supplierName': regex },
          { 'supplierTraceability.supplierInvoiceNo': regex },
          { 'supplierTraceability.grnNumber': regex },
          { 'supplierClaim.claimStatus': regex },
        ],
      });
    }

    if (claimNumber && claimNumber.trim()) {
      const cRegex = new RegExp(claimNumber.trim(), 'i');
      andConditions.push({
        $or: [{ claimNumber: cRegex }, { returnNumber: cRegex }],
      });
    }

    if (invoiceNumber && invoiceNumber.trim()) {
      andConditions.push({
        invoiceNumber: new RegExp(invoiceNumber.trim(), 'i'),
      });
    }

    if (itemCode && itemCode.trim()) {
      const iRegex = new RegExp(itemCode.trim(), 'i');
      andConditions.push({
        $or: [
          { 'returnedItem.itemCode': iRegex },
          { 'returnedItem.description': iRegex },
        ],
      });
    }

    if (supplier && supplier.trim()) {
      const sRegex = new RegExp(supplier.trim(), 'i');
      andConditions.push({
        $or: [
          { 'supplierTraceability.supplierName': sRegex },
          { 'supplierTraceability.supplierCode': sRegex },
          { 'supplierClaim.supplierName': sRegex },
        ],
      });
    }

    if (claimStatus && claimStatus.trim() && claimStatus.toLowerCase() !== 'all') {
      const stRegex = new RegExp(`^${claimStatus.trim()}$`, 'i');
      andConditions.push({
        $or: [
          { 'supplierClaim.claimStatus': stRegex },
          { 'supplierTraceability.claimStatus': stRegex },
          { damageStatus: stRegex },
        ],
      });
    }

    const start = startDate || fromDate;
    const end = endDate || toDate;
    if (start || end) {
      const dateRange = {};
      if (start) {
        dateRange.$gte = new Date(start);
      }
      if (end) {
        const eDate = new Date(end);
        eDate.setHours(23, 59, 59, 999);
        dateRange.$lte = eDate;
      }
      andConditions.push({
        $or: [
          { claimDate: dateRange },
          { date: dateRange },
          { createdAt: dateRange },
        ],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const [damageClaims, totalCount] = await Promise.all([
      CustomerDamageReturn.find(query)
        .sort({ claimDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      CustomerDamageReturn.countDocuments(query),
    ]);

    // Format item records for the Damage Items screen
    const formattedItems = damageClaims.map((claim) => ({
      _id: claim._id,
      claimNumber: claim.claimNumber || claim.returnNumber || `DC-${claim.no}`,
      claimDate: claim.claimDate || claim.date || claim.createdAt,
      invoiceNumber: claim.invoiceNumber,
      invoiceDate: claim.invoiceDate,
      customerName: claim.customerName || 'Walk-in Customer',
      customerTelephone: claim.customerTelephone || '',
      itemCode: claim.returnedItem?.itemCode || '',
      itemDescription: claim.returnedItem?.description || '',
      damagedQuantity: Number(claim.returnedItem?.returnedQuantity || 0),
      unitPrice: Number(claim.returnedItem?.unitPrice || 0),
      damageReason: claim.returnedItem?.damageReason || claim.returnedItem?.returnReason || 'Broken',
      damageNotes: claim.returnedItem?.damageNotes || claim.remarks || '',
      supplierName:
        claim.supplierTraceability?.supplierName ||
        claim.supplierClaim?.supplierName ||
        'N/A',
      supplierCode: claim.supplierTraceability?.supplierCode || '',
      supplierTelephone: claim.supplierTraceability?.supplierTelephone || '',
      supplierInvoiceNo: claim.supplierTraceability?.supplierInvoiceNo || '',
      grnNumber: claim.supplierTraceability?.grnNumber || '',
      purchaseDate: claim.supplierTraceability?.purchaseDate || null,
      purchaseQuantity: Number(claim.supplierTraceability?.purchaseQuantity || 0),
      claimStatus:
        claim.supplierClaim?.claimStatus ||
        claim.supplierTraceability?.claimStatus ||
        claim.damageStatus ||
        'Pending',
      supplierNotes:
        claim.supplierTraceability?.supplierNotes ||
        claim.supplierClaim?.notes ||
        '',
      workflowType: claim.workflowType,
      itemCondition: claim.itemCondition,
      replacementReceived: claim.supplierClaim?.replacementReceived || null,
      rawClaim: claim,
    }));

    return res.status(200).json({
      success: true,
      data: formattedItems,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalCount,
        pages: Math.ceil(totalCount / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get single customer damage return details
 */
export const getCustomerDamageReturnById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      query = { returnNumber: id.trim() };
    }

    const returnRecord = await CustomerDamageReturn.findOne(query).lean();
    if (!returnRecord) {
      return res.status(404).json({
        success: false,
        message: 'Customer damage return record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: returnRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Supplier Claim & Resolution directly on a Customer Return Record
 * Manages:
 * - Claim status updates (CLAIM PENDING, SENT_TO_SUPPLIER, REPLACEMENT_APPROVED, etc.)
 * - Physical replacement goods receipt from supplier (increments sellable stock, releases quarantine)
 * - Supplier credit notes / refunds
 */
export const updateReturnSupplierClaimAndResolution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      claimStatus,
      resolutionType,
      supplierResponse,
      creditNoteReference,
      replacementReceived,
      notes,
    } = req.body;

    const returnRecord = await CustomerDamageReturn.findById(id);
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: 'Customer return record not found' });
    }

    if (!returnRecord.supplierClaim) {
      returnRecord.supplierClaim = {};
    }

    // 1. If Physical Replacement is received from supplier:
    if (replacementReceived && Number(replacementReceived.quantityReceived) > 0) {
      if (returnRecord.supplierClaim?.replacementReceived?.received) {
        return res.status(400).json({
          success: false,
          message: 'Supplier replacement has already been accepted and processed for this return',
        });
      }

      const qtyRec = Number(replacementReceived.quantityReceived);
      const targetItemCode = replacementReceived.replacementItemCode || returnRecord.returnedItem?.itemCode;
      const replItem = await Item.findOne({ code: new RegExp(`^${targetItemCode}$`, 'i') });

      if (!replItem) {
        return res.status(404).json({
          success: false,
          message: `Replacement item '${targetItemCode}' not found in inventory`,
        });
      }

      // Atomically increment sellable stock and release from quarantine
      await Item.updateOne(
        { _id: replItem._id },
        {
          $inc: {
            quantity: qtyRec,
            stockInHand: qtyRec,
            damagedStock: -qtyRec,
          },
        }
      );

      // Ensure damagedStock does not drop below 0
      await Item.updateOne(
        { _id: replItem._id, damagedStock: { $lt: 0 } },
        { $set: { damagedStock: 0 } }
      );

      // Log DamageStockMovement audit trail
      try {
        const db = mongoose.connection.db;
        const dsmDocNum = await db.collection('docnumbers').findOne({ docType: 'DSM' });
        const latestDsm = await DamageStockMovement.findOne({ no: { $exists: true, $ne: null } })
          .sort({ no: -1, createdAt: -1 })
          .lean();
        const dsmDocCurrent = dsmDocNum && Number(dsmDocNum.currentNumber) ? Number(dsmDocNum.currentNumber) : 0;
        const dsmLatestNo = latestDsm && Number(latestDsm.no) ? Number(latestDsm.no) : 0;
        const nextDsmNo = Math.max(dsmDocCurrent, dsmLatestNo) + 1;
        const dsmNumber = `DSM-${String(nextDsmNo).padStart(4, '0')}`;

        const damageMovement = new DamageStockMovement({
          movementNumber: dsmNumber,
          no: nextDsmNo,
          date: new Date(),
          itemCode: replItem.code,
          description: replItem.description || '',
          quantity: qtyRec,
          movementType: 'OUT_REPLACED_BY_SUPPLIER',
          origin: 'SUPPLIER DAMAGE',
          referenceNumber: returnRecord.supplierClaimNumber || returnRecord.returnNumber,
          supplierCode: returnRecord.supplierTraceability?.supplierCode || '',
          supplierName: returnRecord.supplierTraceability?.supplierName || '',
          notes: `Supplier replacement received for Return #${returnRecord.returnNumber}. ${replacementReceived.deliveryNoteNo ? `DO #${replacementReceived.deliveryNoteNo}` : ''}`.trim(),
          recordedBy: req.user?.username || req.user?.userCode || 'Admin',
        });
        await damageMovement.save();

        await db.collection('docnumbers').updateOne(
          { docType: 'DSM' },
          { $set: { currentNumber: nextDsmNo, prefix: 'DSM', padding: 4 } },
          { upsert: true }
        );
      } catch (dsmErr) {
        console.warn('Failed to log DSM on supplier replacement:', dsmErr);
      }

      returnRecord.supplierClaim.replacementReceived = {
        received: true,
        receivedDate: replacementReceived.receivedDate ? new Date(replacementReceived.receivedDate) : new Date(),
        quantityReceived: qtyRec,
        replacementItemCode: replItem.code,
        deliveryNoteNo: replacementReceived.deliveryNoteNo || '',
        receivedBy: replacementReceived.receivedBy || (req.user?.username || 'Stores'),
      };

      returnRecord.damageStatus = 'RESOLVED';
      returnRecord.status = 'COMPLETED';
      returnRecord.supplierClaim.claimStatus = 'REPLACEMENT_RECEIVED';
      returnRecord.supplierClaim.resolutionType = 'REPLACEMENT';

      // Synchronize linked claim document if present
      if (returnRecord.supplierClaimId) {
        await SupplierDamageClaim.updateOne(
          { _id: returnRecord.supplierClaimId },
          {
            $set: {
              claimStatus: 'REPLACEMENT_RECEIVED',
              resolutionDate: new Date(),
              'replacementReceipt.received': true,
              'replacementReceipt.quantityReceived': qtyRec,
              'replacementReceipt.replacementItemCode': replItem.code,
              'replacementReceipt.deliveryNoteNo': replacementReceived.deliveryNoteNo || '',
              'replacementReceipt.stockIncremented': true,
            },
          }
        );
      }
    } else {
      if (claimStatus) {
        returnRecord.supplierClaim.claimStatus = claimStatus;
        if (claimStatus === 'RESOLVED' || claimStatus === 'CREDIT_NOTE_ISSUED') {
          returnRecord.damageStatus = 'RESOLVED';
          returnRecord.status = 'COMPLETED';
        }
      }
      if (resolutionType) {
        returnRecord.supplierClaim.resolutionType = resolutionType;
      }
      if (creditNoteReference) {
        returnRecord.supplierClaim.creditNoteReference = creditNoteReference;
      }
    }

    if (supplierResponse) {
      returnRecord.supplierClaim.supplierResponse = supplierResponse;
    }
    if (notes) {
      returnRecord.supplierClaim.notes = notes;
    }

    await returnRecord.save();

    return res.status(200).json({
      success: true,
      message: `Supplier claim for Return '${returnRecord.returnNumber}' updated successfully`,
      data: returnRecord,
    });
  } catch (error) {
    next(error);
  }
};

