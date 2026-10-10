import mongoose from 'mongoose';
import Customer from '../models/Customer.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Normalize Customer document for frontend compatibility
 */
const normalizeCustomer = (c) => {
  if (!c) return null;

  const code = c.code || c.customerCode || '';
  const tel1 = c.telephone || c.telephone1 || (Array.isArray(c.telephoneNumbers) && c.telephoneNumbers[0]) || '';
  const tel2 = c.telephone2 || (Array.isArray(c.telephoneNumbers) && c.telephoneNumbers[1]) || '';

  const gtnVal =
    c.gtnAllowed !== undefined
      ? c.gtnAllowed
      : c.cusGtn === 1 || c.cusGtn === true
      ? 'Yes'
      : 'No';

  const use2ndPriceVal =
    c.use2ndPrice !== undefined
      ? c.use2ndPrice
      : c.use2Price === 1 || c.use2Price === true
      ? 'Yes'
      : 'No';

  const discountVal = c.discount !== undefined ? Number(c.discount) : c.discountRate !== undefined ? Number(c.discountRate) : 0;
  const targetVal = c.target !== undefined ? Number(c.target) : c.targetAmount !== undefined ? Number(c.targetAmount) : 0;
  const dueAmt = c.dueAmount !== undefined ? Number(c.dueAmount) : c.outstandingBalance !== undefined ? Number(c.outstandingBalance) : 0;
  const vat = c.vatNo || c.vatNumber || '';

  return {
    _id: c._id,
    code,
    customerCode: code,
    name: c.name || '',
    address: c.address || '',
    telephone: tel1,
    telephone1: tel1,
    telephone2: tel2,
    telephoneNumbers: [tel1, tel2].filter(Boolean),
    route: c.route || '',
    category: c.category || '',
    accNo: c.accNo || '',
    target: targetVal,
    targetAmount: targetVal,
    notes: c.notes || c.remark || '',
    gtnAllowed: gtnVal,
    cusGtn: gtnVal === 'Yes' ? 1 : 0,
    discount: discountVal,
    discountRate: discountVal,
    creditLimit: Number(c.creditLimit || 0),
    dueAmount: dueAmt,
    outstandingBalance: dueAmt,
    creditPeriod: Number(c.creditPeriod || 0),
    use2ndPrice: use2ndPriceVal,
    use2Price: use2ndPriceVal === 'Yes' ? 1 : 0,
    vatNo: vat,
    vatNumber: vat,
    status: c.status || 'Active',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

/**
 * GET /api/customers/next-code
 * Automatically generate the next customer code
 */
export const getNextCustomerCode = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        nextCode: 'CUS-0001',
      });
    }

    const lastCustomer = await Customer.findOne({
      code: { $regex: /^CUS-\d+$/i },
    })
      .sort({ code: -1 })
      .lean();

    let nextNumber = 1;
    if (lastCustomer && lastCustomer.code) {
      const match = lastCustomer.code.match(/\d+$/);
      if (match) {
        nextNumber = parseInt(match[0], 10) + 1;
      }
    } else {
      const count = await Customer.countDocuments();
      nextNumber = count + 1;
    }

    const nextCode = `CUS-${String(nextNumber).padStart(4, '0')}`;
    return res.status(200).json({
      success: true,
      nextCode,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customers
 * Fetch customers with search, filtering and sorting
 */
export const getCustomers = async (req, res, next) => {
  try {
    const { search, limit = 500, page = 1 } = req.query;
    const query = {};

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { code: regex },
        { customerCode: regex },
        { name: regex },
        { telephone: regex },
        { telephone1: regex },
        { telephone2: regex },
        { address: regex },
        { route: regex },
        { category: regex },
        { vatNo: regex },
        { vatNumber: regex },
        { accNo: regex },
      ];
    }

    const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 500), 2000);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
        page: 1,
        totalPages: 1,
      });
    }

    const [customers, total] = await Promise.all([
      Customer.find(query).sort({ updatedAt: -1, name: 1 }).skip(skip).limit(parsedLimit).lean(),
      Customer.countDocuments(query),
    ]);

    const normalizedCustomers = customers.map(normalizeCustomer);

    return res.status(200).json({
      success: true,
      data: normalizedCustomers,
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customers/:id
 * Get single customer by ID or Code
 */
export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID or Code is required',
      });
    }

    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    const cleanId = id.trim();
    let customer = null;

    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      customer = await Customer.findById(cleanId).lean();
    }
    if (!customer) {
      customer = await Customer.findOne({
        $or: [
          { code: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
          { customerCode: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
        ],
      }).lean();
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer '${cleanId}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: normalizeCustomer(customer),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customers
 * Create a new customer
 */
export const createCustomer = async (req, res, next) => {
  try {
    const body = req.body;

    if (!body.name || !body.name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required',
      });
    }

    let customerCode = body.code?.trim() || body.customerCode?.trim();

    // Auto-generate code if empty
    if (!customerCode) {
      const count = await Customer.countDocuments();
      customerCode = `CUS-${String(count + 1).padStart(4, '0')}`;
    }

    // Check duplicate code
    const existing = await Customer.findOne({
      $or: [
        { code: { $regex: new RegExp(`^${customerCode}$`, 'i') } },
        { customerCode: { $regex: new RegExp(`^${customerCode}$`, 'i') } },
      ],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Customer with code '${customerCode}' already exists`,
      });
    }

    const tel1 = body.telephone || body.telephone1 || '';
    const tel2 = body.telephone2 || '';
    const telNumbers = [tel1, tel2].filter(Boolean);

    const gtn = body.gtnAllowed === 'No' || body.gtnAllowed === '0' || body.cusGtn === 0 ? 'No' : 'Yes';
    const use2nd = body.use2ndPrice === 'Yes' || body.use2ndPrice === '1' || body.use2Price === 1 ? 'Yes' : 'No';

    const newCustomer = new Customer({
      code: customerCode,
      customerCode: customerCode,
      name: body.name.trim(),
      address: body.address || '',
      telephone: tel1,
      telephone1: tel1,
      telephone2: tel2,
      telephoneNumbers: telNumbers,
      route: body.route || '',
      category: body.category || '',
      accNo: body.accNo || '',
      target: Number(body.target || body.targetAmount || 0),
      targetAmount: Number(body.target || body.targetAmount || 0),
      notes: body.notes || body.remark || '',
      remark: body.notes || body.remark || '',
      gtnAllowed: gtn,
      cusGtn: gtn === 'Yes' ? 1 : 0,
      discount: Number(body.discount || body.discountRate || 0),
      discountRate: Number(body.discount || body.discountRate || 0),
      creditLimit: Number(body.creditLimit || 0),
      dueAmount: Number(body.dueAmount || body.outstandingBalance || 0),
      outstandingBalance: Number(body.dueAmount || body.outstandingBalance || 0),
      creditPeriod: Number(body.creditPeriod || 0),
      use2ndPrice: use2nd,
      use2Price: use2nd === 'Yes' ? 1 : 0,
      vatNo: body.vatNo || body.vatNumber || '',
      vatNumber: body.vatNo || body.vatNumber || '',
      status: body.status || 'Active',
    });

    const saved = await newCustomer.save();

    return res.status(201).json({
      success: true,
      message: `Customer '${saved.name}' created successfully with code '${customerCode}'`,
      data: normalizeCustomer(saved.toObject()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/customers/:id
 * Update an existing customer
 */
export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID or Code is required',
      });
    }

    const cleanId = id.trim();
    let query = {};
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      query._id = cleanId;
    } else {
      query.$or = [
        { code: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
        { customerCode: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
      ];
    }

    const existingCustomer = await Customer.findOne(query);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: `Customer '${cleanId}' not found`,
      });
    }

    const tel1 = body.telephone !== undefined ? body.telephone : (body.telephone1 !== undefined ? body.telephone1 : existingCustomer.telephone);
    const tel2 = body.telephone2 !== undefined ? body.telephone2 : existingCustomer.telephone2;
    const telNumbers = [tel1, tel2].filter(Boolean);

    const gtn = body.gtnAllowed !== undefined ? body.gtnAllowed : existingCustomer.gtnAllowed || 'Yes';
    const use2nd = body.use2ndPrice !== undefined ? body.use2ndPrice : existingCustomer.use2ndPrice || 'No';

    const updateFields = {
      name: body.name ? body.name.trim() : existingCustomer.name,
      address: body.address !== undefined ? body.address : existingCustomer.address,
      telephone: tel1,
      telephone1: tel1,
      telephone2: tel2,
      telephoneNumbers: telNumbers,
      route: body.route !== undefined ? body.route : existingCustomer.route,
      category: body.category !== undefined ? body.category : existingCustomer.category,
      accNo: body.accNo !== undefined ? body.accNo : existingCustomer.accNo,
      target: body.target !== undefined ? Number(body.target) : existingCustomer.target,
      targetAmount: body.target !== undefined ? Number(body.target) : existingCustomer.targetAmount,
      notes: body.notes !== undefined ? body.notes : existingCustomer.notes,
      remark: body.notes !== undefined ? body.notes : existingCustomer.remark,
      gtnAllowed: gtn,
      cusGtn: gtn === 'Yes' ? 1 : 0,
      discount: body.discount !== undefined ? Number(body.discount) : existingCustomer.discount,
      discountRate: body.discount !== undefined ? Number(body.discount) : existingCustomer.discountRate,
      creditLimit: body.creditLimit !== undefined ? Number(body.creditLimit) : existingCustomer.creditLimit,
      dueAmount: body.dueAmount !== undefined ? Number(body.dueAmount) : existingCustomer.dueAmount,
      outstandingBalance: body.dueAmount !== undefined ? Number(body.dueAmount) : existingCustomer.outstandingBalance,
      creditPeriod: body.creditPeriod !== undefined ? Number(body.creditPeriod) : existingCustomer.creditPeriod,
      use2ndPrice: use2nd,
      use2Price: use2nd === 'Yes' ? 1 : 0,
      vatNo: body.vatNo !== undefined ? body.vatNo : (body.vatNumber !== undefined ? body.vatNumber : existingCustomer.vatNo),
      vatNumber: body.vatNo !== undefined ? body.vatNo : (body.vatNumber !== undefined ? body.vatNumber : existingCustomer.vatNumber),
      status: body.status || existingCustomer.status || 'Active',
    };

    if (body.code && body.code.trim()) {
      updateFields.code = body.code.trim();
      updateFields.customerCode = body.code.trim();
    }

    const updated = await Customer.findByIdAndUpdate(
      existingCustomer._id,
      { $set: updateFields },
      { new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: `Customer '${updated.name}' updated successfully`,
      data: normalizeCustomer(updated),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/customers/:id
 * Delete a customer
 */
export const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID or Code is required',
      });
    }

    const cleanId = id.trim();
    let query = {};
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      query._id = cleanId;
    } else {
      query.$or = [
        { code: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
        { customerCode: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
      ];
    }

    const deleted = await Customer.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Customer '${cleanId}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Customer '${deleted.name}' deleted successfully`,
      data: { code: deleted.code || deleted.customerCode, name: deleted.name },
    });
  } catch (error) {
    next(error);
  }
};
