//on setuserinfo, update the metadata associated with a connection id

const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { CONNECTIONS_TABLE_NAME } = process.env;

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const parsedMessage = JSON.parse(event.body);
  const parsedData = JSON.parse(parsedMessage.data);
  const {
    name,
    isAdmin,
    sessionId = "default",
  } = parsedData;

  var params = {
    TableName: CONNECTIONS_TABLE_NAME,
    Key: {
      connectionId: connectionId,
    },
    ExpressionAttributeValues: {
      ":name": name,
      ":isAdmin": isAdmin,
      ":sessionId": sessionId,
    },
    UpdateExpression:
      "set #nm = :name, isAdmin = :isAdmin, sessionId = :sessionId",
    ExpressionAttributeNames: {
      "#nm": "name",
    },
  };

  // Tell DynamoDB to update the item in the table
  await ddb.update(params).promise();

  //get info for current connections
  let connectionData;

  try {
    connectionData = await ddb
      .scan({
        TableName: CONNECTIONS_TABLE_NAME,
        ProjectionExpression: "connectionId, #nm, isAdmin, sessionId",
        ExpressionAttributeNames: {
          "#nm": "name",
        },
      })
      .promise();
  } catch (e) {
    console.log(e);
    return { statusCode: 500, body: e.stack };
  }

  const connectionItems = connectionData.Items.filter(
    (i) => i.sessionId === sessionId
  );

  //build api gateway socket
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  //create requests to send an updated user list to everybody currently connected
  const postCalls = connectionItems.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi
        .postToConnection({
          ConnectionId: connectionId,
          Data: JSON.stringify(connectionItems),
        })
        .promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb
          .delete({ TableName: CONNECTIONS_TABLE_NAME, Key: { connectionId } })
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
    console.log(e);
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "User data updated." };
};
