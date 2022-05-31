var mongoose = require('mongoose');
var userModel = require('./userModel.js');
var socialModel = require('./SocialModel.js');
var axios = require('axios');
var IntegrationSchema = require('./integration.js');
var subscriptionModel = require('./subscriptionModel.js');

const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-south-1' })
const s3 = new AWS.S3()


exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? err : '200',
        body: err !== '200' ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true });
    var bucketName = `${event.stageVariables['s3_bucket_name']}`;
    // var connectorMongodb = mongoose.connect('mongodb+srv://storefries:CH8U1ZXGyeILqFWy@storefries.76ocf.mongodb.net/SocialMediaPublisher', { useNewUrlParser: true, useUnifiedTopology: true });
    // var bucketName = 'aikyne-mediafiles';

    switch (event.httpMethod) {
        case 'GET':
            console.log('GET Profile Details Called')
            context.callbackWaitsForEmptyEventLoop = false;
            if (event.headers && event.headers.userauthdata) {

                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length === 2 ? userData.split(':')[0] : '';
                if (email && email !== '') {

                    const mdQuery = { 'email': { $regex: new RegExp("^" + email, "i") } };

                    connectorMongodb.then(() => {
                        userModel.findOne(mdQuery, {
                            'firstName': 1, 'lastName': 1, 'email': 1, 'tempPlan': 1, "userType": 1, "socialLogin": 1, "userImage": 1,/*'storeemail':1,*/"location": 1, "formatted_address": 1, 'features': 1,
                            'account.phone': 1, 'account.bio': 1, 'account.jobTitle': 1, 'account.address1': 1, 'account.address2': 1, 'account.compname': "$account.storeName", 'account.retail': "$account.retailCategory",
                            'account.city': 1, 'account.state': 1, 'account.zip': 1, 'account.website': 1, 'account.initials': 1, 'account.lang': 1, 'account.country': 1, 'account.brandImage': 1,
                            'account.translang': 1, 'account.applang': 1, 'account.plan': 1, 'account.token': 1,
                            'appPreference.timezone': 1, 'appPreference.dateformat': 1, 'appPreference.numformat': 1, 'appPreference.timeformat': 1, 'appPreference.distformat': 1, 'appPreference.FDOW': 1, 'account.timefeature': 1
                        }).lean().exec(async (err, doc) => {
                            if (doc) {
                                /* IntegrationSchema.findOne(mdQuery, { 'email': 1, 'surl.group': 1, 'surl.name': 1 }).exec(function (err, integDoc) {
                                    if (integDoc) {
                                        doc['integration'] = integDoc;
                                    }
                                    subscriptionModel.findOne(mdQuery, { 'subscription_items': 0 }).exec(async (err, subscriptionDoc) => {
                                        let listSize = await getListingS3(`${doc._id}/clib/`);
                                        console.log("listSize", listSize);
                                        console.log("typeof", Number(listSize));
                                        if (doc.features) {
                                            doc.features.currentUploadSize = Number(listSize);
                                        }

                                        if (subscriptionDoc) {
                                            doc.subscription = subscriptionDoc;
                                            done('200', {
                                                status: "User Profile Retrieved",
                                                data: doc
                                            });
                                        } else {
                                            done('200', {
                                                status: "User Profile Retrieved",
                                                data: doc
                                            });
                                        }
                                    })
                                }) */
                                let getRecentInstaProfilePicture = (userId, accessToken) => {
                                    return new Promise(async (resolve, reject) => {
                                        let url = `https://graph.facebook.com/${userId}?fields=id,name,profile_picture_url,username&access_token=${accessToken}`;
                                        axios.get(url, null).then(async (resp) => {
                                            if (resp.data) {
                                                socialModel.updateOne(
                                                    { "email": email, "socialMedia.userId" :  userId },
                                                    { $set: { "socialMedia.$.userProfileImage" : resp.data.profile_picture_url } }
                                                 ).exec(function (err, doc) {
                                                    resolve({ status: true })
                                                })
                                            } else {
                                                resolve({ status: false })
                                            }
                                        }).catch(err => {
                                            console.log("err", JSON.stringify(err))
                                            resolve({
                                                status: false
                                            })
                                        })

                                    });
                                };

                                let Integration = async () => {
                                    return new Promise((resolve, reject) => {
                                        IntegrationSchema.findOne(mdQuery, { 'email': 1, 'surl.group': 1, 'surl.name': 1 }).exec(function (err, integDoc) {
                                            if (integDoc) {
                                                //doc['integration'] = integDoc;
                                                resolve({ integrationData: integDoc });
                                            } else {
                                                resolve({ integrationData: integDoc });
                                            }
                                        });
                                    })
                                }
                                let subscription = async () => {
                                    return new Promise((resolve, reject) => {
                                        try {
                                            subscriptionModel.findOne(mdQuery, { 'subscription_items': 0 }).exec(async (err, subscriptionDoc) => {
                                                if (subscriptionDoc) {
                                                    //doc.subscription = subscriptionDoc;
                                                    resolve({ subscriptionData: subscriptionDoc });
                                                } else {
                                                    resolve({ subscriptionData: subscriptionDoc });
                                                }
                                            });
                                        } catch (e) {
                                            reject(e);
                                        }
                                    })
                                }

                                let getListingS3 = async (prefix) => {
                                    return new Promise((resolve, reject) => {
                                        try {
                                            let params = {
                                                Bucket: bucketName,
                                                MaxKeys: 1000,
                                                Prefix: prefix,
                                                Delimiter: prefix
                                            };
                                            let size = 0;
                                            listAllKeys();
                                            function listAllKeys() {
                                                s3.listObjectsV2(params, function (err, data) {
                                                    if (err) {
                                                        reject(err)
                                                    } else {
                                                        var listData = data.Contents;
                                                        listData.forEach(function (content) {
                                                            size = size + content.Size;
                                                        });

                                                        if (data.IsTruncated) {
                                                            params.ContinuationToken = data.NextContinuationToken;
                                                            listAllKeys();
                                                        } else {
                                                            if (size > 0) {
                                                                let finalSize = bytesToSize(size)
                                                                console.log("size...........", typeof parseInt(finalSize))
                                                                resolve({ listSize: parseFloat(finalSize).toFixed(1) });
                                                            } else {
                                                                resolve(size);
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                        } catch (e) {
                                            reject(e);
                                        }
                                    });
                                }

                                let instagramProfile = async () => {
                                    return new Promise((resolve, reject) => {
                                        socialModel.aggregate(
                                            [{ "$match": { email: email } },
                                            { "$unwind": "$socialMedia" },
                                            { "$match": { "socialMedia.name": "instagram" } },
                                            { "$project": { _id: 0, "access_token": "$socialMedia.oauth_token", "userId": "$socialMedia.userId", "name": "$socialMedia.name" } }
                                            ]
                                        ).exec(async (err, doc) => {
                                            if (doc) {
                                                const promiseData = [];
                                                doc.forEach(instadata => {
                                                    promiseData.push(getRecentInstaProfilePicture(instadata.userId, instadata.access_token))
                                                });
                                                await Promise.all(promiseData).then(res => {
                                                    resolve({ status: true, data: res })
                                                }).catch(err => {
                                                    resolve({
                                                        status: false
                                                    })
                                                })

                                            }

                                        })
                                    })
                                }

                                function bytesToSize(bytes) {
                                    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                                    if (bytes == 0) return '0';
                                    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));

                                    return bytes / Math.pow(1024, 2);
                                }

                                const promiseArray = [];

                                promiseArray.push(Integration());
                                promiseArray.push(subscription());
                                promiseArray.push(getListingS3(`${doc._id}/clib/`));
                                promiseArray.push(instagramProfile());

                                await Promise.all(promiseArray).then(resArr => {
                                    console.log("resArr.................", JSON.stringify(resArr))
                                    if (resArr[1].subscriptionData == null) {
                                        done('403', {
                                            status: "You are not subscribed, Please subscribe.",
                                            data: doc
                                        });
                                        return;
                                    } else {
                                        if (resArr[0].integrationData) {
                                            doc['integration'] = resArr[0].integrationData;
                                        }
                                        if (resArr[1].subscriptionData) {
                                            doc['subscription'] = resArr[1].subscriptionData;
                                        }
                                        if (resArr[2].listSize) {
                                            doc.features.currentUploadSize = Number(resArr[2].listSize);
                                        }
                                    }

                                    done('200', {
                                        status: "User Profile Retrieved",
                                        data: doc
                                    });
                                })
                            } else {
                                done('200', {
                                    status: "User Profile not found"
                                });
                            }
                        });
                    },
                        (err) => { console.log('Connection Error'); });
                }

            } else {
                done('403', {
                    status: "Unauthorized"
                });
            }

            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
