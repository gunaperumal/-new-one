var mongoose = require('mongoose');
var userModel = require('./userModel.js');
var IntegrationSchema = require('./integration.js');

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event));

    const done = (err, res) => callback(null, {
        statusCode: err ? err : '200',
        body: err !=='200' ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });
    
    var connectorMongodb =  mongoose.connect(`mongodb+srv://${event.stageVariables['mongoDB']}?retryWrites=true&w=majority`, { useNewUrlParser: true });


    switch (event.httpMethod) {
        case 'GET':
            console.log('GET Profile Details Called')
            context.callbackWaitsForEmptyEventLoop = false;
            if(event.headers && event.headers.userauthdata){
        
                const userData = Buffer.from(event.headers.userauthdata, 'base64').toString('ascii');
                const email = userData.split(':').length ===2 ? userData.split(':')[0]:'';
                    if ( email && email !== '') {
                        
                        const mdQuery = { 'email': { $regex: new RegExp("^" + email, "i") } };
                        
                        console.log("email",email)
    
                        connectorMongodb.then(() => {
                            userModel.findOne(mdQuery, {'firstName':1,'lastName':1, 'email':1,/*'storeemail':1,*/'account.phone':1,'account.bio':1,'account.compname':1,'account.jobTitle':1,
                            'account.address1':1,'account.address2':1,'account.city':1,'account.state':1,'account.zip':1,'account.website':1,'account.initials':1,'account.lang':1,'account.country':1,'account.retail':1,'appPreference.timezone':1,
                            'account.translang':1,'account.applang':1,'appPreference.dateformat':1,'appPreference.numformat':1,'appPreference.timeformat':1,'appPreference.distformat':1,'appPreference.FDOW':1,'account.timefeature':1,'account.plan':1,'account.token':1})
                            .exec(function (err, doc) {
                                if(doc) {
                                    console.log("doc",doc)
                                    IntegrationSchema.findOne(mdQuery, {'email':1, 'surl.group':1,'surl.name':1}).exec(function (err, integDoc) {
                                        if(integDoc) {
                                            doc['integration'] = integDoc;
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
