const Task = require('../models/Task');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 20 } = req.query;
    
    let query = { assignedTo: req.user.id };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    
    const tasks = await Task.find(query)
      .populate('relatedDoctor', 'name specialty')
      .sort({ dueDate: 1, priority: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Task.countDocuments(query);
    
    res.json({
      success: true,
      data: tasks,
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

// @desc    Get task stats
// @route   GET /api/tasks/stats
// @access  Private
exports.getTaskStats = async (req, res) => {
  try {
    const stats = await Task.aggregate([
      { $match: { assignedTo: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const priorityStats = await Task.aggregate([
      { $match: { assignedTo: req.user._id, status: { $ne: 'completed' } } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        byStatus: stats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        byPriority: priorityStats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get overdue tasks
// @route   GET /api/tasks/overdue
// @access  Private
exports.getOverdueTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedTo: req.user.id,
      dueDate: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] }
    }).sort({ dueDate: 1 });
    
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('relatedDoctor', 'name specialty')
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name');
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create task
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      assignedTo: req.user.id,
      createdBy: req.user.id
    });
    
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      assignedTo: req.user.id
    });
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update task status
// @route   PUT /api/tasks/:id/status
// @access  Private
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user.id },
      { 
        status,
        completedAt: status === 'completed' ? new Date() : null
      },
      { new: true }
    );
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Complete task
// @route   PUT /api/tasks/:id/complete
// @access  Private
exports.completeTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user.id },
      { 
        status: 'completed',
        completedAt: new Date()
      },
      { new: true }
    );
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add subtask
// @route   POST /api/tasks/:id/subtasks
// @access  Private
exports.addSubtask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    task.subtasks = task.subtasks || [];
    task.subtasks.push(req.body);
    await task.save();
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update subtask
// @route   PUT /api/tasks/:id/subtasks/:subtaskId
// @access  Private
exports.updateSubtask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const subtask = task.subtasks?.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({ success: false, message: 'Subtask not found' });
    }
    
    Object.assign(subtask, req.body);
    await task.save();
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete subtask
// @route   DELETE /api/tasks/:id/subtasks/:subtaskId
// @access  Private
exports.deleteSubtask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    task.subtasks = task.subtasks?.filter(
      st => st._id.toString() !== req.params.subtaskId
    );
    await task.save();
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add comment
// @route   POST /api/tasks/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    task.comments = task.comments || [];
    task.comments.push({
      user: req.user.id,
      text: req.body.text,
      createdAt: new Date()
    });
    await task.save();
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
