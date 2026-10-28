import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase } from '../config/database.js';
import Grn from '../models/Grn.js';
import SupplierReturn from '../models/SupplierReturn.js';
import Supplier from '../models/Supplier.js';

async function seed() {
  await connectDatabase();

  console.log('Connected to MongoDB. Seeding RAT Supplier, GRN 0000033919, and GREN 205...');

  // 1. Ensure RAT Supplier exists
  const existingRat = await Supplier.findOne({ code: 'RAT' });
  if (!existingRat) {
    await Supplier.create({
      code: 'RAT',
      name: 'RAZA AUTO TRADERS',
      address: 'COLOMBO 10',
      telephone: '011-2345678',
      mobile: '077-1234567',
      email: 'sales@razaautotraders.lk',
      status: 'active',
    });
    console.log('✅ Created Supplier RAT (RAZA AUTO TRADERS)');
  } else {
    console.log('ℹ️ Supplier RAT already exists');
  }

  // 2. Ensure Toyota Lanka and United Motors exist
  const existingSup1 = await Supplier.findOne({ code: 'SUP001' });
  if (!existingSup1) {
    await Supplier.create({
      code: 'SUP001',
      name: 'Toyota Lanka (Pvt) Ltd',
      address: 'Wattala',
      telephone: '011-2939000',
      status: 'active',
    });
  }

  // 3. Seed exact GRN from Image 1: 0000033919 (Invoice: 0000023133, Supplier: RAT)
  const existingGrn = await Grn.findOne({ grnNumber: '0000033919' });
  const grnLineItems = [
    { code: 'RCSO4', itemCode: 'RCSO4', description: 'R.COIL SPRING (COMT O/E 24170508)', quantity: 2, qty: 2, unit: 'PCS', unitPrice: 2405.00, rate: 2405.00, discount: 0, totalValue: 4810.00, value: 4810.00, locationCode: 'MAIN' },
    { code: 'BHAO2', itemCode: 'BHAO2', description: 'BORE HEAD ASSY.(O/E 175 36AA4117)*** RTN', quantity: 1, qty: 1, unit: 'SET', unitPrice: 16058.00, rate: 16058.00, discount: 0, totalValue: 16058.00, value: 16058.00, returnQty: 1, isReturned: true, locationCode: 'MAIN' },
    { code: 'CR4', itemCode: 'CR4', description: 'CRANK (4S O/E AA101033)***', quantity: 2, qty: 2, unit: 'SET', unitPrice: 14587.00, rate: 14587.00, discount: 0, totalValue: 29174.00, value: 29174.00, locationCode: 'MAIN' },
    { code: 'FAO3', itemCode: 'FAO3', description: 'FRONT AXEL (3P O/E AB171034)', quantity: 3, qty: 3, unit: 'PCS', unitPrice: 2841.00, rate: 2841.00, discount: 0, totalValue: 8523.00, value: 8523.00, locationCode: 'MAIN' },
    { code: 'EPS4O', itemCode: 'EPS4O', description: 'EN.PACKING SETS (4S O/E 36AA1003)', quantity: 5, qty: 5, unit: 'SET', unitPrice: 1058.00, rate: 1058.00, discount: 0, totalValue: 5290.00, value: 5290.00, locationCode: 'MAIN' },
    { code: 'FMO2', itemCode: 'FMO2', description: 'FR.MUDGUARD (2S O/E 52AB0098)***', quantity: 1, qty: 1, unit: 'PCS', unitPrice: 3621.00, rate: 3621.00, discount: 0, totalValue: 3621.00, value: 3621.00, locationCode: 'MAIN' },
    { code: 'SMPWO1', itemCode: 'SMPWO1', description: 'S.M.PINON WHEEL W/LK (O/E 4S AA101750)', quantity: 10, qty: 10, unit: 'PCS', unitPrice: 282.00, rate: 282.00, discount: 0, totalValue: 2820.00, value: 2820.00, locationCode: 'MAIN' },
    { code: 'OCO3', itemCode: 'OCO3', description: 'OIL COOLER (COMT O/E AA102195)', quantity: 1, qty: 1, unit: 'SET', unitPrice: 5539.00, rate: 5539.00, discount: 0, totalValue: 5539.00, value: 5539.00, locationCode: 'MAIN' },
    { code: '2A4O', itemCode: '2A4O', description: 'CARBURETTOR (4S O/E S/L AA121090) RTN', quantity: 1, qty: 1, unit: 'SET', unitPrice: 6195.00, rate: 6195.00, discount: 0, totalValue: 6195.00, value: 6195.00, returnQty: 1, isReturned: true, locationCode: 'MAIN' },
    { code: 'BHOL41', itemCode: 'BHOL41', description: 'BLLHOUSING (O/E COMT "LH" AA161190)', quantity: 3, qty: 3, unit: 'PCS', unitPrice: 830.00, rate: 830.00, discount: 0, totalValue: 2490.00, value: 2490.00, locationCode: 'MAIN' },
    { code: 'FHL2S', itemCode: 'FHL2S', description: 'FR/HUB LINK (2S O/E AB171049)', quantity: 1, qty: 1, unit: 'PCS', unitPrice: 357.00, rate: 357.00, discount: 0, totalValue: 357.00, value: 357.00, locationCode: 'MAIN' },
    { code: 'ICO4', itemCode: 'ICO4', description: 'IG.COIL (4S O/E AF111010)***', quantity: 2, qty: 2, unit: 'PCS', unitPrice: 2200.00, rate: 2200.00, discount: 0, totalValue: 4400.00, value: 4400.00, locationCode: 'MAIN' },
    { code: 'CLO2', itemCode: 'CLO2', description: 'CLUTCH LEVER (2S O/E AA191032)', quantity: 4, qty: 4, unit: 'PCS', unitPrice: 328.00, rate: 328.00, discount: 0, totalValue: 1312.00, value: 1312.00, locationCode: 'MAIN' },
    { code: 'AFR1', itemCode: 'AFR1', description: 'AIR FILTER ROUND (O/E ORA AL121062)', quantity: 4, qty: 4, unit: 'PCS', unitPrice: 1536.00, rate: 1536.00, discount: 0, totalValue: 6144.00, value: 6144.00, locationCode: 'MAIN' },
    { code: 'OPO4', itemCode: 'OPO4', description: 'OIL CAP (SMALL COMT O/E AN131007)', quantity: 2, qty: 2, unit: 'PCS', unitPrice: 62.00, rate: 62.00, discount: 0, totalValue: 124.00, value: 124.00, locationCode: 'MAIN' },
    { code: 'BPO41', itemCode: 'BPO41', description: 'BORE PACKING (O/E COMT AN101135)', quantity: 10, qty: 10, unit: 'PCS', unitPrice: 120.00, rate: 120.00, discount: 0, totalValue: 1200.00, value: 1200.00, locationCode: 'MAIN' },
  ];

  const grnData = {
    no: 33919,
    grnNumber: '0000033919',
    supplierCode: 'RAT',
    supplier: 'RAZA AUTO TRADERS',
    supplierName: 'RAZA AUTO TRADERS',
    supplierInvoiceNo: '0000023133',
    invoice: '0000023133',
    paidBy: 'Cash',
    masterPo: '',
    remark: '3.5% OE O 04',
    categoryCode: 'C3',
    discountPercent: 3.50,
    discountAmount: 3432.00,
    vatPercent: 0,
    vatAmount: 0,
    subTotal: 98057.00,
    grnValue: 94625.00,
    totalValue: 94625.00,
    returnTotal: 0,
    grandTotal: 94625.00,
    date: new Date('2026-08-01T10:00:00Z'),
    lineItems: grnLineItems,
    isPosted: true,
    status: 'active',
  };

  if (existingGrn) {
    await Grn.updateOne({ grnNumber: '0000033919' }, { $set: grnData });
    console.log('✅ Updated GRN 0000033919');
  } else {
    await Grn.create(grnData);
    console.log('✅ Created GRN 0000033919');
  }

  // Also seed a second GRN for Toyota Lanka (SUP001) for diversity
  const existingGrn2 = await Grn.findOne({ grnNumber: '0000033920' });
  if (!existingGrn2) {
    await Grn.create({
      no: 33920,
      grnNumber: '0000033920',
      supplierCode: 'SUP001',
      supplier: 'Toyota Lanka (Pvt) Ltd',
      supplierName: 'Toyota Lanka (Pvt) Ltd',
      supplierInvoiceNo: 'TL-INV-9921',
      invoice: 'TL-INV-9921',
      paidBy: 'Credit',
      remark: 'Monthly intake',
      categoryCode: 'C1',
      discountPercent: 0,
      discountAmount: 0,
      vatPercent: 0,
      vatAmount: 0,
      subTotal: 45000.00,
      grnValue: 45000.00,
      totalValue: 45000.00,
      date: new Date('2026-08-03T11:00:00Z'),
      lineItems: [
        { code: 'OIL-FILTER-TY', itemCode: 'OIL-FILTER-TY', description: 'TOYOTA OIL FILTER GENUINE', quantity: 15, qty: 15, unit: 'PCS', unitPrice: 3000.00, rate: 3000.00, discount: 0, totalValue: 45000.00, value: 45000.00, locationCode: 'MAIN' }
      ],
      isPosted: true,
      status: 'active',
    });
    console.log('✅ Created GRN 0000033920 (Toyota Lanka)');
  }

  // 4. Seed exact Goods Return Note from Image 2: G.RE.N: 205 (Supplier: RAT, Date: 06/08/2026)
  const existingGren = await SupplierReturn.findOne({ $or: [{ no: 205 }, { returnNumber: '205' }] });
  const grenLineItems = [
    {
      no: 1,
      itemCode: 'SF36AA4117',
      code: 'SF36AA4117',
      description: 'ASSY CYL. HEAD_VALVE 4S- 175 (DUPLICATE PA',
      unitPrice: 16058.00,
      rate: 16058.00,
      quantity: 1.00,
      qty: 1.00,
      returnQuantity: 1.00,
      qtyReturn: 1.00,
      discount: 3.5,
      totalValue: 15495.97,
      value: 15495.97,
      returnValue: 15495.97,
      locationCode: 'MAIN',
    },
    {
      no: 2,
      itemCode: 'SFAA121090',
      code: 'SFAA121090',
      description: 'CARBURETTOR COMP 4S (DUPLICATE PART)',
      unitPrice: 6195.00,
      rate: 6195.00,
      quantity: 1.00,
      qty: 1.00,
      returnQuantity: 1.00,
      qtyReturn: 1.00,
      discount: 3.5,
      totalValue: 5978.18,
      value: 5978.18,
      returnValue: 5978.18,
      locationCode: 'MAIN',
    },
  ];

  const grenData = {
    no: 205,
    returnNumber: '205',
    grenNumber: '205',
    grnReference: '0000033919',
    grnNumber: '0000033919',
    supplierCode: 'RAT',
    supplierName: 'RAZA AUTO TRADERS',
    supplierInvoiceNo: '0000023133',
    invoice: '0000023133',
    date: new Date('2026-08-06T10:00:00Z'),
    time: '10:30:00 AM',
    userCode: 'PC004',
    lineItems: grenLineItems,
    returnTotal: 21474.15,
    totalReturnValue: 21474.15,
    subTotal: 21474.15,
    grandTotal: 21474.15,
    isPosted: true,
    status: 'active',
    remarks: 'Parts returned to RAT under invoice 0000023133',
  };

  if (existingGren) {
    await SupplierReturn.updateOne({ _id: existingGren._id }, { $set: grenData });
    console.log('✅ Updated G.RE.N 205');
  } else {
    await SupplierReturn.create(grenData);
    console.log('✅ Created G.RE.N 205');
  }

  console.log('🎉 Seeding successfully finished!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
