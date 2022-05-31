var mongoose = require('mongoose');

var plansSchema = new mongoose.Schema({
    planId: String,
    planName: String,
    status: { type: String, default: 'active' },
    itemId: String,
    price: Number,
    period: { type: Number, default: 1 },
    description: String,
    periodUnit: String,
    freeQuantity: { type: Number, default: 0 },
    currency_code: { type: String, default: 'USD' }
});

plansSchema.set({ timestamps: true, versionKey: false })

var plans = module.exports = mongoose.model('plans', plansSchema);