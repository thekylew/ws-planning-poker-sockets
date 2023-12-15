//on vote, save the vote, then send out updated vote data to all connections

const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { VOTES_TABLE_NAME, CONNECTIONS_TABLE_NAME } = process.env;

exports.handler = async (event) => {
  //get stuff we need from event and context
  const connectionId = event.requestContext.connectionId;

  const parsedMessage = JSON.parse(event.body);
  const parsedData = JSON.parse(parsedMessage.data);

  const { sessionId = "default", storyName, choice } = parsedData;
  const timestamp = new Date().toISOString();

  const voteId = `${sessionId}-${storyName}-${connectionId}`;

  console.log(`inserting vote id ${voteId}: ${choice} at ${timestamp}`);

  //build dynamodb put request
  const putParams = {
    TableName: VOTES_TABLE_NAME,
    Item: {
      voteId,
      connectionId,
      sessionId,
      storyName,
      choice,
      timestamp,
    },
  };

  try {
    //add the vote to dynamodb
    await ddb.put(putParams).promise();
  } catch (err) {
    console.log(err);

    return {
      statusCode: 500,
      body: "Failed to connect: " + JSON.stringify(err),
    };
  }

  console.log("getting vote data to return");

  //get info for current connections
  let voteData;

  try {
    const queryParams = {
      TableName: VOTES_TABLE_NAME,
    };

    voteData = await ddb.scan(queryParams).promise();

    const currentVotes = voteData.Items.filter(
      (i) => i.storyName === storyName && i.sessionId === sessionId
    ).reduce((prev, curr) => {
      prev[curr.connectionId] = curr.choice;
      return prev;
    }, {});

    console.log("getting connection info to send out vote data");

    //get info for current connections
    let connectionData;

    connectionData = await ddb
      .scan({
        TableName: CONNECTIONS_TABLE_NAME,
        ProjectionExpression: "connectionId, sessionId",
      })
      .promise();

    //build api gateway socket
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
      apiVersion: "2018-11-29",
      endpoint:
        event.requestContext.domainName + "/" + event.requestContext.stage,
    });

    //create requests to send an updated vote list to everybody currently connected
    const postCalls = connectionData.Items.filter(
      (i) => i.sessionId === sessionId
    ).map(async ({ connectionId }) => {
      try {
        await apigwManagementApi
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              command: "votesupdated",
              votes: currentVotes,
            }),
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

    console.log(
      `sending vote data to ${connectionData.Items.length} current users in session ${sessionId}`
    );

    try {
      //send all requests in parallel
      await Promise.all(postCalls);
    } catch (e) {
      console.log(e);
      return { statusCode: 500, body: e.stack };
    }
  } catch (e) {
    console.log(e);
    return { statusCode: 500, body: e.stack };
  }

  //return tabulated votes for session

  return { statusCode: 200, body: "Vote received." };
};
