# WebSockets Planning Poker

This is the backend for a planning poker app I made to learn AWS API Gateway WebSockets. There is an API Gateway that supports WebSockets, plus four Lambdas used to process messages - onConnect (keeps track of connections), onDisconnect (keeps track of disconnects), sendMessage (repeats a message sent by one user to all users), and setUserInfo (allows a user's info to be persisted).

I will absolutely not be providing support for this code under any circumstances. 

# Deploying to your account

sam deploy --guided

aws cloudformation describe-stacks \
    --stack-name ws-planning-poker-backend --query 'Stacks[].Outputs'

**Note:** `.gitignore` contains the `samconfig.toml`, hence make sure backup this file, or modify your .gitignore locally.

## Testing the API

To test the WebSocket API, you can use [wscat](https://github.com/websockets/wscat), an open-source command line tool.

1. [Install NPM](https://www.npmjs.com/get-npm).
2. Install wscat:
``` bash
$ npm install -g wscat
```
3. On the console, connect to your published API endpoint by executing the following command:
``` bash
$ wscat -c wss://{YOUR-API-ID}.execute-api.{YOUR-REGION}.amazonaws.com/{STAGE}
```
4. To test the sendMessage function, send a JSON message like the following example. The Lambda function sends it back using the callback URL: 
``` bash
$ wscat -c wss://bg3gu742ka.execute-api.us-east-1.amazonaws.com/prod
connected (press CTRL+C to quit)
> {"action":"sendmessage", "data":"hello world"}
< hello world
```

## License Summary
All code copyright 2022 Kyle Wade. All rights reserved.