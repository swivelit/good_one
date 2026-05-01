const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../Db/prisma');
const { uploadsDir } = require('../config/uploads');
const { assertCleanFields } = require('../utils/contentModeration');
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
  const values = Array.isArray(tags) ? tags : String(tags).split(',');
  return values
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean);
};

const normalizeSearchTerm = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );

const getHeaderValue = (value) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const buildGuestViewerKey = (req) => {
  const headerViewerId = String(getHeaderValue(req.headers['x-viewer-id']) || '').trim();
  if (headerViewerId) return `guest:${headerViewerId.slice(0, 128)}`;

  const fingerprint = `${req.ip || ''}|${req.headers['user-agent'] || ''}`;
  const hash = crypto.createHash('sha256').update(fingerprint).digest('hex');
  return `guest:fingerprint:${hash}`;
};

const deleteUploadedFile = async (fileName) => {
  if (!fileName || /^https?:\/\//i.test(fileName)) return;

  const filePath = path.join(uploadsDir, path.basename(fileName));
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to delete uploaded file: ${path.basename(fileName)}`);
    }
  }
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

const assertCleanProductFields = (body) => {
  assertCleanFields({
    title: body.title,
    description: body.description,
    category: body.category,
    condition: body.condition,
    location: body.location,
    tags: body.tags,
  });
};

const validateProductPricing = (body) => {
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return 'Product price must be a valid non-negative number.';
    }
  }

  if (body.originalPrice !== undefined && body.originalPrice !== '') {
    const originalPrice = Number(body.originalPrice);
    if (!Number.isFinite(originalPrice) || originalPrice < 0) {
      return 'Original price must be a valid non-negative number.';
    }
  }

  return null;
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

    const normalizedCategory = String(category || '').trim();
    if (
      normalizedCategory &&
      normalizedCategory !== 'All' &&
      normalizedCategory.toLowerCase() !== 'all'
    ) {
      where.category = normalizedCategory;
    }

    const normalizedSearch = normalizeSearchTerm(search);
    if (normalizedSearch) {
      const normalizedSearchLower = normalizedSearch.toLowerCase();
      const tagTerms = Array.from(new Set([
        normalizedSearchLower,
        ...normalizedSearchLower.split(/\s+/).filter(Boolean),
      ]));

      where.OR = [
        { title: { contains: normalizedSearch, mode: 'insensitive' } },
        { description: { contains: normalizedSearch, mode: 'insensitive' } },
        { category: { contains: normalizedSearch, mode: 'insensitive' } },
        { location: { contains: normalizedSearch, mode: 'insensitive' } },
        { condition: { contains: normalizedSearch, mode: 'insensitive' } },
        ...tagTerms.map((tag) => ({ tags: { has: tag } })),
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
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id.' });
    }

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: productInclude,
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    let productForResponse = product;
    const userId = req.user?.id;
    const isOwnerView = userId && product.vendorUserId === userId;
    const isViewCountEligible = product.isActive && new Date(product.expiresAt) > new Date();

    if (isViewCountEligible && !isOwnerView) {
      const viewerUserId = userId || null;
      const viewerKey = viewerUserId ? `user:${viewerUserId}` : buildGuestViewerKey(req);

      try {
        const [, updatedProduct] = await prisma.$transaction([
          prisma.productView.create({
            data: {
              productId: product.id,
              viewerUserId,
              viewerKey,
            },
          }),
          prisma.product.update({
            where: { id: product.id },
            data: { views: { increment: 1 } },
            include: productInclude,
          }),
        ]);

        productForResponse = updatedProduct;
      } catch (error) {
        if (error.code !== 'P2002') throw error;
      }
    }

    res.json({ success: true, product: toCompat(productForResponse) });
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
    const pricingError = validateProductPricing(req.body);
    if (pricingError) {
      return res.status(400).json({ success: false, message: pricingError });
    }

    assertCleanProductFields(req.body);

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
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id.' });
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    assertCleanProductFields(req.body);
    const pricingError = validateProductPricing(req.body);
    if (pricingError) {
      return res.status(400).json({ success: false, message: pricingError });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: productDataFromBody(req.body),
    });
    res.json({ success: true, product: toCompat(updated) });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.renewProduct = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id.' });
    }

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
        renewalCount: { increment: 1 },
      },
    });
    res.json({ success: true, message: 'Product listing renewed for 24 hours!', product: toCompat(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id.' });
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    await prisma.product.delete({ where: { id: req.params.id } });
    await Promise.all((product.images || []).map(deleteUploadedFile));

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
    if (!isUuid(req.params.vendorId)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor id.' });
    }

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
