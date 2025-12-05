const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Task routes
router.get('/', taskController.getTasks);
router.get('/stats', taskController.getTaskStats);
router.get('/overdue', taskController.getOverdueTasks);
router.get('/:id', taskController.getTask);

// Create/Update tasks
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// Task status updates
router.put('/:id/status', taskController.updateTaskStatus);
router.put('/:id/complete', taskController.completeTask);

// Subtasks
router.post('/:id/subtasks', taskController.addSubtask);
router.put('/:id/subtasks/:subtaskId', taskController.updateSubtask);
router.delete('/:id/subtasks/:subtaskId', taskController.deleteSubtask);

// Comments
router.post('/:id/comments', taskController.addComment);

module.exports = router;
