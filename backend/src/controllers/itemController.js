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
    roundOff: item.roundOff !== undefined ? Number(item.roundOff) : 0,
    roundOffOption,
    roundOffStep,
    discountPercentage: discPct,
    discountAmount: discAmt,
    discountedPrice,
    costChange: Boolean(item.costChange),
    lastGrnPrice: item.lastGrnPrice !== undefined ? Number(item.lastGrnPrice) : 0,
    lastGrn: item.lastGrn || '',
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
 * @route   GET /api/items/lookup-options
 * @desc    Get categories, subcategories, locations, types for dropdowns
 */
export const getLookupOptions = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: {
          categories: ['2W', 'Lubricants', 'Ignition & Electrical', 'CAT T53174'],
          subCategories: ['2W', 'Engine Oils', 'Spark Plugs'],
          locations: ['Main Store', 'Store 2', 'Shop Floor', 'Main Warehouse'],
          types: ['Item', 'Service', 'Raw Material', 'Packaging'],
        },
      });
    }

    const db = mongoose.connection.db;

    // Fetch distinct categories from items & categories collection
    const [itemCategories, directCategories, directSubcategories, directLocations] = await Promise.all([
      Item.distinct('category'),
      db.collection('categories').find({}).toArray().catch(() => []),
      db.collection('subcategories').find({}).toArray().catch(() => []),
      db.collection('locations').find({}).toArray().catch(() => []),
    ]);

    const categoriesSet = new Set(itemCategories.filter(Boolean));
    directCategories.forEach((c) => {
      if (c.code) categoriesSet.add(c.code);
      if (c.description) categoriesSet.add(c.description);
    });

    const subCategoriesSet = new Set();
    directSubcategories.forEach((s) => {
      if (s.code) subCategoriesSet.add(s.code);
      if (s.description) subCategoriesSet.add(s.description);
    });
    // Add common fallback subcategories if empty
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
        categories: Array.from(categoriesSet).filter(Boolean),
        subCategories: Array.from(subCategoriesSet).filter(Boolean),
        locations: Array.from(locationsSet).filter(Boolean),
        types: ['Item', 'Service', 'Raw Material', 'Packaging'],
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
      suppCode = '',
      type = 'Item',
      description,
      category = '',
      subCategory = '',
      location = 'Main Store',
      masterPack = '',
      reorderLevel = 0,
      reorderQty = 0,
      maxStockLevel = 0,
      isBulkItem = false,
      stockInHand = 0,
      quantity = 0,
      roundOff = 0,
      roundOffOption = 'No Round Off',
      roundOffStep = 5,
      discountPercentage = 0,
      discountAmount = 0,
      discountedPrice = 0,
      costChange = false,
      lastGrnPrice = 0,
      lastGrn = '',
      remark = '',
      color = '',
      status = 'A',
      averageCost = 0,
      sellingPrice = 0,
      finalSellingPrice = 0,
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

    const existing = await Item.findOne({ code: code.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Item with code '${code.trim()}' already exists`,
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
      if (roundOffOption === 'Round Up') {
        fsp = Math.ceil(discPrice / step) * step;
      } else if (roundOffOption === 'Round Down') {
        fsp = Math.floor(discPrice / step) * step;
      } else {
        fsp = discPrice > 0 ? discPrice : sp;
      }
    }

    const newItem = await Item.create({
      code: code.trim(),
      suppCode: suppCode.trim(),
      type: type.trim(),
      description: description.trim(),
      category: category.trim(),
      subCategory: subCategory.trim(),
      location: location.trim(),
      masterPack: masterPack.trim(),
      reorderLevel: Number(reorderLevel) || 0,
      reorderQty: Number(reorderQty) || 0,
      maxStockLevel: Number(maxStockLevel) || 0,
      isBulkItem: Boolean(isBulkItem),
      quantity: stockQty,
      stockInHand: stockQty,
      roundOff: Number(roundOff) || 0,
      roundOffOption: roundOffOption.trim() || 'No Round Off',
      roundOffStep: step,
      discountPercentage: discPct,
      discountAmount: discAmt,
      discountedPrice: discPrice,
      costChange: Boolean(costChange),
      lastGrnPrice: Number(lastGrnPrice) || 0,
      lastGrn: lastGrn.trim(),
      remark: remark.trim(),
      color: color.trim(),
      status: status.trim() || 'A',
      averageCost: Number(averageCost) || 0,
      sellingPrice: sp,
      finalSellingPrice: fsp,
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
      item = await Item.findOne({ code: id.trim() });
    }
    if (!item && updateData.code) {
      item = await Item.findOne({ code: updateData.code.trim() });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (updateData.code) item.code = updateData.code.trim();
    if (updateData.description !== undefined) item.description = updateData.description.trim();
    if (updateData.suppCode !== undefined) item.suppCode = updateData.suppCode.trim();
    if (updateData.type !== undefined) item.type = updateData.type.trim();
    if (updateData.category !== undefined) item.category = updateData.category.trim();
    if (updateData.subCategory !== undefined) item.subCategory = updateData.subCategory.trim();
    if (updateData.location !== undefined) item.location = updateData.location.trim();
    if (updateData.masterPack !== undefined) item.masterPack = updateData.masterPack.trim();
    if (updateData.reorderLevel !== undefined) item.reorderLevel = Number(updateData.reorderLevel) || 0;
    if (updateData.reorderQty !== undefined) item.reorderQty = Number(updateData.reorderQty) || 0;
    if (updateData.maxStockLevel !== undefined) item.maxStockLevel = Number(updateData.maxStockLevel) || 0;
    if (updateData.isBulkItem !== undefined) item.isBulkItem = Boolean(updateData.isBulkItem);
    
    if (updateData.stockInHand !== undefined || updateData.quantity !== undefined) {
      const stock = Number(updateData.stockInHand !== undefined ? updateData.stockInHand : updateData.quantity) || 0;
      item.quantity = stock;
      item.stockInHand = stock;
    }

    if (updateData.roundOff !== undefined) item.roundOff = Number(updateData.roundOff) || 0;
    if (updateData.roundOffOption !== undefined) item.roundOffOption = updateData.roundOffOption.trim();
    if (updateData.roundOffStep !== undefined) item.roundOffStep = Number(updateData.roundOffStep) || 5;
    if (updateData.discountPercentage !== undefined) item.discountPercentage = Number(updateData.discountPercentage) || 0;
    if (updateData.discountAmount !== undefined) item.discountAmount = Number(updateData.discountAmount) || 0;
    if (updateData.discountedPrice !== undefined) item.discountedPrice = Number(updateData.discountedPrice) || 0;
    if (updateData.costChange !== undefined) item.costChange = Boolean(updateData.costChange);
    if (updateData.lastGrnPrice !== undefined) item.lastGrnPrice = Number(updateData.lastGrnPrice) || 0;
    if (updateData.lastGrn !== undefined) item.lastGrn = updateData.lastGrn.trim();
    if (updateData.remark !== undefined) item.remark = updateData.remark.trim();
    if (updateData.color !== undefined) item.color = updateData.color.trim();
    if (updateData.status !== undefined) item.status = updateData.status.trim();
    if (updateData.averageCost !== undefined) item.averageCost = Number(updateData.averageCost) || 0;
    if (updateData.sellingPrice !== undefined) item.sellingPrice = Number(updateData.sellingPrice) || 0;
    if (updateData.finalSellingPrice !== undefined) item.finalSellingPrice = Number(updateData.finalSellingPrice) || 0;
    if (updateData.value !== undefined) item.value = Number(updateData.value) || 0;

    // Recalculate discount & finalSellingPrice if price or discount changed
    if (
      updateData.discountPercentage !== undefined ||
      updateData.discountAmount !== undefined ||
      updateData.sellingPrice !== undefined ||
      updateData.roundOffOption !== undefined ||
      updateData.roundOffStep !== undefined
    ) {
      const curSp = item.sellingPrice || 0;
      let curDiscPct = item.discountPercentage || 0;
      let curDiscAmt = item.discountAmount || 0;

      if (updateData.discountPercentage !== undefined && updateData.discountAmount === undefined) {
        curDiscAmt = (curSp * curDiscPct) / 100;
      } else if (updateData.discountAmount !== undefined && updateData.discountPercentage === undefined) {
        curDiscPct = curSp > 0 ? (curDiscAmt / curSp) * 100 : 0;
      } else if (curDiscPct > 0 && (!curDiscAmt || curDiscAmt === 0)) {
        curDiscAmt = (curSp * curDiscPct) / 100;
      }

      const curDiscPrice = updateData.discountedPrice !== undefined && Number(updateData.discountedPrice) > 0
        ? Number(updateData.discountedPrice)
        : Math.max(0, curSp - curDiscAmt);
      const curRoundOpt = item.roundOffOption || 'No Round Off';
      const curStep = item.roundOffStep > 0 ? item.roundOffStep : 5;

      let curFsp = updateData.finalSellingPrice !== undefined && Number(updateData.finalSellingPrice) > 0 ? Number(updateData.finalSellingPrice) : 0;
      if (!curFsp) {
        if (curRoundOpt === 'Round Up') {
          curFsp = Math.ceil(curDiscPrice / curStep) * curStep;
        } else if (curRoundOpt === 'Round Down') {
          curFsp = Math.floor(curDiscPrice / curStep) * curStep;
        } else {
          curFsp = curDiscPrice > 0 ? curDiscPrice : curSp;
        }
      }

      item.discountPercentage = curDiscPct;
      item.discountAmount = curDiscAmt;
      item.discountedPrice = curDiscPrice;
      item.finalSellingPrice = curFsp;
    }

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
 * @desc    Delete an item
 */
export const deleteItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(500).json({ success: false, message: 'Database offline' });
    }

    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Item.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await Item.findOneAndDelete({ code: id.trim() });
    }

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
      data: { id: deleted._id, code: deleted.code },
    });
  } catch (error) {
    next(error);
  }
};
