var express = require('express'),
    bodyParser = require('body-parser'),
    login = require('facebook-chat-api'),
    request = require('request-promise'),
    Promise = require('bluebird'),
     fs = require('fs');

var app = express();

// Configuration
try {
    var configJSON = fs.readFileSync(__dirname + '/config.json');
    var config = JSON.parse(configJSON.toString());
} catch (e) {
    console.error('File config.json not found or is invalid: ' + e.message);
    process.exit(1);
}

var port = config.port || 3000;

//bodyParser to get POST parameters.
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

//Start server
app.listen(port, function() {
    console.log('Service listening on port ' + port);
});


function startapi(api) {
    console.log(api);
    //listen for new facebook messages
    api.listen(function(err, message) {
        if (err) return console.error(err);

        console.log(message);
        var getUserInfo = Promise.promisify(api.getUserInfo);
        // Get information (Name) about the sender
        getUserInfo(message.senderID)
            .then(function(userInfo) {
                // Request body
                var data = {
                    from: message.senderID,
                    body: message.body,
                    name: userInfo[message.senderID].name
                };
                // HTTP request (Forward message to Motion)
                return request({
                    method: 'POST',
                    uri: config.url,
                    body: data,
                    json: true
                });
            })
            .then(function(res) {
                console.log('request sent', res);
            })
            .catch(function(err) {
                console.log('err', err);
            });

    });
    //  Send message
    //http://localhost:3000/sendMessage
    app.post('/sendMessage', function(req, res) {
        var recipientId = req.body.to;
        var message = req.body.body;
        // Send message to recipient
        api.sendMessage(message, recipientId, function(err, data) {
            if (err) {
                console.log('Message failed', err);
                res.status(500).send(err);
            }
            if (data) {
                console.log('Message sent');
                res.status(200).send(data);
            }

        });

    });

}
//Login to facebook account
login({
    email: config.email,
    password: config.password
},{
    pageID : config.pageID
    
}, function(err, api) {
    if (err) return console.error(err);
    startapi(api);
});
