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
  
    const response = await Promise.all([httpd, jellyfin, qbt, hass, express, flask]).then((results) => {
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
  
        const resp = {
          statusCode: 200,
          body: JSON.stringify(resultsObject)
        };
        return resp;
    });
  
    return response;
  };
  