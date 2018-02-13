# Facebook integration for your Motion Openchannel in Node.js

## Overview

The key to an effective customer service is focusing in the channels where your customers are. Know your customers and be accessible to them through the most important channels. It might be through Email, Chat, Facebook, Twitter or other social media platforms. It’s true that there are too many channels and you might think you need a lot of time and resource. Don’t worry! xCALLY Motion Open Channel enables you to develop your favorite channel in just few steps. You will be able to easily manage your customer interactions through any channel inside a single Omni channel Desktop interface. Let’s see how you can develop your favorite customer service channel.
xCALLY Motion provides all the necessary tools to receive and send messages. All you need to do is implement a simple web service to exchange messages between xCALLY Motion server and your favorite channel. You can use any programming language you prefer.

## Prerequisites

  * [Node.js](http://nodejs.org/)
  * [Git](http://git-scm.com/)


## Application Configuration
  * Set the open channel [Account on Motion](https://wiki.xcallymotion.com/display/XMV/New+Channels+Configuration+Steps)
  * Download the code `git clone https://github.com/xcally/openchannel-facebook.git`
  * Please see `config.json` in the root folder to change the default application settings.
  * Run `npm install` at the root folder to download dependencies.
  * Run `node index.js` to start the application.

  * Download the code under the `/var/opt/` folder `git clone https://github.com/xcally/openchannel-facebook.git`
  * Assuming that your code is now located under `/var/opt/openchannel-facebook`, navigate to that folder and run `npm install` to download all dependencies
  * Open the config and update the application settings:

| Property  | Description |
| ------------- | ------------- |
| url  | the api url where your xCally Motion server is located  |
| ipaddress  | the ip address of the server where the application is running, defaults to `localhost`  |
| sendMessagePath  | the path configured in the replyURL field in your xCally Motion openchannel account (e.g. replyUrl: http://myserver.com/sendMessage -> sendMessagePath: "/sendMessage")  |
| port  | the port where the application is running, defaults to `3001`  |
| appSecret  | the facebook application secret (see Web Configuration)  |
| messagingToken  | the facebook application token (see Web Configuration)  |
| validationToken  | the facebook application validation token (see Web Configuration)  |
| screen_name  | the name of your page, in case you enable facebook posts. Otherwise leave it to default  |
| enablePosts  | enable facebook posts/comments  |
| apiVersion  | the facebook API version for facebook API calls  |
| auth  | username and password of your xCally Motion administrator  |

  * Run `node index.js` (or `pm2 start index.js -n openchannel-facebook` if you have pm2 service installed) to start the application

## Web Configuration

Please follow our [documentation](https://wiki.xcallymotion.com/display/XMV/New+Channels+Configuration+Steps) to configure properly Facebook integration with xCALLY Motion OpenChannel.

## Troubleshooting

* Account HTTP Method or URL is not configured

Please check to have configured correctly the ["Send" web hook](https://wiki.xcallymotion.com/display/XMD/Open+Channel#OpenChannel-WebHooks)

* Error: connection refused ECONNREFUSED

Please check if the nodejs application is up!

* Cannot message users who are not admins, developers or testers of the app until pages_messaging permission is reviewed and the app is live.

The Facebook Application is not approved by Facebook and you are not able to send message using the application: you need to publish the Facebook application.


## Enjoy

Thank you for choosing XCALLY MOTION, one of the first Omni Channel solution integrated with AsteriskTM and the most innovative real time solutions available on the market.

For more information, please visit our website [www.xcallymotion.com](https://www.xcallymotion.com/)
