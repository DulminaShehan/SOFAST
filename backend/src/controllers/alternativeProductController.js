import mongoose from 'mongoose';
import AlternativeProduct from '../models/AlternativeProduct.js';
import Item from '../models/Item.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Helper to populate item details for a list of item codes
 */
const getItemsDetailsByCodes = async (codes) => {
  if (!codes || codes.length === 0) return [];
  const uniqueCodes = [...new Set(codes.map((c) => String(c).trim()))].filter(Boolean);

  const items = await Item.find({ code: { $in: uniqueCodes } }).lean();
  const itemMap = new Map();

  items.forEach((item) => {
    const stock =
      item.quantity !== undefined
        ? item.quantity
        : item.stockInHand !== undefined
        ? item.stockInHand
        : 0;

    itemMap.set(item.code, {
      _id: item._id,
      code: item.code,
      description: item.description || '',
      category: item.category || '',
      subCategory: item.subCategory || '',
      location: item.location || 'Main Store',
      stock: Number(stock),
      quantity: Number(stock),
      stockInHand: Number(stock),
      price: Number(item.finalSellingPrice || item.sellingPrice || 0),
      sellingPrice: Number(item.sellingPrice || 0),
      finalSellingPrice: Number(item.finalSellingPrice || item.sellingPrice || 0),
      status: item.status || 'Active',
    });
  });

  // Preserve ordering of original codes
  return uniqueCodes.map((c) => {
    return (
      itemMap.get(c) || {
        code: c,
        description: 'Item Not Found in Master',
        stock: 0,
        price: 0,
        location: 'Main Store',
      }
    );
  });
};

/**
 * GET /api/alternative-products
 * Fetch all alternative product relationships with populated main item & alternative items info
 */
export const getAlternativeProducts = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: 'Database offline mode',
      });
    }

    const { search, limit = 200 } = req.query;
    let query = {};

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { mainItemCode: { $regex: q, $options: 'i' } },
        { alternativeItemCodes: { $elemMatch: { $regex: q, $options: 'i' } } },
      ];
    }

    const relationships = await AlternativeProduct.find(query)
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .lean();

    // Collect all main item codes & alternative item codes
    const allCodesToFetch = new Set();
    relationships.forEach((rel) => {
      if (rel.mainItemCode) allCodesToFetch.add(rel.mainItemCode);
      if (Array.isArray(rel.alternativeItemCodes)) {
        rel.alternativeItemCodes.forEach((ac) => allCodesToFetch.add(ac));
      }
    });

    const items = await Item.find({ code: { $in: Array.from(allCodesToFetch) } }).lean();
    const itemMap = new Map();
    items.forEach((item) => {
      const stock =
        item.quantity !== undefined
          ? item.quantity
          : item.stockInHand !== undefined
          ? item.stockInHand
          : 0;

      itemMap.set(item.code, {
        _id: item._id,
        code: item.code,
        description: item.description || '',
        category: item.category || '',
        location: item.location || 'Main Store',
        stock: Number(stock),
        price: Number(item.finalSellingPrice || item.sellingPrice || 0),
      });
    });

    // Format results with populated descriptions and item lists
    const populatedList = relationships.map((rel) => {
      const mainDetails = itemMap.get(rel.mainItemCode) || {
        description: 'N/A',
        stock: 0,
      };

      const altList = (rel.alternativeItemCodes || []).map((ac) => {
        return (
          itemMap.get(ac) || {
            code: ac,
            description: 'Item Not Found in Master',
            stock: 0,
            price: 0,
            location: 'Main Store',
          }
        );
      });

      return {
        _id: rel._id,
        mainItemCode: rel.mainItemCode,
        mainItemId: rel.mainItemId,
        description: mainDetails.description,
        mainItemDescription: mainDetails.description,
        mainItemStock: mainDetails.stock,
        alternativeCount: altList.length,
        alternativeItemCodes: rel.alternativeItemCodes || [],
        alternativeItems: altList,
        status: rel.status || 'Active',
        remark: rel.remark || '',
        updatedAt: rel.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      count: populatedList.length,
      data: populatedList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alternative-products/:code
 * Fetch alternative product mapping by main item code
 */
export const getAlternativeProductByCode = async (req, res, next) => {
  try {
    const rawCode = req.params.code?.trim();
    if (!rawCode) {
      return res.status(400).json({
        success: false,
        message: 'Main item code is required',
      });
    }

    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Database offline mode',
      });
    }

    // Try finding by mainItemCode or ObjectId
    let rel = await AlternativeProduct.findOne({
      mainItemCode: { $regex: new RegExp(`^${rawCode}$`, 'i') },
    }).lean();

    if (!rel && mongoose.Types.ObjectId.isValid(rawCode)) {
      rel = await AlternativeProduct.findById(rawCode).lean();
    }

    if (!rel) {
      // Check if item exists in Item Master to at least return item info
      const item = await Item.findOne({
        code: { $regex: new RegExp(`^${rawCode}$`, 'i') },
      }).lean();

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Main Item '${rawCode}' not found in Item Master`,
        });
      }

      const stock =
        item.quantity !== undefined
          ? item.quantity
          : item.stockInHand !== undefined
          ? item.stockInHand
          : 0;

      return res.status(200).json({
        success: true,
        data: {
          mainItemCode: item.code,
          mainItemId: item._id,
          description: item.description,
          mainItemDescription: item.description,
          mainItemStock: stock,
          alternativeCount: 0,
          alternativeItemCodes: [],
          alternativeItems: [],
          status: 'Active',
        },
      });
    }

    // Fetch main item details
    const mainItem = await Item.findOne({ code: rel.mainItemCode }).lean();
    const altItems = await getItemsDetailsByCodes(rel.alternativeItemCodes);

    return res.status(200).json({
      success: true,
      data: {
        _id: rel._id,
        mainItemCode: rel.mainItemCode,
        mainItemId: rel.mainItemId || mainItem?._id,
        description: mainItem?.description || '',
        mainItemDescription: mainItem?.description || '',
        mainItemStock: mainItem?.quantity ?? mainItem?.stockInHand ?? 0,
        alternativeCount: altItems.length,
        alternativeItemCodes: rel.alternativeItemCodes || [],
        alternativeItems: altItems,
        status: rel.status || 'Active',
        remark: rel.remark || '',
        updatedAt: rel.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/alternative-products
 * Save or update alternative product relationships for a main item
 */
export const saveAlternativeProduct = async (req, res, next) => {
  try {
    const { mainItemCode, alternativeItemCodes, alternativeItems, status, remark } = req.body;

    if (!mainItemCode || !String(mainItemCode).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Main Item Code is required',
      });
    }

    const trimmedMainCode = String(mainItemCode).trim().toUpperCase();

    // Verify main item in Item Master
    const mainItem = await Item.findOne({
      code: { $regex: new RegExp(`^${trimmedMainCode}$`, 'i') },
    });

    if (!mainItem) {
      return res.status(404).json({
        success: false,
        message: `Main Item '${trimmedMainCode}' does not exist in Item Master. Please create it in Item Master first.`,
      });
    }

    // Extract list of alternative codes
    let rawAltCodes = [];
    if (Array.isArray(alternativeItemCodes)) {
      rawAltCodes = alternativeItemCodes;
    } else if (Array.isArray(alternativeItems)) {
      rawAltCodes = alternativeItems.map((ai) => (typeof ai === 'string' ? ai : ai.code));
    }

    // Filter out empty, duplicate, and self-referencing codes
    const cleanAltCodes = [
      ...new Set(
        rawAltCodes
          .map((c) => (c ? String(c).trim().toUpperCase() : ''))
          .filter((c) => c && c !== trimmedMainCode)
      ),
    ];

    // Find matching ObjectIds for the alternative items from Item Master
    let altObjectIds = [];
    if (cleanAltCodes.length > 0) {
      const foundAltItems = await Item.find({ code: { $in: cleanAltCodes } }).lean();
      altObjectIds = foundAltItems.map((i) => i._id);
    }

    // Upsert relationship document
    const updatedRel = await AlternativeProduct.findOneAndUpdate(
      { mainItemCode: mainItem.code },
      {
        mainItemCode: mainItem.code,
        mainItemId: mainItem._id,
        alternativeItemCodes: cleanAltCodes,
        alternativeItemIds: altObjectIds,
        status: status || 'Active',
        remark: remark || '',
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // Return populated details
    const populatedAltItems = await getItemsDetailsByCodes(cleanAltCodes);

    return res.status(200).json({
      success: true,
      message: `Alternative products for '${mainItem.code}' saved successfully`,
      data: {
        _id: updatedRel._id,
        mainItemCode: updatedRel.mainItemCode,
        mainItemId: updatedRel.mainItemId,
        description: mainItem.description,
        mainItemDescription: mainItem.description,
        mainItemStock: mainItem.quantity ?? mainItem.stockInHand ?? 0,
        alternativeCount: populatedAltItems.length,
        alternativeItemCodes: cleanAltCodes,
        alternativeItems: populatedAltItems,
        status: updatedRel.status,
        remark: updatedRel.remark,
        updatedAt: updatedRel.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/alternative-products/:code
 * Delete the relationship between main item and its alternatives.
 * (Does NOT delete any items from Item Master)
 */
export const deleteAlternativeProduct = async (req, res, next) => {
  try {
    const rawCode = req.params.code?.trim();
    if (!rawCode) {
      return res.status(400).json({
        success: false,
        message: 'Item code is required to delete relationship',
      });
    }

    // Delete relationship only
    let deleted = await AlternativeProduct.findOneAndDelete({
      mainItemCode: { $regex: new RegExp(`^${rawCode}$`, 'i') },
    });

    if (!deleted && mongoose.Types.ObjectId.isValid(rawCode)) {
      deleted = await AlternativeProduct.findByIdAndDelete(rawCode);
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Alternative Product relationship for '${rawCode}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Alternative Product relationship for '${rawCode}' removed successfully (Item Master products were NOT deleted)`,
      data: { mainItemCode: deleted.mainItemCode },
    });
  } catch (error) {
    next(error);
  }
};
