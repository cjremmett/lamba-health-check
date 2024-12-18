import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = "latestHealthCheck";

// TODO:
// Add support for inserting first record if it's absent from the table
// Send discord notification if the record was changed
// Set up scheduler to run the job
export const handler = async (event) => {

  function getUTCTimestampString()
  {
    let now = new Date();
    let timestamp_string = now.getUTCFullYear() + '-' + (now.getUTCMonth() + 1) + '-' + now.getUTCDate() + ' ' + now.getUTCHours() + ':' + now.getUTCMinutes() + ':' + now.getUTCSeconds() + '.' + now.getUTCMilliseconds();
    return timestamp_string;
  }

  const httpd = fetch('https://cjremmett.com/');
  const jellyfin = fetch('https://cjremmett.com/jellyfin/');
  const qbt = fetch('https://cjremmett.com/qbt/');
  const hass = fetch('https://homeassistant.cjremmett.com/');
  const express = fetch('https://cjremmett.com/api/');
  const flask = fetch('https://cjremmett.com/flask');

  
  const httpResponsePromise = await Promise.all([httpd, jellyfin, qbt, hass, express, flask]).then(async (results) => {
    let statusCodeArray = [];
    for(let i = 0; i < results.length; i++)
    {
      statusCodeArray.push(results[i].status);
    }

    let resultsObject = {
      timestamp: getUTCTimestampString(),
      httpd: results[0].status,
      jellyfin: results[1].status,
      qbt: results[2].status,
      hass: results[3].status,
      express: results[4].status,
      flask: results[5].status
    };
    
    if(Math.max(...statusCodeArray) === 200)
    {
      resultsObject.result = 'ok';
    }
    else
    {
      resultsObject.result = 'failed';
    }

    let record = await dynamo.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          latestHealthCheckPartitionKey: 'latest'
        },
        Limit: 1
      })
    );

    let latestRecord = record.Item;
    let recordChanged = false;
    if(resultsObject['httpd'] != latestRecord['httpd'] || resultsObject['jellyfin'] != latestRecord['jellyfin'] || resultsObject['qbt'] != latestRecord['qbt'] || resultsObject['hass'] != latestRecord['hass'] || resultsObject['express'] != latestRecord['express'] || resultsObject['flask'] != latestRecord['flask'])
    {
      recordChanged = true;
    }
    console.log(recordChanged);

    await dynamo.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          latestHealthCheckPartitionKey: 'latest',
          timestamp: resultsObject['timestamp'],
          httpd: resultsObject['httpd'],
          jellyfin: resultsObject['jellyfin'],
          qbt: resultsObject['qbt'],
          hass: resultsObject['hass'],
          express: resultsObject['express'],
          flask: resultsObject['flask']
        },
      })
    );

    const resp = {
      statusCode: 200,
      body: JSON.stringify(resultsObject)
    };
    return resp;
  });

  return httpResponsePromise;
};



// export const handler = async (event, context) => {
//   let body;
//   let statusCode = 200;
//   const headers = {
//     "Content-Type": "application/json",
//   };

//   try {
//     switch (event.routeKey) {
//       case "DELETE /items/{id}":
//         await dynamo.send(
//           new DeleteCommand({
//             TableName: tableName,
//             Key: {
//               id: event.pathParameters.id,
//             },
//           })
//         );
//         body = `Deleted item ${event.pathParameters.id}`;
//         break;
//       case "GET /items/{id}":
//         body = await dynamo.send(
//           new GetCommand({
//             TableName: tableName,
//             Key: {
//               id: event.pathParameters.id,
//             },
//           })
//         );
//         body = body.Item;
//         break;
//       case "GET /items":
//         body = await dynamo.send(
//           new ScanCommand({ TableName: tableName })
//         );
//         body = body.Items;
//         break;
//       case "PUT /items":
//         let requestJSON = JSON.parse(event.body);
//         await dynamo.send(
//           new PutCommand({
//             TableName: tableName,
//             Item: {
//               id: requestJSON.id,
//               price: requestJSON.price,
//               name: requestJSON.name,
//             },
//           })
//         );
//         body = `Put item ${requestJSON.id}`;
//         break;
//       default:
//         throw new Error(`Unsupported route: "${event.routeKey}"`);
//     }
//   } catch (err) {
//     statusCode = 400;
//     body = err.message;
//   } finally {
//     body = JSON.stringify(body);
//   }

//   return {
//     statusCode,
//     body,
//     headers,
//   };
// };