const prisma = require('../Db/prisma');
const { toCompat } = require('../utils/serialize');

const productInclude = {
  vendorUser: { select: { id: true, name: true, avatar: true, email: true, phone: true } },
  vendor: {
    select: {
      id: true,
      businessName: true,
      logo: true,
      rating: true,
      totalReviews: true,
      businessDescription: true,
      businessAddress: true,
    },
  },
};

const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  return String(tags).split(',').map((tag) => tag.trim()).filter(Boolean);
};

const productDataFromBody = (body) => {
  const data = {};
  [
    'title',
    'description',
    'category',
    'condition',
    'location',
  ].forEach((field) => {
    if (body[field] !== undefined) data[field] = body[field];
  });

  if (body.price !== undefined) data.price = Number(body.price);
  if (body.originalPrice !== undefined && body.originalPrice !== '') {
    data.originalPrice = Number(body.originalPrice);
  }
  if (body.tags !== undefined) data.tags = parseTags(body.tags);

  return data;
};

exports.getProducts = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 12, 1);

    const where = {
      isActive: true,
      expiresAt: { gt: new Date() },
    };

    if (category && category !== 'All' && category !== 'all') where.category = category;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      success: true,
      products: toCompat(products),
      total,
      page: pageNumber,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
      include: productInclude,
    });

    res.json({ success: true, product: toCompat(product) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });

    const { title, description, price, category } = req.body;
    if (!title || !description || price === undefined || !category) {
      return res.status(400).json({ success: false, message: 'Missing required product fields.' });
    }

    const images = req.files ? req.files.map((file) => file.filename) : [];
    const product = await prisma.product.create({
      data: {
        ...productDataFromBody(req.body),
        vendorId: vendor.id,
        vendorUserId: req.user.id,
        images,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { totalProducts: { increment: 1 } },
    });

    res.status(201).json({ success: true, product: toCompat(product) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: productDataFromBody(req.body),
    });
    res.json({ success: true, product: toCompat(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.renewProduct = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        renewedAt: new Date(),
        isActive: true,
      },
    });
    res.json({ success: true, message: 'Product listing renewed for 24 hours!', product: toCompat(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    await prisma.product.delete({ where: { id: req.params.id } });

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (vendor && vendor.totalProducts > 0) {
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { totalProducts: { decrement: 1 } },
      });
    }

    res.json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, products: toCompat(products) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        vendorId: req.params.vendorId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, products: toCompat(products) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
