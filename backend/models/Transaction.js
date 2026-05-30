const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['buy', 'sell'],
      required: true,
    },
    assetType: {
      type: String,
      enum: ['stock', 'option'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    commission: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      required: true,
    },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
