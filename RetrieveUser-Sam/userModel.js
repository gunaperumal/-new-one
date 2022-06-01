var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    userId: String,
    firstName: String, 
    lastName: String,
    email: String,
    appPreference:
    {
        dateformat: String,
        numformat: String,
        timeformat: String,
        distformat: String,
        FDOW: String,
        timezone: String,
    },
    account:
    {
        storeemail: String,
        password: String,
        phone: String,
        bio: String,
        compname: String,
        jobTitle: String,
        address1: String,
        address2: String,
        city: String,
        state: String,
        zip: String,
        website: String,
        initials: String,
        lang: String,
        country: String,
        retail: String,
        translang: String,
        applang: String,
        timefeature: String,
        plan: String,
        token: String        
    },
    integration: Object
});

var Users = module.exports = mongoose.model('users', userSchema);