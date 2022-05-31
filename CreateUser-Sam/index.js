var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var aws = require("aws-sdk");
var userModel = require('./userModel.js');
var planModel = require('./plansModel.js');
var deletedUsers = require('./deletedUsers.js');
var subscriptionModel = require('./subscriptionModel.js');
var chargebee = require("chargebee");
var axios = require('axios')
const Joi = require('joi');


// Set the region 
aws.config.update({ region: 'ap-south-1' });

exports.handler = (event, context, callback) => {

    console.log('Received event:', JSON.stringify(event));
    chargebee.configure({
        site: event.stageVariables['chargebee_site'],
        api_key: event.stageVariables['chargebee_api_key']
    });

    const done = (err, res) => callback(null, {
        statusCode: err ? err : '400',
        body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });


    const getRandomString = (length) => {
        var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var result = '';
        for (var i = 0; i < length; i++) {
            result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
        }
        return result;
    }

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });

    switch (event.httpMethod) {
        case 'POST':
            console.log('POST Called')
            context.callbackWaitsForEmptyEventLoop = false;
            var body = JSON.parse(event.body);

            /* if (!body.email) {
                done('400', {
                    status: 'Email ID is not available in the input',
                    data: body
                });
            }

            if (!body.password && body.userType !== 'social') {
                done('400', {
                    status: 'Password is not available in the input',
                    data: body
                });
            }

            if (body.password) {
                //var re = (?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})
                var re = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')
                if (re.test(body.password) == false) {
                    done('400', {
                        status: 'Password at least 1 number and 1 uppercase and 1 lowercase letter, and at least 8 characters',
                        data: body
                    });
                }
            } */

            connectorMongodb.then(async () => {

                const schema = Joi.object({
                    email: Joi.string().email().required(),
                    password: Joi.string().pattern(new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')).required(),
                    firstName: Joi.string().required(),
                    lastName: Joi.string().required(),
                    userType: Joi.string().optional(),
                    phone: Joi.string().optional(),
                    location: Joi.object().optional(),
                    planId: Joi.string().optional(),
                    subscription: Joi.object().optional()
                })

                try {
                    const value = await schema.validateAsync(body);
                } catch (err) {
                    if (err.details && err.details[0] && err.details[0].message) {
                        done('422', {
                            message: err.details[0].message
                        });
                    } else {
                        done('400', {
                            err: err
                        });
                    }
                    return;
                }

                if (event.stageVariables['email_validation_check'] && event.stageVariables['email_validation_check'] == "yes") {

                    let validationUrl = `${event.stageVariables['email_validation_url']}${event.stageVariables['email_validation_api_key']}?email=${body.email}`;
                    let email_validation = await axios.get(validationUrl)

                    console.log("email_validation", JSON.stringify(email_validation.data));

                    if (email_validation.data && email_validation.data.disposable && email_validation.data.disposable !== false
                        && email_validation.data.is_reachable !== "safe") {

                        done('422', {
                            message: "Enter Valid Email"
                        });
                        return
                    }
                }

                const mdQuery = { 'email': { $regex: new RegExp("^" + body.email, "i") } };

                let deletedUserCount = await deletedUsers.countDocuments(mdQuery)
                if (deletedUserCount == 0) {
                    let userCount = await userModel.countDocuments(mdQuery)
                    if (userCount === 0) {
                        let subscriptionCount = await subscriptionModel.countDocuments(mdQuery)
                        if (subscriptionCount === 0) {
                            if (body.userType == 'social') {
                                body.password = null;
                            } else {
                                var salt = bcrypt.genSaltSync(10);
                                var hash = bcrypt.hashSync(body.password, salt);
                                body.password = hash;
                            }
                            body.email = body.email.toLowerCase()
                            var user = new userModel(body);
                            user.status = 'inactive'
                            const actString = getRandomString(10);
                            user.activationString = actString
                            if (body.lng) {
                                user.location.lng = body.lng;
                            }
                            if (body.lat) {
                                user.location.lat = body.lat;
                            }
                            if (body.formatted_address) {
                                user.formatted_address = body.formatted_address;
                            }
                            try {
                                let customer = {}
                                let subscription = {}
                                if (body.planId === (null || undefined) || body.planId == "FreePlan-USD-Monthly" || body.planId == "FreePlan-USD-Yearly") {
                                    body.planId = "FreePlan-USD-Yearly"
                                    let planData = await planModel.findOne({ 'planId': body.planId })

                                    if (planData.price <= 0) {

                                        let customerData = {}
                                        if (body.firstName) {
                                            customerData.first_name = body.firstName;
                                        }
                                        if (body.lastName) {
                                            customerData.last_name = body.lastName;
                                        }
                                        customerData.email = body.email;
                                        customerData.locale = "en-IN";
                                        /* if (planData.price > 0) {
                                            if (!body.card_number || !body.expiry_month || !body.expiry_year || !body.cvv) {
                                                done('400', {
                                                    status: 'Card Details Required',
                                                    data: body
                                                });
                                            }
                                            customerData.card = {}
                                            if (body.firstName) {
                                                customerData.card.first_name = body.firstName;
                                            }
                                            if (body.lastName) {
                                                customerData.card.last_name = body.lastName;
                                            }
                                            customerData.card.number = body.card_number;
                                            customerData.card.expiry_month = body.expiry_month;
                                            customerData.card.expiry_year = body.expiry_year;
                                            customerData.card.cvv = body.cvv;
                                        } */
                                        customer = await chargebee.customer.create(customerData).request();

                                        let subscription_items = [
                                            {
                                                item_price_id: planData.planId,
                                                unit_price: planData.price
                                            }
                                        ]
                                        if (customer && customer.customer && customer.customer.id) {
                                            let subscriptionData = await chargebee.subscription.create_with_items(customer.customer.id, { subscription_items }).request();
                                            subscription = subscriptionData.subscription;
                                            if (subscription && subscription.id) {
                                                var subsModel = new subscriptionModel(subscription);
                                                subsModel.email = body.email;
                                                subsModel.planId = planData.planId;
                                                subsModel.subscriptionId = subscription.id;
                                                subsModel.save();
                                            } else {
                                                done('400', {
                                                    message: 'Subscription creation failed'
                                                });
                                                return;
                                            }
                                        } else {
                                            done('400', {
                                                message: 'Customer creation failed'
                                            });
                                            return;
                                        }
                                    } else {
                                        done('400', {
                                            message: 'This plan required to card details'
                                        });
                                        return;
                                    }
                                } else {
                                    done('400', {
                                        message: 'This plan required to card details'
                                    });
                                    return;
                                }

                                user.save(function (err, docs) {

                                    // send email

                                    const emailLink = `https://e9a45i8ip3.execute-api.ap-south-1.amazonaws.com/Dev/aikyne/confirmEmail?email=${body.email}&actCode=${actString}`;
                                    const mailBody = `Hello ${body.firstName}, Kindly click on the following link to activate your storefries.com account. `
                                    const htmlMailBody = `<html> <head></head> <body style="width: 80%; text-align: justify; margin: auto; box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19); padding-top: 2%; padding-bottom: 2%;padding-right: 2%; padding-left: 2%;"> <div> <div><a href="http://www.storefries.com/" style="display:inline-block" target="_blank"><img src="https://s3.ap-south-1.amazonaws.com/www.storefries.com/images/logo.png" style="display:block;height:60px;width:160px"></img></a></div> </div> <div style="padding:20px 0 0 0;font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>Dear ${body.firstName},</b></div> <div style="font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>We're super happy to have you onboard!</b></div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">To start your Social Media Marketing journey with Storefries please confirm your email with this Confirm Account button: <br><br></div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><a style="text-decoration:none;color:#3282C9;display:inline-block;border-top:14px solid #3282C9;border-right:40px solid #3282C9;border-bottom:14px solid #3282C9;border-left:40px solid #3282C9;font-size:16px;font-weight:600;font-family:'Open Sans','Trebuchet MS',sans-serif;color:#ffffff;background-color:#3282C9" href="${emailLink}" target="_blank"><span class="il">Confirm</span> Account</a></div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">If you have any questions regarding your Storefries account, please contact us at <a href="" style="color:#2696eb;text-decoration:none" target="_blank">support@storefries.com</a> Our technical support team will assist you with anything you need. </div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">Enjoy yourself, and welcome to Storefries. </div> <div style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">Regards,</div> <div style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><b>Storefries Team</b><br></div> <div style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif"><a href="http://www.storefries.com/" style="color:#2696eb;text-decoration:none" target="_blank">www.storefries.com</a></div> <div style="border-bottom:3px solid #3282C9"></div> <div style="padding:10px 0 10px 0;font-size:12px;color:#333333;line-height:22px;font-family:'Open Sans','Trebuchet MS',sans-serif">Aikyne Technology, #4, 3rd floor, Akshaya HQ, Kazhipattur, Padur, Chennai - 603103, INDIA.<br>Phone : 9999999999 Fax: 9999999999<br>This e-mail is generated from Storefries. If you think this is SPAM, please report to <a href="mailto:support@aikyne.com" style="color:#0091ff;text-decoration:none" target="_blank">support@aikyne.com</a> for immediate action.</div> </body> </html> `;

                                    var params = {
                                        Destination: {
                                            ToAddresses: [body.email],
                                        },
                                        Message: {
                                            Body: {
                                                Html: {
                                                    Data: htmlMailBody,
                                                    Charset: "UTF-8"
                                                }
                                            },
                                            Subject: { Data: "Account activation : Storefries.com" },
                                        },
                                        Source: "dev@aikyne.com",
                                    };
                                    var sendPromise = new aws.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
                                    sendPromise.then(
                                        function (data) {
                                            done('201', {
                                                status: 'User inserted',
                                                data: {
                                                    id: docs.id,
                                                    firstName: docs.firstName,
                                                    lastName: docs.lastName,
                                                    email: body.email
                                                    //res: res.data
                                                }
                                            })
                                        }).catch(
                                            function (err) {
                                                console.error(err, err.stack);
                                                done('422', {
                                                    status: 'Error in sending mail'
                                                });
                                            });
                                });

                            } catch (error) {
                                done('401', {
                                    message: error.message
                                });
                            }
                        } else {
                            done('409', {
                                message: 'User Account already Subscribed'
                            });
                        }
                    } else {
                        done('409', {
                            status: 'User already exists',
                            data: body
                        });
                    }
                } else {
                    done('401', {
                        message: 'User Account has been deleted, please contact support team to Reregister'
                    });
                }
            }).catch(err => {
                console.log('Connection Error');
                done('501', {
                    message: err.message
                });
            })
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
