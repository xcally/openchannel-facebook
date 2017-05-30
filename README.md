# Facebook integration for your Motion Openchannel in Node.js

## Overview

The key to an effective customer service is focusing in the channels where your customers are. Know your customers and be accessible to them through the most important channels. It might be through Email, Chat, Facebook, Twitter or other social media platforms. It’s true that there are too many channels and you might think you need a lot of time and resource. Don’t worry! xCALLY Motion Open Channel enables you to develop your favorite channel in just few steps. You will be able to easily manage your customer interactions through any channel inside a single Omni channel Desktop interface. Let’s see how you can develop your favorite customer service channel.
xCALLY Motion provides all the necessary tools to receive and send messages. All you need to do is implement a simple web service to exchange messages between xCALLY Motion server and your favorite channel. You can use any programming language you prefer.

## Prerequisites

  * [Node.js](http://nodejs.org/)
  * [Git](http://git-scm.com/)


## Setting up the app
  * Set the open channel [Account on Motion](https://wiki.xcallymotion.com/display/XMD/Open+Channel)
  * Download the code `git clone https://github.com/xcally/openchannel-facebook.git`
  * Please see `config.json` in the root folder to change the default application settings.
  * Run `npm install` at the root folder to download dependencies.
  * Run `node index.js` to start the application.

## Configuration

Please follow our [documentation](https://wiki.xcallymotion.com/display/XMD/Develop+your+favorite+customer+service+channel) to configure properly Facebook integration with xCALLY Motion OpenChannel.

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
