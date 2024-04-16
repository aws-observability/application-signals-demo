const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');
const syntheticsConfiguration = synthetics.getConfiguration();

const flowBuilderBlueprint = async function () {
    let url = process.env.URL + "/#!/welcome";

    syntheticsConfiguration.setConfig({
        includeRequestHeaders: true, // Enable if headers should be displayed in HAR
        includeResponseHeaders: true, // Enable if headers should be displayed in HAR
        restrictedHeaders: [], // Value of these headers will be redacted from logs and reports
        restrictedUrlParameters: [] // Values of these url parameters will be redacted from logs and reports
    });
    let page = await synthetics.getPage();

    // Navigate to the initial url
    await synthetics.executeStep('navigateToUrl', async function (timeoutInMillis = 120000) {
        await page.goto(url, {waitUntil: ['load', 'networkidle0'], timeout: timeoutInMillis});
    });

    // Execute customer steps
    await synthetics.executeStep('Click_1', async function() {
        await page.waitForSelector('.navbar > #main-navbar > .nav > .dropdown:nth-child(2) > .dropdown-toggle', { timeout: 120000 })
        await page.click('.navbar > #main-navbar > .nav > .dropdown:nth-child(2) > .dropdown-toggle')
    })
      
    await synthetics.executeStep('Click_2', async function() {
        await page.waitForSelector('.nav > .open > .dropdown-menu > li:nth-child(1) > a', { timeout: 120000 })
        await page.click('.nav > .open > .dropdown-menu > li:nth-child(1) > a')
    })
      
    await synthetics.executeStep('Click_3', async function() {
        await page.waitForSelector('.table > tbody > .ng-scope:nth-child(4) > td:nth-child(1) > .ng-binding', { timeout: 120000 })
        await page.click('.table > tbody > .ng-scope:nth-child(4) > td:nth-child(1) > .ng-binding')
    })
      
    await synthetics.executeStep('Click_4', async function() {
        await page.waitForSelector('.ng-scope > td > .dl-horizontal > dd > .ng-binding', { timeout: 120000 })
        await page.click('.ng-scope > td > .dl-horizontal > dd > .ng-binding')
    })
      
    await synthetics.executeStep('Click_5', async function() {
        await page.waitForSelector('.ng-scope > .form-horizontal > .form-group > .col-sm-6 > .btn', { timeout: 120000 })
        await page.click('.ng-scope > .form-horizontal > .form-group > .col-sm-6 > .btn')
    })


};

exports.handler = async () => {
    return await flowBuilderBlueprint();
};