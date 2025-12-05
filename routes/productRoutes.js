const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Product catalog routes (read access for all)
router.get('/', productController.getProducts);
router.get('/categories', productController.getCategories);
router.get('/search', productController.searchProducts);
router.get('/:id', productController.getProduct);

// Admin/Manager routes for product management
router.post('/', authorize('admin', 'manager'), productController.createProduct);
router.put('/:id', authorize('admin', 'manager'), productController.updateProduct);
router.delete('/:id', authorize('admin', 'manager'), productController.deleteProduct);

// Sample distribution routes
router.get('/samples/history', productController.getSampleHistory);
router.get('/samples/received', authorize('doctor'), productController.getReceivedSamples);
router.post('/:id/samples/distribute', authorize('mr', 'admin'), productController.distributeSample);
router.get('/:id/samples/stats', productController.getSampleStats);

// Stock management
router.put('/:id/stock', authorize('admin', 'manager'), productController.updateStock);

module.exports = router;
