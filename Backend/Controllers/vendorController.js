const prisma = require('../Db/prisma');
const { toCompat } = require('../utils/serialize');

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );

const vendorInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, avatar: true, createdAt: true } },
};

const adminVendorInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      createdAt: true,
    },
  },
};

const adminProductSelect = {
  id: true,
  title: true,
  description: true,
  price: true,
  originalPrice: true,
  category: true,
  condition: true,
  location: true,
  images: true,
  isActive: true,
  durationHours: true,
  expiresAt: true,
  renewedAt: true,
  renewalCount: true,
  views: true,
  createdAt: true,
  updatedAt: true,
};

exports.getVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isApproved: true },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    res.json({
      success: true,
      vendors: toCompat(vendors),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllVendorsAdmin = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      vendors: toCompat(vendors),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorAdmin = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor id.' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        ...adminVendorInclude,
        products: {
          select: adminProductSelect,
          orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    res.json({
      success: true,
      vendor: toCompat(vendor),
      products: toCompat(vendor.products || []),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVendorAdminProfile = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor id.' });
    }

    const existing = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    const allowed = [
      'businessName',
      'businessDescription',
      'businessCategory',
      'businessAddress',
      'website',
      'logo',
      'coverImage',
      'isApproved',
      'verificationStatus',
    ];
    const data = {};
    allowed.forEach((field) => {
      if (req.body[field] === undefined) return;
      if (field === 'isApproved') {
        data[field] = req.body[field] === true || req.body[field] === 'true';
      } else {
        data[field] = req.body[field];
      }
    });

    const updated = await prisma.vendor.update({
      where: { id: req.params.id },
      data,
      include: adminVendorInclude,
    });

    res.json({ success: true, vendor: toCompat(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendor = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor id.' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: vendorInclude,
    });

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    const products = await prisma.product.findMany({
      where: {
        vendorId: req.params.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      include: {
        vendorUser: { select: { id: true, name: true, avatar: true } },
        vendor: { select: { id: true, businessName: true, logo: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      vendor: toCompat(vendor),
      products: toCompat(products),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
      include: vendorInclude,
    });

    res.json({
      success: true,
      vendor: toCompat(vendor),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    const allowed = [
      'businessName',
      'businessDescription',
      'businessCategory',
      'businessAddress',
      'website',
      'logo',
      'coverImage',
    ];
    const data = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data,
      include: vendorInclude,
    });

    res.json({ success: true, vendor: toCompat(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
