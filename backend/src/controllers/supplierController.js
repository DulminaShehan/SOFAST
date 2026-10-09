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
 * @route   GET /api/suppliers/:id
 * @desc    Get single supplier by ID
 */
export const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(id)) {
      const supplier = await Supplier.findById(id).lean();
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
    const { code, name, address, telephone1, telephone2 } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Supplier Code and Supplier Name',
      });
    }

    if (isDbConnected()) {
      const existing = await Supplier.findOne({ code: code.trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Supplier with code '${code.trim()}' already exists`,
        });
      }

      const phone1 = telephone1 ? telephone1.trim() : '';
      const phone2 = telephone2 ? telephone2.trim() : '';

      const supplier = await Supplier.create({
        code: code.trim(),
        name: name.trim(),
        address: address ? address.trim() : '',
        telephone: phone1,
        telephone1: phone1,
        telephone2: phone2,
        dueAmount: 0,
        status: 'A',
      });

      return res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: {
          ...supplier.toObject(),
          telephone1: phone1,
          telephone2: phone2,
        },
      });
    }

    // In-memory creation
    const existingMem = memorySuppliers.find((s) => s.code.toLowerCase() === code.trim().toLowerCase());
    if (existingMem) {
      return res.status(400).json({
        success: false,
        message: `Supplier with code '${code.trim()}' already exists`,
      });
    }

    const newSupplier = {
      _id: 'mem_' + Date.now(),
      code: code.trim(),
      name: name.trim(),
      address: address ? address.trim() : '',
      telephone1: telephone1 ? telephone1.trim() : '',
      telephone2: telephone2 ? telephone2.trim() : '',
      createdAt: new Date(),
    };

    memorySuppliers.unshift(newSupplier);

    return res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
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
    const { code, name, address, telephone1, telephone2 } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name is required',
      });
    }

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(id)) {
      const supplier = await Supplier.findById(id);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found',
        });
      }

      supplier.name = name.trim();
      if (code) supplier.code = code.trim();
      supplier.address = address !== undefined ? address.trim() : supplier.address;
      
      const p1 = telephone1 !== undefined ? telephone1.trim() : (supplier.telephone1 || supplier.telephone || '');
      const p2 = telephone2 !== undefined ? telephone2.trim() : (supplier.telephone2 || '');
      
      supplier.telephone = p1;
      supplier.telephone1 = p1;
      supplier.telephone2 = p2;

      await supplier.save();

      return res.status(200).json({
        success: true,
        message: 'Supplier updated successfully',
        data: {
          ...supplier.toObject(),
          telephone1: p1,
          telephone2: p2,
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

    memorySuppliers[index] = {
      ...memorySuppliers[index],
      name: name.trim(),
      ...(code && { code: code.trim() }),
      address: address !== undefined ? address.trim() : memorySuppliers[index].address,
      telephone1: telephone1 !== undefined ? telephone1.trim() : memorySuppliers[index].telephone1,
      telephone2: telephone2 !== undefined ? telephone2.trim() : memorySuppliers[index].telephone2,
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
 * @desc    Delete a supplier
 */
export const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(id)) {
      const supplier = await Supplier.findByIdAndDelete(id);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Supplier deleted successfully',
        data: { id },
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
      message: 'Supplier deleted successfully',
      data: deleted[0],
    });
  } catch (error) {
    next(error);
  }
};
