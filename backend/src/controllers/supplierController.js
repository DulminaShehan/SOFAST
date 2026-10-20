import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';

// In-memory store fallback for offline development mode when MongoDB server is not running
let memorySuppliers = [
  {
    _id: 'mem_1',
    code: 'SUP001',
    name: 'Toyota Lanka (Pvt) Ltd',
    address: 'No. 337, Negombo Road, Wattala',
    telephone1: '0112939000',
    telephone2: '0112939005',
    createdAt: new Date(),
  },
  {
    _id: 'mem_2',
    code: 'SUP002',
    name: 'Micro Cars Limited',
    address: 'No. 52, D.S. Senanayake Mawatha, Colombo 08',
    telephone1: '0112676767',
    telephone2: '0112676768',
    createdAt: new Date(),
  },
  {
    _id: 'mem_3',
    code: 'SUP003',
    name: 'United Motors Lanka PLC',
    address: 'No. 100, Hyde Park Corner, Colombo 02',
    telephone1: '0112448411',
    telephone2: '0112448415',
    createdAt: new Date(),
  },
];

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * @route   GET /api/suppliers
 * @desc    Get all suppliers
 */
export const getSuppliers = async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();
      const normalizedSuppliers = suppliers.map((s) => ({
        ...s,
        telephone1: s.telephone1 || s.telephone || '',
        telephone2: s.telephone2 || '',
      }));

      return res.status(200).json({
        success: true,
        count: normalizedSuppliers.length,
        data: normalizedSuppliers,
      });
    }

    // Fallback in-memory
    return res.status(200).json({
      success: true,
      count: memorySuppliers.length,
      data: memorySuppliers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/suppliers/next-code
 * @desc    Generate the next sequential supplier code
 */
export const getNextSupplierCode = async (req, res, next) => {
  try {
    let nextCode = 'SUP-001';

    if (isDbConnected()) {
      const suppliers = await Supplier.find({}, { code: 1 }).lean();
      let maxNum = 0;
      for (const s of suppliers) {
        if (!s.code) continue;
        const match = String(s.code).trim().match(/^SUP[-_]?(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = maxNum + 1;
      nextCode = `SUP-${String(nextNum).padStart(3, '0')}`;
    } else {
      let maxNum = 0;
      for (const s of memorySuppliers) {
        if (!s.code) continue;
        const match = String(s.code).trim().match(/^SUP[-_]?(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = maxNum + 1;
      nextCode = `SUP-${String(nextNum).padStart(3, '0')}`;
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
 * @route   GET /api/suppliers/:id
 * @desc    Get single supplier by ID
 */
export const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      let query = {};
      if (mongoose.Types.ObjectId.isValid(id)) {
        query._id = id;
      } else {
        query.code = String(id).trim();
      }

      const supplier = await Supplier.findOne(query).lean();
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: {
          ...supplier,
          telephone1: supplier.telephone1 || supplier.telephone || '',
          telephone2: supplier.telephone2 || '',
        },
      });
    }

    const memSupplier = memorySuppliers.find((s) => s._id === id || s.code === id);
    if (!memSupplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: memSupplier,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/suppliers
 * @desc    Create a new supplier
 */
export const createSupplier = async (req, res, next) => {
  try {
    const { code, name, address, telephone1, telephone2, status } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier Code is required',
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier Name is required',
      });
    }

    const cleanCode = String(code).trim();
    const cleanName = String(name).trim();
    const phone1 = telephone1 ? String(telephone1).trim() : '';
    const phone2 = telephone2 ? String(telephone2).trim() : '';
    const cleanAddress = address ? String(address).trim() : '';
    const suppStatus = status === 'I' ? 'I' : 'A';

    if (isDbConnected()) {
      const existing = await Supplier.findOne({
        code: { $regex: new RegExp(`^${cleanCode}$`, 'i') },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Supplier with code '${cleanCode}' already exists`,
        });
      }

      const supplier = await Supplier.create({
        code: cleanCode,
        name: cleanName,
        address: cleanAddress,
        telephone: phone1,
        telephone1: phone1,
        telephone2: phone2,
        dueAmount: 0,
        status: suppStatus,
      });

      return res.status(201).json({
        success: true,
        message: 'Supplier saved successfully',
        data: {
          ...supplier.toObject(),
          telephone1: phone1,
          telephone2: phone2,
        },
      });
    }

    // In-memory creation
    const existingMem = memorySuppliers.find((s) => s.code.toLowerCase() === cleanCode.toLowerCase());
    if (existingMem) {
      return res.status(400).json({
        success: false,
        message: `Supplier with code '${cleanCode}' already exists`,
      });
    }

    const newSupplier = {
      _id: 'mem_' + Date.now(),
      code: cleanCode,
      name: cleanName,
      address: cleanAddress,
      telephone1: phone1,
      telephone2: phone2,
      status: 'A',
      createdAt: new Date(),
    };

    memorySuppliers.unshift(newSupplier);

    return res.status(201).json({
      success: true,
      message: 'Supplier saved successfully',
      data: newSupplier,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update an existing supplier
 */
export const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, address, telephone1, telephone2, status } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier Name is required',
      });
    }

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier Code is required',
      });
    }

    const cleanCode = String(code).trim();
    const cleanName = String(name).trim();
    const cleanAddress = address !== undefined ? String(address).trim() : undefined;
    const p1 = telephone1 !== undefined ? String(telephone1).trim() : undefined;
    const p2 = telephone2 !== undefined ? String(telephone2).trim() : undefined;

    if (isDbConnected()) {
      let query = {};
      if (mongoose.Types.ObjectId.isValid(id)) {
        query._id = id;
      } else {
        query.code = String(id).trim();
      }

      const supplier = await Supplier.findOne(query);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found',
        });
      }

      // Check for code uniqueness if code changed
      if (cleanCode.toLowerCase() !== String(supplier.code).toLowerCase()) {
        const dup = await Supplier.findOne({
          _id: { $ne: supplier._id },
          code: { $regex: new RegExp(`^${cleanCode}$`, 'i') },
        });
        if (dup) {
          return res.status(400).json({
            success: false,
            message: `Supplier with code '${cleanCode}' already exists`,
          });
        }
        supplier.code = cleanCode;
      }

      supplier.name = cleanName;
      if (cleanAddress !== undefined) supplier.address = cleanAddress;
      if (status !== undefined) supplier.status = status === 'I' ? 'I' : 'A';
      
      const phone1 = p1 !== undefined ? p1 : (supplier.telephone1 || supplier.telephone || '');
      const phone2 = p2 !== undefined ? p2 : (supplier.telephone2 || '');
      
      supplier.telephone = phone1;
      supplier.telephone1 = phone1;
      supplier.telephone2 = phone2;

      await supplier.save();

      return res.status(200).json({
        success: true,
        message: 'Supplier updated successfully',
        data: {
          ...supplier.toObject(),
          telephone1: phone1,
          telephone2: phone2,
        },
      });
    }

    const index = memorySuppliers.findIndex((s) => s._id === id || s.code === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    // Check duplicate code in memory
    if (cleanCode.toLowerCase() !== memorySuppliers[index].code.toLowerCase()) {
      const dup = memorySuppliers.find((s, idx) => idx !== index && s.code.toLowerCase() === cleanCode.toLowerCase());
      if (dup) {
        return res.status(400).json({
          success: false,
          message: `Supplier with code '${cleanCode}' already exists`,
        });
      }
    }

    memorySuppliers[index] = {
      ...memorySuppliers[index],
      code: cleanCode,
      name: cleanName,
      address: cleanAddress !== undefined ? cleanAddress : memorySuppliers[index].address,
      telephone1: p1 !== undefined ? p1 : memorySuppliers[index].telephone1,
      telephone2: p2 !== undefined ? p2 : memorySuppliers[index].telephone2,
      updatedAt: new Date(),
    };

    return res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: memorySuppliers[index],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete a supplier with transaction and historical record safety checks
 */
export const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      let query = {};
      if (mongoose.Types.ObjectId.isValid(id)) {
        query._id = id;
      } else {
        query.code = String(id).trim();
      }

      const supplier = await Supplier.findOne(query);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found',
        });
      }

      const suppCode = supplier.code;
      const suppName = supplier.name;

      // Check whether the supplier is referenced by purchase records, GRNs, damage claims, or other transactions
      const db = mongoose.connection.db;
      let referenceFound = false;
      let refModuleName = '';

      const checkCollections = [
        { name: 'grns', module: 'GRN (Goods Receive Notes)', filter: { $or: [{ supplierCode: suppCode }, { supplier: suppCode }] } },
        { name: 'items', module: 'Items (Inventory)', filter: { $or: [{ suppCode: suppCode }, { 'itemSuppliers.supplierCode': suppCode }] } },
        { name: 'supplierdamageclaims', module: 'Supplier Damage Claims', filter: { supplierCode: suppCode } },
        { name: 'damageclaimsclaims', module: 'Damage Claims', filter: { supplierCode: suppCode } },
        { name: 'damageclaimreturnnotes', module: 'Damage Return Notes', filter: { supplierCode: suppCode } },
        { name: 'damages', module: 'Damages', filter: { supplierCode: suppCode } },
        { name: 'supplierreturns', module: 'Supplier Returns', filter: { supplierCode: suppCode } },
        { name: 'purchaseorders', module: 'Purchase Orders', filter: { supplierCode: suppCode } },
        { name: 'itemsuppliers', module: 'Item Suppliers', filter: { supplierCode: suppCode } },
      ];

      for (const col of checkCollections) {
        try {
          const count = await db.collection(col.name).countDocuments(col.filter);
          if (count > 0) {
            referenceFound = true;
            refModuleName = col.module;
            break;
          }
        } catch (e) {
          // Skip if collection doesn't exist
        }
      }

      if (referenceFound) {
        // Safe deactivation to preserve historical records, financial reports, and transaction integrity
        supplier.status = 'I';
        await supplier.save();

        return res.status(200).json({
          success: true,
          isDeactivated: true,
          message: `Supplier '${suppName}' (${suppCode}) is referenced in ${refModuleName} and was safely deactivated instead of deleted to protect historical records.`,
          data: { id: supplier._id, code: suppCode, name: suppName, status: 'I' },
        });
      }

      // No references found - safe to delete permanently
      await Supplier.findByIdAndDelete(supplier._id);

      return res.status(200).json({
        success: true,
        isDeactivated: false,
        message: `Supplier '${suppName}' (${suppCode}) deleted successfully.`,
        data: { id: supplier._id, code: suppCode, name: suppName },
      });
    }

    const index = memorySuppliers.findIndex((s) => s._id === id || s.code === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    const deleted = memorySuppliers.splice(index, 1);

    return res.status(200).json({
      success: true,
      isDeactivated: false,
      message: `Supplier '${deleted[0].name}' deleted successfully`,
      data: deleted[0],
    });
  } catch (error) {
    next(error);
  }
};
