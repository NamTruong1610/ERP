const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
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
    },
    status: {
      type: String,
      required: true,
      default: "INACTIVE"
    }
  }, 
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
module.exports = User;