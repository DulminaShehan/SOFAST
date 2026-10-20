import mongoose from 'mongoose';
import Item from '../models/Item.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Format and normalize item document
 */
const normalizeItem = (item) => {
  if (!item) return null;
  const stock = item.quantity !== undefined ? item.quantity : (item.stockInHand !== undefined ? item.stockInHand : 0);
  const sp = item.sellingPrice !== undefined ? Number(item.sellingPrice) : 0;
  const roundOffOption = item.roundOffOption || 'No Round Off';
  const roundOffStep = item.roundOffStep !== undefined && Number(item.roundOffStep) > 0 ? Number(item.roundOffStep) : 5;
  let discPct = item.discountPercentage !== undefined ? Number(item.discountPercentage) : 0;
  let discAmt = item.discountAmount !== undefined ? Number(item.discountAmount) : 0;

  if (discPct > 0 && (!discAmt || discAmt === 0)) {
    discAmt = (sp * discPct) / 100;
  } else if (discAmt > 0 && (!discPct || discPct === 0)) {
    discPct = sp > 0 ? (discAmt / sp) * 100 : 0;
  }

  const discountedPrice = item.discountedPrice !== undefined && Number(item.discountedPrice) > 0
    ? Number(item.discountedPrice)
    : Math.max(0, sp - discAmt);

  let finalSellingPrice = item.finalSellingPrice !== undefined && Number(item.finalSellingPrice) > 0 ? Number(item.finalSellingPrice) : 0;
  if (!finalSellingPrice) {
    if (roundOffOption === 'Round Up') {
      finalSellingPrice = Math.ceil(discountedPrice / roundOffStep) * roundOffStep;
    } else if (roundOffOption === 'Round Down') {
      finalSellingPrice = Math.floor(discountedPrice / roundOffStep) * roundOffStep;
    } else {
      finalSellingPrice = discountedPrice > 0 ? discountedPrice : sp;
    }
  }

  return {
    _id: item._id,
    code: item.code || '',
    suppCode: item.suppCode || '',
    type: item.type || 'Item',
    description: item.description || '',
    category: item.category || '',
    subCategory: item.subCategory || '',
    location: item.location || 'Main Store',
    masterPack: item.masterPack || '',
    reorderLevel: item.reorderLevel !== undefined ? Number(item.reorderLevel) : 0,
    reorderQty: item.reorderQty !== undefined ? Number(item.reorderQty) : 0,
    maxStockLevel: item.maxStockLevel !== undefined ? Number(item.maxStockLevel) : 0,
    isBulkItem: Boolean(item.isBulkItem),
    quantity: stock,
    stockInHand: stock,
    damagedStock: item.damagedStock !== undefined ? Number(item.damagedStock) : 0,
    roundOff: item.roundOff !== undefined ? Number(item.roundOff) : 0,
    roundOffOption,
    roundOffStep,
    discountPercentage: discPct,
    discountAmount: discAmt,
    discountedPrice,
    image: item.image || '',
    barcode: item.barcode || item.barCode || '',
    supplier: item.supplier || '',
    supplierCode: item.supplierCode || item.suppCode || '',
    lastGrnPrice: item.lastGrnPrice !== undefined ? Number(item.lastGrnPrice) : 0,
    lastGrn: item.lastGrn || '',
    lastGrnDate: item.lastGrnDate || item.lastGrn || '',
    remark: item.remark || '',
    color: item.color || '',
    status: item.status || 'A',
    averageCost: item.averageCost !== undefined ? Number(item.averageCost) : 0,
    sellingPrice: sp,
    finalSellingPrice,
    value: item.value !== undefined ? Number(item.value) : 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

/**
 * @route   GET /api/items
 * @desc    Get items with optional search and pagination
 */
export const getItems = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        data: [],
        message: 'Database offline',
      });
    }

    const { search = '', category = '', limit = 1000, page = 1 } = req.query;
    const query = {};

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { code: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
      ];
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    const total = await Item.countDocuments(query);
    const limitNum = Math.min(Number(limit) || 1000, 5000);
    const pageNum = Math.max(Number(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const items = await Item.find(query)
      .sort({ code: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const normalized = items.map(normalizeItem);

    return res.status(200).json({
      success: true,
      count: normalized.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: normalized,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/items/next-code
 * @desc    Generate the next sequential item code
 */
export const getNextItemCode = async (req, res, next) => {
  try {
    let nextCode = 'ITM-001';
    if (isDbConnected()) {
      const items = await Item.find({}, { code: 1 }).lean();
      let maxNum = 0;
      for (const itm of items) {
        if (!itm.code) continue;
        const match = String(itm.code).trim().match(/^ITM[-_]?(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = maxNum + 1;
      nextCode = `ITM-${String(nextNum).padStart(3, '0')}`;
    }
    return res.status(200).json({
      success: true,
      nextCode,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/items/lookup-options
 * @desc    Get categories, subcategories, locations, types, and categorySubCategoryMap for dropdowns
 */
export const getLookupOptions = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: {
          categories: ['2W', 'Lubricants', 'Ignition & Electrical', 'CAT_T04828', 'CAT_T63174', 'General Spare Parts'],
          subCategories: ['2W', 'Engine Oils', 'Spark Plugs', 'Brake Systems', 'Body Parts'],
          locations: ['Main Store', 'Store 2', 'Shop Floor', 'Main Warehouse'],
          categorySubCategoryMap: {
            '2W': ['2W', 'Body Parts', 'Engine Oils'],
            'Lubricants': ['Engine Oils', 'Brake Systems'],
            'Ignition & Electrical': ['Spark Plugs'],
            'CAT_T63174': ['Fake Synthetic Oils T63174'],
          },
        },
      });
    }

    const db = mongoose.connection.db;

    // Fetch distinct categories, subcategories, locations, and item pairs
    const [itemCategories, directCategories, directSubcategories, directLocations, itemPairs] = await Promise.all([
      Item.distinct('category'),
      db.collection('categories').find({}).toArray().catch(() => []),
      db.collection('subcategories').find({}).toArray().catch(() => []),
      db.collection('locations').find({}).toArray().catch(() => []),
      Item.find({ category: { $ne: '' } }, { category: 1, subCategory: 1 }).lean().catch(() => []),
    ]);

    const categoriesSet = new Set(itemCategories.filter(Boolean));
    directCategories.forEach((c) => {
      if (c.code) categoriesSet.add(c.code);
      if (c.description) categoriesSet.add(c.description);
    });

    const subCategoriesSet = new Set();
    const categorySubCategoryMap = {};

    directSubcategories.forEach((s) => {
      const subName = s.description || s.code;
      if (subName) subCategoriesSet.add(subName);
      const parent = s.parentCategory || s.category;
      if (parent) {
        if (!categorySubCategoryMap[parent]) categorySubCategoryMap[parent] = [];
        if (!categorySubCategoryMap[parent].includes(subName)) {
          categorySubCategoryMap[parent].push(subName);
        }
      }
    });

    itemPairs.forEach((item) => {
      const cat = item.category ? item.category.trim() : '';
      const sub = item.subCategory ? item.subCategory.trim() : '';
      if (cat && sub) {
        subCategoriesSet.add(sub);
        if (!categorySubCategoryMap[cat]) categorySubCategoryMap[cat] = [];
        if (!categorySubCategoryMap[cat].includes(sub)) {
          categorySubCategoryMap[cat].push(sub);
        }
      }
    });

    ['2W', 'Engine Oils', 'Spark Plugs', 'Brake Systems', 'Body Parts'].forEach((sc) => subCategoriesSet.add(sc));

    const locationsSet = new Set();
    directLocations.forEach((l) => {
      if (l.description) locationsSet.add(l.description);
      else if (l.code) locationsSet.add(l.code);
    });
    ['Main Store', 'Store 2', 'Shop Floor', 'Main Warehouse'].forEach((loc) => locationsSet.add(loc));

    return res.status(200).json({
      success: true,
      data: {
        categories: Array.from(categoriesSet).filter(Boolean).sort(),
        subCategories: Array.from(subCategoriesSet).filter(Boolean).sort(),
        locations: Array.from(locationsSet).filter(Boolean).sort(),
        categorySubCategoryMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/items/:id
 * @desc    Get single item by ID or Code
 */
export const getItemById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(404).json({ success: false, message: 'Database offline' });
    }

    let item = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      item = await Item.findById(id).lean();
    }
    if (!item) {
      item = await Item.findOne({ code: id.trim() }).lean();
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    return res.status(200).json({
      success: true,
      data: normalizeItem(item),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/items
 * @desc    Create a new item
 */
export const createItem = async (req, res, next) => {
  try {
    const {
      code,
      image = '',
      description,
      category = '',
      subCategory = '',
      location = 'Main Store',
      reorderLevel = 0,
      reorderQty = 0,
      maxStockLevel = 0,
      isBulkItem = false,
      sellingPrice = 0,
      barcode = '',
      barCode = '',
      lastGrnPrice = 0,
      lastGrnDate = '',
      lastGrn = '',
      supplier = '',
      supplierCode = '',
      suppCode = '',
      remark = '',
      color = '',
      roundOffOption = 'No Round Off',
      discountPercentage = 0,
      discountAmount = 0,
      discountedPrice = 0,
      finalSellingPrice = 0,
      status = 'A',
      type = 'Item',
      masterPack = '',
      stockInHand = 0,
      quantity = 0,
      roundOff = 0,
      roundOffStep = 5,
      costChange = false,
      averageCost = 0,
      value = 0,
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Item code is required',
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Item description is required',
      });
    }

    if (!isDbConnected()) {
      return res.status(500).json({ success: false, message: 'Database offline' });
    }

    const cleanCode = code.trim();
    const existing = await Item.findOne({ code: { $regex: new RegExp(`^${cleanCode}$`, 'i') } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Item with code '${cleanCode}' already exists`,
      });
    }

    const stockQty = Number(stockInHand) || Number(quantity) || 0;
    const sp = Number(sellingPrice) || 0;
    let discPct = Number(discountPercentage) || 0;
    let discAmt = Number(discountAmount) || 0;

    if (discPct > 0 && (!discAmt || discAmt === 0)) {
      discAmt = (sp * discPct) / 100;
    } else if (discAmt > 0 && (!discPct || discPct === 0)) {
      discPct = sp > 0 ? (discAmt / sp) * 100 : 0;
    }

    const discPrice = discountedPrice !== undefined && Number(discountedPrice) > 0
      ? Number(discountedPrice)
      : Math.max(0, sp - discAmt);
    const step = Number(roundOffStep) > 0 ? Number(roundOffStep) : 5;

    let fsp = finalSellingPrice !== undefined && Number(finalSellingPrice) > 0 ? Number(finalSellingPrice) : 0;
    if (!fsp) {
      if (roundOffOption === 'Round Up' || roundOffOption === 'Up') {
        fsp = Math.ceil(discPrice / step) * step;
      } else if (roundOffOption === 'Round Down' || roundOffOption === 'Down') {
        fsp = Math.floor(discPrice / step) * step;
      } else {
        fsp = discPrice > 0 ? discPrice : sp;
      }
    }

    const cleanSuppCode = (supplierCode || suppCode || '').trim();
    const cleanSupplier = (supplier || '').trim();
    const cleanBarcode = (barcode || barCode || '').trim();
    const cleanGrnDate = (lastGrnDate || lastGrn || '').trim();

    const newItem = await Item.create({
      code: cleanCode,
      image: image || '',
      description: description.trim(),
      category: (category || '').trim(),
      subCategory: (subCategory || '').trim(),
      location: (location || 'Main Store').trim(),
      reorderLevel: Math.max(0, Number(reorderLevel) || 0),
      reorderQty: Math.max(0, Number(reorderQty) || 0),
      maxStockLevel: Math.max(0, Number(maxStockLevel) || 0),
      isBulkItem: Boolean(isBulkItem),
      sellingPrice: sp,
      barcode: cleanBarcode,
      barCode: cleanBarcode,
      lastGrnPrice: Number(lastGrnPrice) || 0,
      lastGrnDate: cleanGrnDate,
      lastGrn: cleanGrnDate,
      supplier: cleanSupplier,
      supplierCode: cleanSuppCode,
      suppCode: cleanSuppCode,
      remark: (remark || '').trim(),
      color: (color || '').trim(),
      roundOffOption: (roundOffOption || 'No Round Off').trim(),
      roundOffStep: step,
      discountPercentage: discPct,
      discountAmount: discAmt,
      discountedPrice: discPrice,
      finalSellingPrice: fsp,
      type: (type || 'Item').trim(),
      masterPack: (masterPack || '').trim(),
      quantity: stockQty,
      stockInHand: stockQty,
      roundOff: Number(roundOff) || 0,
      costChange: Boolean(costChange),
      status: (status || 'A').trim(),
      averageCost: Number(averageCost) || 0,
      value: Number(value) || 0,
    });

    return res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: normalizeItem(newItem.toObject()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/items/:id
 * @desc    Update an existing item
 */
export const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (!isDbConnected()) {
      return res.status(500).json({ success: false, message: 'Database offline' });
    }

    let item = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      item = await Item.findById(id);
    }
    if (!item) {
      item = await Item.findOne({ code: String(id).trim() });
    }
    if (!item && updateData.code) {
      item = await Item.findOne({ code: updateData.code.trim() });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (updateData.code && updateData.code.trim().toLowerCase() !== item.code.toLowerCase()) {
      const dup = await Item.findOne({
        _id: { $ne: item._id },
        code: { $regex: new RegExp(`^${updateData.code.trim()}$`, 'i') },
      });
      if (dup) {
        return res.status(400).json({
          success: false,
          message: `Item with code '${updateData.code.trim()}' already exists`,
        });
      }
      item.code = updateData.code.trim();
    }

    if (updateData.description !== undefined) item.description = updateData.description.trim();
    if (updateData.image !== undefined) item.image = updateData.image;
    if (updateData.category !== undefined) item.category = updateData.category.trim();
    if (updateData.subCategory !== undefined) item.subCategory = updateData.subCategory.trim();
    if (updateData.location !== undefined) item.location = updateData.location.trim();
    if (updateData.reorderLevel !== undefined) item.reorderLevel = Math.max(0, Number(updateData.reorderLevel) || 0);
    if (updateData.reorderQty !== undefined) item.reorderQty = Math.max(0, Number(updateData.reorderQty) || 0);
    if (updateData.maxStockLevel !== undefined) item.maxStockLevel = Math.max(0, Number(updateData.maxStockLevel) || 0);
    if (updateData.isBulkItem !== undefined) item.isBulkItem = Boolean(updateData.isBulkItem);
    if (updateData.sellingPrice !== undefined) item.sellingPrice = Number(updateData.sellingPrice) || 0;

    if (updateData.barcode !== undefined || updateData.barCode !== undefined) {
      const bc = (updateData.barcode || updateData.barCode || '').trim();
      item.barcode = bc;
      item.barCode = bc;
    }

    if (updateData.lastGrnPrice !== undefined) item.lastGrnPrice = Number(updateData.lastGrnPrice) || 0;
    if (updateData.lastGrnDate !== undefined || updateData.lastGrn !== undefined) {
      const gd = (updateData.lastGrnDate || updateData.lastGrn || '').trim();
      item.lastGrnDate = gd;
      item.lastGrn = gd;
    }

    if (updateData.supplier !== undefined) item.supplier = (updateData.supplier || '').trim();
    if (updateData.supplierCode !== undefined || updateData.suppCode !== undefined) {
      const sc = (updateData.supplierCode || updateData.suppCode || '').trim();
      item.supplierCode = sc;
      item.suppCode = sc;
    }

    if (updateData.remark !== undefined) item.remark = (updateData.remark || '').trim();
    if (updateData.color !== undefined) item.color = (updateData.color || '').trim();
    if (updateData.roundOffOption !== undefined) item.roundOffOption = updateData.roundOffOption.trim();
    if (updateData.status !== undefined) item.status = updateData.status.trim();

    // Discount & pricing calculation
    const curSp = item.sellingPrice || 0;
    let curDiscPct = updateData.discountPercentage !== undefined ? Number(updateData.discountPercentage) || 0 : (item.discountPercentage || 0);
    let curDiscAmt = (curSp * curDiscPct) / 100;
    const curDiscPrice = Math.max(0, curSp - curDiscAmt);
    const curRoundOpt = item.roundOffOption || 'No Round Off';
    const curStep = item.roundOffStep > 0 ? item.roundOffStep : 5;

    let curFsp = curDiscPrice;
    if (curRoundOpt === 'Round Up' || curRoundOpt === 'Up') {
      curFsp = Math.ceil(curDiscPrice / curStep) * curStep;
    } else if (curRoundOpt === 'Round Down' || curRoundOpt === 'Down') {
      curFsp = Math.floor(curDiscPrice / curStep) * curStep;
    } else {
      curFsp = curDiscPrice > 0 ? curDiscPrice : curSp;
    }

    item.discountPercentage = curDiscPct;
    item.discountAmount = curDiscAmt;
    item.discountedPrice = curDiscPrice;
    item.finalSellingPrice = curFsp;

    await item.save();

    return res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: normalizeItem(item.toObject()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/items/:id
 * @desc    Safely delete or deactivate an item, protecting transactions
 */
export const deleteItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(500).json({ success: false, message: 'Database offline' });
    }

    let item = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      item = await Item.findById(id);
    }
    if (!item) {
      item = await Item.findOne({ code: String(id).trim() });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const cleanCode = item.code.trim();
    const db = mongoose.connection.db;

    // Check references in transactions
    const [invRef, grnRef, retRef, claimRef, stockRef] = await Promise.all([
      db.collection('invoices').findOne({ $or: [{ 'items.code': cleanCode }, { 'items.itemCode': cleanCode }] }).catch(() => null),
      db.collection('grns').findOne({ $or: [{ 'lineItems.code': cleanCode }, { 'lineItems.itemCode': cleanCode }] }).catch(() => null),
      db.collection('customerdamagereturns').findOne({ $or: [{ 'items.code': cleanCode }, { 'items.itemCode': cleanCode }] }).catch(() => null),
      db.collection('supplierdamageclaims').findOne({ $or: [{ 'items.code': cleanCode }, { 'items.itemCode': cleanCode }] }).catch(() => null),
      db.collection('damagestockmovements').findOne({ $or: [{ code: cleanCode }, { itemCode: cleanCode }] }).catch(() => null),
    ]);

    let refReason = '';
    if (invRef) refReason = 'Customer Invoices';
    else if (grnRef) refReason = 'GRN Purchases';
    else if (retRef) refReason = 'Customer Damage Returns';
    else if (claimRef) refReason = 'Supplier Damage Claims';
    else if (stockRef) refReason = 'Damage Stock Movements';

    if (refReason) {
      item.status = 'I';
      await item.save();
      return res.status(200).json({
        success: true,
        isDeactivated: true,
        message: `Item '${item.description}' (${item.code}) is referenced in ${refReason} and was safely deactivated instead of deleted to protect historical records.`,
        data: { id: item._id, code: item.code, status: 'I' },
      });
    }

    await Item.findByIdAndDelete(item._id);

    return res.status(200).json({
      success: true,
      isDeactivated: false,
      message: `Item '${item.description}' (${item.code}) deleted successfully.`,
      data: { id: item._id, code: item.code },
    });
  } catch (error) {
    next(error);
  }
};
