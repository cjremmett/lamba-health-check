import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import axios from "axios";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = "latestHealthCheck";
const webhookTable = 'discordWebhooks';

const SERVICE_URLS = {
  jellyfin: 'https://jellyfin.cjremmett.com/',
  qbt: 'https://qbt.cjremmett.com/',
  hass: 'https://homeassistant.cjremmett.com/',
};

function getUTCTimestampString() {
  return new Date().toISOString();
}

async function checkService(url) {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    return response.status;
  } catch (error) {
    return error.response?.status || 500;
  }
}

export const handler = async (event) => {
  const servicePromises = Object.entries(SERVICE_URLS).map(([key, url]) =>
    checkService(url).then(status => ({ key, status }))
  );

  const serviceResults = await Promise.allSettled(servicePromises);
  const resultsObject = {
    timestamp: getUTCTimestampString(),
    result: 'ok',
  };

  serviceResults.forEach(result => {
    if (result.status === 'fulfilled') {
      resultsObject[result.value.key] = result.value.status;
      if (result.value.status !== 200) {
        resultsObject.result = 'failed';
      }
    } else {
      resultsObject[result.reason.key] = 500;
      resultsObject.result = 'failed';
    }
  });

  const record = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: { latestHealthCheckPartitionKey: 'latest' },
    })
  );

  const latestRecord = record.Item || {};
  const recordChanged = Object.keys(SERVICE_URLS).some(
    key => resultsObject[key] !== latestRecord[key]
  );

  if (recordChanged) {
    await dynamo.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          latestHealthCheckPartitionKey: 'latest',
          ...resultsObject,
        },
      })
    );

    const webhooks = await dynamo.send(
      new GetCommand({
        TableName: webhookTable,
        Key: { id: 'latest' },
      })
    );

    const webhookUrl = webhooks.Item?.['health-checks'];
    if (webhookUrl) {
      const statusString = Object.entries(resultsObject)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      await axios.post(webhookUrl, { content: statusString }, {
        headers: { "Content-type": "application/json; charset=UTF-8" },
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(resultsObject),
  };
};