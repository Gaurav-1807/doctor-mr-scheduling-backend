const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    
    let query = { isActive: true };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const products = await Product.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Product.countDocuments(query);
    
    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Private
exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Private
exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json({ success: true, data: [] });
    }
    
    const products = await Product.find({
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { composition: { $regex: q, $options: 'i' } }
      ]
    }).limit(20);
    
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private (Admin)
exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get sample distribution history (for MR - samples they distributed)
// @route   GET /api/products/samples/history
// @access  Private
exports.getSampleHistory = async (req, res) => {
  try {
    const products = await Product.find({
      'sampleDistribution.distributedBy': req.user.id
    }).select('name sampleDistribution');
    
    const history = [];
    products.forEach(product => {
      product.sampleDistribution.forEach(dist => {
        if (dist.distributedBy.toString() === req.user.id) {
          history.push({
            productId: product._id,
            productName: product.name,
            ...dist.toObject()
          });
        }
      });
    });
    
    history.sort((a, b) => new Date(b.distributedAt) - new Date(a.distributedAt));
    
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get received samples (for Doctor - samples they received)
// @route   GET /api/products/samples/received
// @access  Private (Doctor)
exports.getReceivedSamples = async (req, res) => {
  try {
    const MR = require('../models/MR');
    
    const products = await Product.find({
      'sampleDistribution.distributedTo': req.user.id
    }).select('name images category sampleDistribution');
    
    const received = [];
    
    for (const product of products) {
      for (const dist of product.sampleDistribution) {
        if (dist.distributedTo && dist.distributedTo.toString() === req.user.id) {
          // Get MR details
          const mr = await MR.findById(dist.distributedBy).select('name company');
          
          received.push({
            productId: product._id,
            productName: product.name,
            productImage: product.images?.[0] || null,
            productCategory: product.category,
            quantity: dist.quantity,
            notes: dist.notes,
            distributedAt: dist.distributedAt,
            mrName: mr?.name || 'Unknown',
            mrCompany: mr?.company || 'Unknown'
          });
        }
      }
    }
    
    // Sort by most recent first
    received.sort((a, b) => new Date(b.distributedAt) - new Date(a.distributedAt));
    
    res.json({ success: true, data: received });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Distribute sample
// @route   POST /api/products/:id/samples/distribute
// @access  Private (MR)
exports.distributeSample = async (req, res) => {
  try {
    const { quantity, doctorId, notes } = req.body;
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    if (product.stockQuantity < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }
    
    // Add distribution record
    product.sampleDistribution.push({
      distributedTo: doctorId,
      distributedBy: req.user.id,
      quantity,
      notes,
      distributedAt: new Date()
    });
    
    // Update stock
    product.stockQuantity -= quantity;
    
    await product.save();
    
    res.json({ success: true, message: 'Sample distributed successfully', data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get sample stats for a product
// @route   GET /api/products/:id/samples/stats
// @access  Private
exports.getSampleStats = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('sampleDistribution.distributedTo', 'name')
      .populate('sampleDistribution.distributedBy', 'name');
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const totalDistributed = product.sampleDistribution.reduce(
      (sum, dist) => sum + dist.quantity, 0
    );
    
    res.json({
      success: true,
      data: {
        totalDistributed,
        currentStock: product.stockQuantity,
        distributionHistory: product.sampleDistribution
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update stock
// @route   PUT /api/products/:id/stock
// @access  Private (Admin)
exports.updateStock = async (req, res) => {
  try {
    const { quantity, operation } = req.body;
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    if (operation === 'add') {
      product.stockQuantity += quantity;
    } else if (operation === 'set') {
      product.stockQuantity = quantity;
    } else {
      product.stockQuantity = Math.max(0, product.stockQuantity - quantity);
    }
    
    await product.save();
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
