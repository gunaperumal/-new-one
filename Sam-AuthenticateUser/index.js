var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var axios = require('axios')
const https = require('https');

var userModel = require('./userModel.js');

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message ? err.message : JSON.stringify(res) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });
    console.log("event.stageVariables['mongoDB']", event.stageVariables['mongoDB'])

    var connectorMongodb = mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });

    console.log("connectorMongodb", connectorMongodb)

    switch (event.httpMethod) {
        case 'POST':
            console.log('Authenticate POST Called')
            context.callbackWaitsForEmptyEventLoop = false;
            var body = JSON.parse(event.body);

            const mdQuery = { 'email': { $regex: new RegExp("^" + body.username, "i") } };

            console.log("...........before connection.....................")

            connectorMongodb.then(async () => {

                console.log("....................inside connection............................")

                userModel.findOne(mdQuery, async (err, doc) => {

                    console.log("doc", doc)

                    if (doc && bcrypt.compareSync(body.password, doc.password)) {
                        if (doc.status && doc.status == 'active') {

                            console.log("event.stageVariables", event.stageVariables.authTokenURL)
                            console.log("event.stageVariables", event.stageVariables.oauth_clientSecret)
                            console.log("event.oauth_clientId", event.stageVariables.oauth_clientId)
                            console.log("event.stageVariables", event.stageVariables.oauth_audience)

                            

                            //console.log("result.........", result)



                            axios.post(event.stageVariables['authTokenURL'], {
                                    id: doc.id,
                                    firstName: doc.firstName,
                                    lastName: doc.lastName,
                                    client_id: event.stageVariables['oauth_clientId'],
                                    client_secret: event.stageVariables['oauth_clientSecret'],
                                    audience: event.stageVariables['oauth_audience'],
                                    grant_type: "client_credentials"
                                }).then((res) => {
                                    console.log("token res ...", res)
                                    done(err, {
                                        status: 'Successfully authenticated',
                                        token: res.data.access_token,
                                        data: {
                                            id: doc.id,
                                            firstName: doc.firstName,
                                            lastName: doc.lastName,
                                            email: doc.email,
                                            changePassword: doc.changePassword
                                            //res: res.data
                                        }
                                    });
                                })
                                .catch((error) => {
                                    console.error(error);
                                    done(error, {
                                        status: 'HTTP call failed',
                                    });
                                })


                        }
                        else {
                            done('200', {
                                status: 'User Email not validated',
                            });
                        }


                    }
                    else {
                        done({ messsage: 'Auth Failed' }, {
                            status: 'Authentication failed',
                        });
                    }
                })
            }).catch(err => {
                console.log("err..catch.................................")
                console.log("err..........", err)
                done("400", {
                    status: 'Connection Error'
                });
            })
            //(err) => { console.log('Connection Error'); });
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
