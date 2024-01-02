# WebSockets Planning Poker

This is the backend for a planning poker app I made to learn AWS API Gateway WebSockets. There is an API Gateway that supports WebSockets, plus five Lambdas used to process messages:

1. `onConnect`: Adds a record to the DynamoDB Connections table when a user connects
2. `setUserInfo`: Sets a user's name and role in the Connections table
3. `sendMessage`: Repeats a message sent by one user to all other users on the team
4. `vote`: Records a user's vote on a story in the DynamoDB Votes table
5. `onDisconnect`: When a user disconnects, removes all info related to that user's voting session from the Connections and Votes table

Each endpoint has its own folder, and the infrastructure is described in the template.yaml file.

I will absolutely not be providing support for this code under any circumstances, but you are welcome to do whatever you like with it.

# Deploying to your account

1. Set up an AWS account, create an access key and secret
2. Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
3. Install SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
4. In the root of this folder, run `aws configure`; sets up an access key and secret that will be used to access your account.
5. In the root of this folder, run `sam deploy --guided` and follow the prompts

Once the code is deployed, you can get the URL of the API either from the command-line output of the SAM CLI or by logging in to your AWS Account, going to API Gateway, and finding the API.

**Note:** `.gitignore` contains the `samconfig.toml`, hence make sure to backup this file, or modify your .gitignore locally.