const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    activationTokenId: {
      type: String,
      required: false,
      unique: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
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
    phones: {
      type: [String]
    },
    addresses: [
      {
        street: {
          type: String
        },
        suburb: {
          type: String
        },
        post: {
          type: String
        },
        city: {
          type: String
        }

      }
    ],
    roles: {
      type: [String],
      default: ["STAFF"]
    },
    status: {
      type: String,
      required: true,
      default: "PENDING_ACTIVATION"
    },
    mfaSecret: {
      type: String,
    },
    mfaUri: {
      type: String
    },
    mfaEnabled: {
      type: Boolean
    },
    expiresAt: {
      type: Date,
      // set to null so that the TTL monitor ignores it
      default: null,
      index: { expireAfterSeconds: 0 }
    }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
module.exports = User;