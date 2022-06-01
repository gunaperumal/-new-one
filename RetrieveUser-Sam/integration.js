var mongoose = require('mongoose');

var socialDetail = new mongoose.Schema({
    group: String,
    name: String,
});

var integrationSchema = new mongoose.Schema({
    email: String,
    surl: socialDetail
})

var IntegrationSchema = module.exports = mongoose.model('integration', integrationSchema);