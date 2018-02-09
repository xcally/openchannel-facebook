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
  moment = require('moment'),
  url = require('url'),
  nodeRequest = require('request'),
  path = require('path'),
  BPromise = require('bluebird');




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

var fbPostEvents = ['post', 'comment'];
var fbPagePostEvents = ['share', 'status'];

var allEvents = fbPostEvents.concat(fbPagePostEvents);

// App Secret can be retrieved from the App Dashboard
var APP_SECRET = config.appSecret;
// Arbitrary value used to validate a webhook
var VALIDATION_TOKEN = config.validationToken;
// Generate a page access token for your page from the App Dashboard
var MESSAGING_TOKEN = config.messagingToken;
// URL can be retrieve from the Motion OpenChannel Account
var MOTION_URL = config.url;
// Path chosen to send messages from Motion OpenChannel Inbox to Facebook
var SEND_MESSAGE_PATH = config.sendMessagePath;

if (MOTION_URL) {
  var myUrl = url.parse(MOTION_URL);
  var DOMAIN = myUrl.protocol + '//' + myUrl.host;
}
var USERNAME = config.auth.username;
var PASSWORD = config.auth.password;

var SCREEN_NAME = config.screen_name;

var API_VERSION = config.apiVersion || '2.10';

if (!(APP_SECRET && VALIDATION_TOKEN && MESSAGING_TOKEN && MOTION_URL && SEND_MESSAGE_PATH && DOMAIN && USERNAME && PASSWORD && SCREEN_NAME)) {
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
          if(config.enablePosts && changingEvent.field === 'feed' && changingEvent.value && changingEvent.value.verb === 'add' && allEvents.indexOf(changingEvent.value.item) >= 0 && (changingEvent.value.from && (changingEvent.value.from.name !== SCREEN_NAME ||  fbPagePostEvents.indexOf(changingEvent.value.item) >= 0))){
              receivedPostOrComment(changingEvent.value); //supported only in V2, enable it through config.json
          }
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

function receivedPostOrComment(event){
     var urlParams = event.post_id.split('_');
     var params = {
         senderID : event.from.id,
         threadId : event.post_id,
         externalUrl : util.format('https://www.facebook.com/%s/posts/%s',urlParams[0], urlParams[1]),
         message : event.message || '',
         senderName : event.from.name
     };

         logger.info(util.format("Received %s for user %s with message: %s", event.item, params.senderID, params.message));

         var attachments = [];
         if(event.photo){//multiple??
             attachments.push({payload:{url:event.photo}});
         }
         if(event.video){//multiple??
             attachments.push({payload:{url:event.video}});
         }
         //sticker?? link??

         if (attachments.length) {
           sendAttachment(attachments, 0, params.senderID, params.message, null, params.threadId, params.externalUrl, params.senderName);
         } else {
           return sendMessageToMotion(params.senderID, params.message, null, null, null, null, params.threadId, params.externalUrl, params.senderName);
         }
}

function sendMessageToMotion(senderID, messageContent, recipientID, attachmentId, tempName, originalFilename, threadId, externalUrl, facebookCommentName) {

    var msgOptions = {
      method: 'POST',
      uri: MOTION_URL,
      body: {
        from: senderID,
        body: messageContent || originalFilename,
        to: recipientID,// V1
        AttachmentId: attachmentId || null,
        mapKey: 'facebook', // V2
        phone: 'none', // V2
        threadId: threadId, // V2
        externalUrl: externalUrl // V2
      },
      json: true
    };

    return BPromise.resolve()
    .then(function(){
        if(facebookCommentName){
            msgOptions.body.description =  'Created from facebook post/comment';
            msgOptions.body.name =  facebookCommentName; // V1
            if(facebookCommentName.indexOf(' ') >= 0){
                var parsedName = facebookCommentName.split(/\s(.+)/);
                msgOptions.body.firstName =  parsedName[0]; // V2
                msgOptions.body.lastName =  parsedName[1]; // V2
            }
            else {
                msgOptions.body.firstName = facebookCommentName; // V2
            }
            return null;
        }

        msgOptions.body.description =  'Created from facebook message';

        var options = {
          method: 'GET',
          uri: util.format('https://graph.facebook.com/v%s/%s', API_VERSION, senderID),
          qs: {
            fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
            access_token: MESSAGING_TOKEN
          },
          json: true
        };

        return request(options);
    })
    .then(function(parsedBody) {
        if(parsedBody){
            msgOptions.body.name =  util.format('%s %s', parsedBody.first_name, parsedBody.last_name); // V1
            msgOptions.body.firstName =  parsedBody.first_name; // V2
            msgOptions.body.lastName =  parsedBody.last_name; // V2
        }
        return request(msgOptions);
    })
    .then(function(result) {
      if (tempName) {
        deleteTempFile(__dirname + '/' + tempName);
      }
      logger.info('Message sent to xCALLY Motion server');
    })
    .catch(function(err) {
      logger.error('Error forwarding message to xCALLY Motion server', err);
    });
}

function deleteTempFile(path) {
  fs.unlink(path, function(err) {
    if (err) {
      logger.error('Unable to delete temp file', err);
    } else {
      logger.debug('Temp file correctly deleted!');
    }
  });
}

function sendAttachment(attachments, i, senderID, messageContent, recipientID, threadId, externalUrl, facebookCommentName){
  var myUrl = url.parse(attachments[i].payload.url);
  var tempName = moment().unix() + path.extname(myUrl.pathname);
  var originalFilename = path.basename(myUrl.pathname);
  var w = fs.createWriteStream(__dirname + '/' + tempName);
  nodeRequest({
      uri: attachments[i].payload.url,
      method: 'GET'
    })
    .pipe(w)
    .on('error', function(err) {
      var errorMessage = 'Error getting attachment file from facebook!';
      logger.error(errorMessage);
      logger.error(err);
      return sendMessageToMotion(senderID, errorMessage, recipientID, null, null, null, threadId, externalUrl, facebookCommentName);
    });
  w.on('finish', function() {
    var uploadOptions = {
      method: 'POST',
      uri: DOMAIN + '/api/attachments',
      auth: {
        user: USERNAME,
        pass: PASSWORD
      },
      formData: {
        file: {
          value: fs.createReadStream(__dirname + '/' + tempName),
          options: {
            filename: originalFilename
          }
        }
      },
      json: true
    };

    return request(uploadOptions)
      .then(function(attachment) {
        if (!attachment) {
          throw new Error('Unable to get uploaded attachment id!');
        }
        return sendMessageToMotion(senderID, messageContent, recipientID, attachment.id, tempName, originalFilename, threadId, externalUrl, facebookCommentName);
      })
      .then(function() {
        i++;
        if(attachments[i]){
          sendAttachment(attachments, i, senderID, messageContent, recipientID, threadId, externalUrl, facebookCommentName);
        }
      })
      .catch(function(err) {
        var errorMessage = 'Error uploading attachment to xCALLY Motion server';
        logger.error(errorMessage, err);
        deleteTempFile(__dirname + '/' + tempName);
        return sendMessageToMotion(senderID, errorMessage, recipientID, null, null, null, threadId, externalUrl, facebookCommentName);
      });
    });
}

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

  logger.info(util.format("Received message for user %d and page %d with message: %d", senderID, recipientID, message));

  var messageContent = message.text || '';

  if (message.attachments) {
    sendAttachment(message.attachments, 0, senderID, messageContent, recipientID);
  } else {
    return sendMessageToMotion(senderID, messageContent, recipientID);
  }
}

function sendRequestToFacebook(params, res, to, filename) {
  logger.info('Request is', params);
  return request(params)
    .then(function(result) {
      logger.info('Request correctly sent to Facebook toward', to);
      if (filename) {
        deleteTempFile(__dirname + '/' + filename);
      }
      return res.status(200).send(result);
    })
    .catch(function(err) {
      logger.error('Error sending request to %s:', to);
      logger.error(err);
      return res.status(400).send(err);
    });
}

app.post(SEND_MESSAGE_PATH, function(req, res) {
  if(req.body.Interaction && req.body.Interaction.threadId){
      logger.info('Sending a comment to facebook post', req.body.Interaction.threadId);
      if(req.body.AttachmentId){
          logger.info('Attachment on comments are not yet supported!');
          return res.status(500).send({
            message: 'Unable to send attachment (not yet supported)!'
          });
      }

      var options = {
        method: 'GET',
        uri: util.format('https://graph.facebook.com/v%s/me', API_VERSION),
        qs: {
          access_token: MESSAGING_TOKEN,
          fields: 'access_token'
        },
        json: true
      };

      return request(options)
      .then(function(page){

             if(!page){
              throw new Error('Facebook page not found!');
             }

             var params = {
                uri: util.format('https://graph.facebook.com/v%s/%s/comments', API_VERSION, req.body.Interaction.threadId),
                qs: {
                  access_token: page.access_token,
                  message: req.body.body
                },
                method: 'POST',
                json: true
              };
              return sendRequestToFacebook(params, res, util.format('post with id %s', req.body.Interaction.threadId));
     })
     .catch(function(err) {
       logger.error('Error on page token request/ facebook post:', err);
     });
  }
  else{
    var to = req.body.Contact ? req.body.Contact.facebook : req.body.to;
    logger.info("Sending message to %s with message: %s", to, JSON.stringify(req.body));
    var msg = {
        uri: util.format('https://graph.facebook.com/v%s/me/messages', API_VERSION),
        qs: {
          access_token: MESSAGING_TOKEN
        },
        method: 'POST',
        json: true
      };
      if (req.body.AttachmentId) {
        if (!req.body.body) {
          logger.error('Unable to get attachment filename!');
          return res.status(500).send({
            message: 'Unable to get attachment filename!'
          });
        }

        var fileExtension = path.extname(req.body.body);
        var filename = moment().unix() + fileExtension;
        var w = fs.createWriteStream(__dirname + '/' + filename);

        nodeRequest({
            uri: DOMAIN + '/api/attachments/' + req.body.AttachmentId + '/download',
            method: 'GET',
            auth: {
              user: USERNAME,
              pass: PASSWORD
            }
          })
          .on('error', function(err) {
            logger.error('Error getting attachment file while sending message to %s:', to);
            logger.error(err);
            return res.status(500).send(err);
          })
          .pipe(w);

        w.on('finish', function() {
          try {
            msg.formData = {
              messaging_type: 'RESPONSE',
              recipient: JSON.stringify({
                id: to
              }),
              message: JSON.stringify({
                attachment: {
                  type: 'file',
                  payload: {}
                }
              }),
              filedata: fs.createReadStream(__dirname + '/' + filename)
            };
          } catch (err) {
            logger.error('Error creating attachment file while sending message to %s:', to);
            logger.error(err);
            return res.status(500).send(err);
          }
          return sendRequestToFacebook(msg, res, to, filename);
        });
      } else {
        msg.body = {
          messaging_type: 'RESPONSE',
          recipient: {
            id: to
          },
          message: {
            text: req.body.body,
            metadata: "DEVELOPER_DEFINED_METADATA"
          }
        };
        return sendRequestToFacebook(msg, res, to);
      }
  }
});

// Start server
app.listen(app.get('port'), app.get('ipaddress'), function() {
  logger.info(util.format('openchannel-facebook app is running on port %d on %s', app.get('port'), app.get('ipaddress')));
});
