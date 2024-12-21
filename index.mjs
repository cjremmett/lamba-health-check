import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import axios from 'axios';
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
const webhookTable = 'discordWebhooks';

export const handler = async (event) => {

  function getUTCTimestampString()
  {
    let now = new Date();
    let timestamp_string = now.getUTCFullYear() + '-' + (now.getUTCMonth() + 1) + '-' + now.getUTCDate() + ' ' + now.getUTCHours() + ':' + now.getUTCMinutes() + ':' + now.getUTCSeconds() + '.' + now.getUTCMilliseconds();
    return timestamp_string;
  }

  const httpd = axios({
    method: 'get',
    url: 'https://cjremmett.com/',
    validateStatus: status => (true),
    timeout: 2000
  }).then(response => {
    return response;
  })
  .catch(error => {
    return { 'status': 500 };
  });

  const jellyfin = axios({
    method: 'get',
    url: 'https://cjremmett.com/jellyfin/',
    validateStatus: status => (true),
    timeout: 2000
  }).then(response => {
    return response;
  })
  .catch(error => {
    return { 'status': 500 };
  });

  const qbt = axios({
    method: 'get',
    url: 'https://cjremmett.com/qbt/',
    validateStatus: status => (true),
    timeout: 2000
  }).then(response => {
    return response;
  })
  .catch(error => {
    return { 'status': 500 };
  });

  const hass = axios({
    method: 'get',
    url: 'https://homeassistant.cjremmett.com/',
    validateStatus: status => (true),
    timeout: 2000
  }).then(response => {
    return response;
  })
  .catch(error => {
    return { 'status': 500 };
  });

  const express = axios({
    method: 'get',
    url: 'https://cjremmett.com/api/',
    validateStatus: status => (true),
    timeout: 2000
  }).then(response => {
    return response;
  })
  .catch(error => {
    return { 'status': 500 };
  });

  const flask = axios({
    method: 'get',
    url: 'https://cjremmett.com/flask',
    validateStatus: status => (true),
    timeout: 2000
  }).then(response => {
    return response;
  })
  .catch(error => {
    return { 'status': 500 };
  });

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

    if(recordChanged === true)
    {
      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            latestHealthCheckPartitionKey: 'latest',
            timestamp: resultsObject['timestamp'],
            result: resultsObject['result'],
            httpd: resultsObject['httpd'],
            jellyfin: resultsObject['jellyfin'],
            qbt: resultsObject['qbt'],
            hass: resultsObject['hass'],
            express: resultsObject['express'],
            flask: resultsObject['flask']
          },
        })
      );
      
      let webhooks = await dynamo.send(
        new GetCommand({
          TableName: webhookTable,
          Key: {
            id: 'latest'
          },
          Limit: 1
        })
      );

      let webhookUrl = webhooks.Item['health-checks'];
      let statusString = 'Timestamp: ' + getUTCTimestampString() +'\nhttpd: ' + resultsObject['httpd'] + '\njellyfin: ' + resultsObject['jellyfin'] + '\nqbt: ' + resultsObject['qbt'] + '\nhass: ' + resultsObject['hass'] + '\nexpress: ' + resultsObject['express'] + '\nflask: ' + resultsObject['flask'];
      await fetch(webhookUrl, {
        method: "POST",
        body: JSON.stringify({
          "content": statusString
        }),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      });
    }

    const resp = {
      statusCode: 200,
      body: JSON.stringify(resultsObject)
    };
    return resp;
  });
  
  
  return httpResponsePromise;
  
};