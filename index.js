/* jshint node: true, devel: true */
'use strict';

var express = require('express'),
  bodyParser = require('body-parser'),
  request = require('request-promise'),
  fs = require('fs'),
  util = require('util'),
  crypto = require('crypto'),
  morgan = require('morgan'),
  logger = require('./logger.js')('openchannel-facebook'),
  moment = require('moment');


var app = express();

app.use(bodyParser.json({
  verify: verifyRequestSignature
}));

morgan.token('remote-address', function(req, res) {
  return req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] : req.connection.remoteAddress || req.ip;
});
morgan.token('datetime', function(req, res) {
  return moment().format('YYYY-MM-DD HH:mm:ss');
});

app.use(morgan('VERBOSE [:datetime] [REQUEST] [OPENCHANNEL-FACEBOOK] - :method :remote-address :remote-user :url :status :response-time ms - :res[content-length]'));

try {
  var configJSON = fs.readFileSync(__dirname + '/config.json');
  var config = JSON.parse(configJSON.toString());
} catch (e) {
  logger.error('File config.json not found or is invalid: ' + e.message);
  process.exit(1);
}

app.set('port', config.port || 3001);
app.set('ipaddress', config.ipaddress || 'localhost');

// App Secret can be retrieved from the App Dashboard
var APP_SECRET = config.appSecret;
// Arbitrary value used to validate a webhook
var VALIDATION_TOKEN = config.validationToken;
// Generate a page access token for your page from the App Dashboard
var PAGE_ACCESS_TOKEN = config.pageAccessToken;
// URL can be retrieve from the Motion OpenChannel Account
var MOTION_URL = config.url;
// Path chosen to send messages from Motion OpenChannel Inbox to Facebook
var SEND_MESSAGE_PATH = config.sendMessagePath;

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && MOTION_URL && SEND_MESSAGE_PATH)) {
  logger.error("Missing config values");
  process.exit(1);
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (signature) {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
      .update(buf)
      .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    logger.info("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    logger.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function(req, res) {
  var data = req.body;
  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      if (pageEntry.messaging) {
        pageEntry.messaging.forEach(function(messagingEvent) {
          if (messagingEvent.message) {
            receivedMessage(messagingEvent);
          } else {
            logger.info("Webhook received unknown messagingEvent: ", messagingEvent);
          }
        });
      } else if (pageEntry.changes) {
        pageEntry.changes.forEach(function(changingEvent) {
          logger.info('changingEvent', changingEvent);
        });
      }
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  logger.info("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
  logger.info(JSON.stringify(message));

  var options = {
    method: 'GET',
    uri: 'https://graph.facebook.com/v2.10/' + senderID,
    qs: {
      fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
      access_token: PAGE_ACCESS_TOKEN
    },
    json: true
  };

  return request(options)
    .then(function(parsedBody) {
      options = {
        method: 'POST',
        uri: MOTION_URL,
        body: {
          from: senderID,
          body: message.text || '',
          to: recipientID,
          name: util.format('%s %s', parsedBody.first_name, parsedBody.last_name),// V1
          firstName: parsedBody.first_name,// V2
          lastName: parsedBody.last_name,// V2
          mapKey: 'facebook',// V2
          phone: 'none'// V2
        },
        json: true
      };

      return request(options);

    })
    .then(function(result) {
      logger.info('Message sent to xCALLY Motion server');
    })
    .catch(function(err) {
      logger.error('Error forwarding message to xCALLY Motion server', err);
    });

}

app.post(SEND_MESSAGE_PATH, function(req, res) {
  var to = req.body.Contact ? req.body.Contact.facebook : req.body.to;
  logger.info("Sending message to %s with message: %s", to, req.body.body);

  return request({
      uri: 'https://graph.facebook.com/v2.10/me/messages',
      qs: {
        access_token: PAGE_ACCESS_TOKEN
      },
      method: 'POST',
      body: {
        recipient: {
          id: to
        },
        message: {
          text: req.body.body,
          metadata: "DEVELOPER_DEFINED_METADATA"
        }
      },
      json: true
    })
    .then(function(result) {
      logger.info('Message correctly sent to Facebook with id %s to %s:', result.message_id, result.recipient_id);
      return res.status(200).send(result);
    })
    .catch(function(err) {
      logger.error('Error sending message to %s:', req.body.to);
      logger.error(err);
      return res.status(400).send(err);
    });
});

// Start server
app.listen(app.get('port'), app.get('ipaddress'), function() {
  logger.info(util.format('openchannel-facebook app is running on port %d on %s', app.get('port'), app.get('ipaddress')));
});
