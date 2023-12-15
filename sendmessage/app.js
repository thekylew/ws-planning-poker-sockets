//on message, repeat message to all other users in the session associated with the connection id

const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { TABLE_NAME } = process.env;

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  //get currently connected ids
  let connectionData;  

  try {
    connectionData = await ddb
      .scan({ TableName: TABLE_NAME, ProjectionExpression: "connectionId, sessionId" })
      .promise();
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  const currentConnection = connectionData.Items.find(c => c.connectionId === connectionId);

  if (!currentConnection) {
    console.log(`couldn't find a connection for id ${connectionId}`);
    return false;
  }  

  const sessionId = currentConnection.sessionId;

  //build api gateway socket
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  let postData = JSON.parse(JSON.parse(event.body).data);
  postData.connectionId = connectionId;

  //create a request to repeat the message for each connected id
  const postCalls = connectionData.Items.filter(c => c.sessionId === sessionId).map(async ({ connectionId }) => {
    try {
      await apigwManagementApi
        .postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(postData) })
        .promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb
          .delete({ TableName: TABLE_NAME, Key: { connectionId } })
          .promise();
      } else {
        throw e;
      }
    }
  });

  try {
    //send all requests in parallel
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
};
