const axios = require('axios');
const cron = require('node-cron');

const baseUrl = process.env.URL || 'http://your-sample-app-end-point';
const highLoadMaxRequests = parseInt(process.env.HIGH_LOAD_MAX, 10) || 1600;
const highLoadMinRequests = parseInt(process.env.HIGH_LOAD_MIN, 10) || 800;
const burstMaxDelay = parseInt(process.env.BURST_DELAY_MAX, 10) || 120;
const burstMinDelay = parseInt(process.env.BURST_DELAY_MIN, 10) || 60;
const lowLoadMaxRequests = parseInt(process.env.LOW_LOAD_MAX, 10) || 60;
const lowLoadMinRequests = parseInt(process.env.LOW_LOAD_MIN, 10) || 20;

function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


const postVisitData = (date, description) => {
    const url = `${baseUrl}/api/visit/owners/7/pets/9/visits`;
    const data = {
        date: date,
        description: description
    };

    return axios.post(url, data, { timeout: 10000 });
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const lowTrafficTask = cron.schedule('* * * * *', () => {
    const lowLoad = getRandomNumber(lowLoadMinRequests, lowLoadMaxRequests);
    for (let i = 0; i < lowLoad; i++) {
        console.log('send low load traffic: ' + (i + 1))
        sleep(2 * 1000)
        postVisitData('2023-08-01', `low-traffic-visit-${i + 1}`)
            .catch(err => {
                console.error("Failed to post /api/visit/owners/7/pets/9/visits, error: " + err.response && err.response.data);
            }); // Catch and log errors
        axios.get(`${baseUrl}/api/gateway/owners/1`, { timeout: 10000 })
            .catch(err => {
                console.error("Failed to get /api/gateway/owners/1, error: " + err.response && err.response.data);
            }); // Catch and log errors
    }
}, { scheduled: false });

lowTrafficTask.start();

const generateHighLoad = async () => {
    const highLoad = getRandomNumber(highLoadMinRequests, highLoadMaxRequests);
    for (let i = 0; i < highLoad; i++) {
        console.log('send high traffic: ' + (i + 1))
        postVisitData('2023-08-08', `high-traffic-visit-${i + 1}`)
            .catch(err => {
                console.error("Failed to post /api/visit/owners/7/pets/9/visits, error: " + err.response && err.response.data);
            }); // Catch and log errors
    }
    scheduleHighLoad();  // Schedule the next high load
}

const scheduleHighLoad = () => {
    const delay = getRandomNumber(burstMinDelay, burstMaxDelay) * 60 * 1000;
    setTimeout(generateHighLoad, delay);
}

// Start with a high load
scheduleHighLoad();


const invalidRequestTask = cron.schedule('* * * * *', () => {
    const lowLoad = getRandomNumber(2, 5);
    for (let i = 0; i < lowLoad; i++) {
        sleep(2*1000);
        console.log('send invalid traffic: ' + (i + 1))
        axios.get(`${baseUrl}/api/gateway/owners/-1`, { timeout: 10000 })
            .catch(err => {
                console.error("Failed to get /api/gateway/owners/-1, error: " + err.response && err.response.data);
            }); // Catch and log errors
    }
}, { scheduled: false });

invalidRequestTask.start();



const createOwnerLowTrafficTask = cron.schedule('* * * * *', () => {
    const lowLoad = 2;
    for (let i = 0; i < lowLoad; i++) {
        console.log('create owner low traffic: ' + (i + 1))
        sleep(2 * 1000)
        const data = { firstName: "random-traffic", address: "A", city: "B", telephone: "123489067542", lastName: "NA" }
        axios.post(`${baseUrl}/api/customer/owners`, data, { timeout: 10000 })
            .catch(err => {
                console.error("Failed to post /api/customer/owners, error: " + err.response && err.response.data);
            }); // Catch and log errors
    }
}, { scheduled: false });

createOwnerLowTrafficTask.start();



const createOwnerHighTrafficTask = cron.schedule('*/5 * * * *', () => {
    const highLoad = getRandomNumber(50, 80);
    sleep(getRandomNumber(1,2)*60*1000);
    for (let i = 0; i < highLoad; i++) {
        console.log('create owner high traffic: ' + (i + 1))
        sleep(3 * 1000)
        const data = { firstName: "random-traffic", address: "A", city: "B", telephone: "123489067542", lastName: "NA" }
        axios.post(`${baseUrl}/api/customer/owners`, data, { timeout: 10000 })
            .catch(err => {
                console.error("Failed to post /api/customer/owners, error: " + err.response && err.response.data);
            }); // Catch and log errors
    }
}, { scheduled: false });

createOwnerHighTrafficTask.start();

const postPetsLowTrafficTask = cron.schedule('*/2 * * * *', () => {
    console.log('add 1 pet every 2 minutes');
    const name = "lastName" + new Date().toLocaleTimeString();
    const data = {"id":0,"name":name ,"birthDate":"2023-11-20T08:00:00.000Z","typeId":"1"}
    axios.post(`${baseUrl}/api/customer/owners/7/pets`, data, { timeout: 10000 })
        .catch(err => {
            console.error("Failed to post /api/customer/owners/7/pets, error: " + err.response && err.response.data);
        }); // Catch and log errors
}, { scheduled: false });

postPetsLowTrafficTask.start();

const postPetsHighTrafficTask = cron.schedule('0 * * * *', async () => {
sleepMins = getRandomNumber(1,10);
console.log(`sleep ${sleepMins} minutes`);
await sleep(sleepMins*60*1000);
console.log('add 2 pets within 1 minute');
for (let i = 0; i < 2; i++) {
    console.log('add 2 pets within 1 minute');
    const name = "lastName" + new Date().toLocaleTimeString();
    const data = {"id": 0, "name": name, "birthDate": "2023-11-20T08:00:00.000Z", "typeId": "2"}
    await axios.post(`${baseUrl}/api/customer/owners/7/pets`, data, {timeout: 10000})
        .catch(err => {
            console.error("Failed to post /api/customer/owners/7/pets, error: " + err.response && err.response.data);
        }); // Catch and log errors
}
}, { scheduled: false });

postPetsHighTrafficTask.start();