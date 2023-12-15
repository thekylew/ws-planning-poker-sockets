//on disconnect, delete records associated with the disconnected connection id
const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { VOTES_TABLE_NAME, CONNECTIONS_TABLE_NAME } = process.env;

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const sessionId = await getSessionId(connectionId);

  console.log(
    `Processing disconnect for user ${connectionId} from session ${sessionId}`
  );

  await deleteConnections(connectionId);

  await deleteVotes(connectionId);

  await sendUpdatedUserList(sessionId, event);

  return { statusCode: 200, body: "Disconnected." };
};

const getSessionId = async (connectionId) => {
  const params = {
    Key: {
     "connectionId": connectionId
    }, 
    TableName: CONNECTIONS_TABLE_NAME
   };

  try {
    const response = await ddb.get(params).promise();

    if (response.Item) return response.Item.sessionId;
  } catch (err) {
    console.log(`Error looking up session id: ${err}`);
  }

  return "";
};

const deleteConnections = async (connectionId) => {
  console.log(`deleting ${connectionId} from ${CONNECTIONS_TABLE_NAME}`);

  const deleteParams = {
    TableName: CONNECTIONS_TABLE_NAME,
    Key: {
      connectionId,
    },
  };

  try {
    await ddb.delete(deleteParams).promise();
  } catch (err) {
    return {
      statusCode: 500,
      body: "Failed to disconnect: " + JSON.stringify(err),
    };
  }
};

const sendUpdatedUserList = async (sessionId, event) => {
  console.log('Sending updated user list');

  //get info for current connections
  let connectionData;

  //build api gateway socket
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

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

  console.log(`Sending to ${connectionItems.length} users`);

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
    console.log(e);
    return { statusCode: 500, body: e.stack };
  }
};

const deleteVotes = async (connectionId) => {
  console.log(`deleting ${connectionId} from ${VOTES_TABLE_NAME}`);

  const voteScanParams = {
    TableName: VOTES_TABLE_NAME,
  };

  voteData = await ddb.scan(voteScanParams).promise();

  const votesToDelete = voteData.Items.filter(
    (v) => v.connectionId === connectionId
  );

  console.log(`deleting ${votesToDelete.length} votes`);

  try {
    for (let { voteId, sessionId } of votesToDelete) {
      console.log(`deleting vote id ${voteId}`);

      const voteDeleteParams = {
        TableName: VOTES_TABLE_NAME,
        Key: {
          voteId,
          sessionId,
        },
      };

      await ddb.delete(voteDeleteParams).promise();
    }
  } catch (err) {
    console.log(`error while deleting votes: ${err}`);

    return {
      statusCode: 500,
      body: "Failed to disconnect: " + JSON.stringify(err),
    };
  }
};
