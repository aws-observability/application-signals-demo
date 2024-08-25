const logger = require('pino')();
const axios = require('axios');
const ip = require('ip');

const URL = process.env.EUREKA_SERVICE_URL || `http://localhost:8761/eureka`;

/**
 * Register with Eureka server.
 */

module.exports = function (app, port) {
  axios.post(`${URL}/apps/${app}/`, {
    instance: {
      hostName: `localhost`,
      instanceId: `${app}-${port}`,
      vipAddress: `${app}`,
      app: `${app.toUpperCase()}`,
      ipAddr: ip.address(),
      status: `UP`,
      port: {
          $: port,
          "@enabled": true
      },
      dataCenterInfo: {
          "@class": `com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo`,
          name: `MyOwn`
      }
    }
  })
  .then(function (res) {
    logger.info('registered with eureka');
    setInterval(() => {
      axios.put(`${URL}/apps/${app}/${app}-${port}`)
        .then(function (res) {
          logger.info('eureka hearbeat');
        })
        .catch(function (err) {
          logger.error('failed to add heartbeat', err);
        })
    }, 50 * 1000);
  })
  .catch(function (err) {
    logger.error(err)
  });
};