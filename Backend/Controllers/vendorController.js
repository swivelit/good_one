const prisma = require('../Db/prisma');
const { toCompat } = require('../utils/serialize');

const vendorInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, avatar: true, createdAt: true } },
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

exports.getVendor = async (req, res) => {
  try {
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
