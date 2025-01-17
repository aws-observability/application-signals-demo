const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');
const syntheticsConfiguration = synthetics.getConfiguration();

const flowBuilderBlueprint = async function () {
    let url = process.env.URL + "/#!/owners/new";

    syntheticsConfiguration.setConfig({
        includeRequestHeaders: true, // Enable if headers should be displayed in HAR
        includeResponseHeaders: true, // Enable if headers should be displayed in HAR
        restrictedHeaders: [], // Value of these headers will be redacted from logs and reports
        restrictedUrlParameters: [] // Values of these url parameters will be redacted from logs and reports
    });
    let page = await synthetics.getPage();
    const currentTime = new Date().toLocaleTimeString()
    const firstName = "firstName" + currentTime;
    const lastName = "lastName" + currentTime;

    // Navigate to the initial url
    await synthetics.executeStep('navigateToUrl', async function (timeoutInMillis = 120000) {
        await page.goto(url, {waitUntil: ['load', 'networkidle0'], timeout: timeoutInMillis});
    });

    // Execute customer steps
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > owner-form > form > div:nth-child(1) > input", firstName);
    });
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > owner-form > form > div:nth-child(2) > input", lastName);
    });
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > owner-form > form > div:nth-child(3) > input", "address");
    });
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > owner-form > form > div:nth-child(4) > input", "city");
    });
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > owner-form > form > div:nth-child(5) > input", "408098080808");
    });
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("body > div > div > div > ui-view > owner-form > form > div:nth-child(6) > button", { timeout: 30000 });
        await Promise.all([
            page.click("body > div > div > div > ui-view > owner-form > form > div:nth-child(6) > button"),
            page.waitForNavigation({ timeout: 30000 })
        ]);
    });
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > owner-list > form > div > input", firstName);
    });
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("body > div > div > div > ui-view > owner-list > table > tbody > tr:nth-child(1) > td:nth-child(1) > a", { timeout: 30000 });
        await Promise.all([
            page.click("body > div > div > div > ui-view > owner-list > table > tbody > tr:nth-child(1) > td:nth-child(1) > a"),
            page.waitForNavigation({ timeout: 30000 })
        ]);
    });
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("body > div > div > div > ui-view > owner-details > table:nth-child(2) > tbody > tr:nth-child(5) > td:nth-child(2) > a", { timeout: 30000 });
        await Promise.all([
            page.click("body > div > div > div > ui-view > owner-details > table:nth-child(2) > tbody > tr:nth-child(5) > td:nth-child(2) > a"),
            page.waitForNavigation({ timeout: 30000 })
        ]);
    });
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > pet-form > form > div:nth-child(2) > div > input", lastName);
    });
    await synthetics.executeStep('input', async function () {
        await page.type("body > div > div > div > ui-view > pet-form > form > div:nth-child(3) > div > input", "08082022");
    });
    await synthetics.executeStep('click', async function() {
        await page.waitForSelector('.ng-scope > .form-horizontal > .form-group:nth-child(5) > .col-sm-6 > .form-control', { timeout: 120000 })
        await page.click('.ng-scope > .form-horizontal > .form-group:nth-child(5) > .col-sm-6 > .form-control')
    })
    await synthetics.executeStep('select', async function() {
        await page.select('.ng-scope > .form-horizontal > .form-group:nth-child(5) > .col-sm-6 > .form-control', '1')
    })
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("body > div > div > div > ui-view > pet-form > form > div:nth-child(6) > div > button", { timeout: 120000 });
        await Promise.all([
           await page.click("body > div > div > div > ui-view > pet-form > form > div:nth-child(6) > div > button"),
           page.waitForNavigation({ timeout: 30000 })
        ]);
    });
};

exports.handler = async () => {
    return await flowBuilderBlueprint();
};