const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    fName: {
      type: String
    },
    mName: {
      type: String
    },
    lName: {
      type: String
    }
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User;