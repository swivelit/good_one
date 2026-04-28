const Product = require('../Models/Product');
const Vendor = require('../Models/Vendor');

// @desc  Get all active products
// @route GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const query = { isActive: true, expiresAt: { $gt: new Date() } };
    if (category && category !== 'All') query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('vendorUser', 'name avatar')
      .populate('vendor', 'businessName logo rating')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, products, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single product
// @route GET /api/products/:id
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendorUser', 'name avatar email phone')
      .populate('vendor', 'businessName logo rating totalReviews businessDescription businessAddress');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    product.views += 1;
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create product (vendor)
// @route POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    const { title, description, price, originalPrice, category, condition, location, tags } = req.body;
    const images = req.files ? req.files.map((f) => f.filename) : [];
    const product = await Product.create({
      vendor: vendor._id,
      vendorUser: req.user._id,
      title, description, price, originalPrice, category, condition, location,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
      images,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    vendor.totalProducts += 1;
    await vendor.save();
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Update product
// @route PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, product: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Renew product (reset 24hr timer)
// @route PUT /api/products/:id/renew
exports.renewProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    product.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    product.renewedAt = new Date();
    product.isActive = true;
    await product.save();
    res.json({ success: true, message: 'Product listing renewed for 24 hours!', product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Delete product
// @route DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.vendorUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    await product.deleteOne();
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (vendor && vendor.totalProducts > 0) {
      vendor.totalProducts -= 1;
      await vendor.save();
    }
    res.json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get vendor's own products
// @route GET /api/products/my-products
exports.getMyProducts = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    const products = await Product.find({ vendor: vendor._id }).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get products by vendor
// @route GET /api/products/vendor/:vendorId
exports.getVendorProducts = async (req, res) => {
  try {
    const products = await Product.find({
      vendor: req.params.vendorId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
