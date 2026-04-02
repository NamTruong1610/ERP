const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g. 'users:read'
  description: { type: String }
}, { timestamps: true })

const Permission = mongoose.model('Permission', permissionSchema);
module.exports = Permission;