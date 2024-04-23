const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');
const syntheticsConfiguration = synthetics.getConfiguration();

const flowBuilderBlueprint = async function () {
    let url = process.env.URL + "/#!/owners/details/1";

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
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("body > div > div > div > ui-view > owner-details > table:nth-child(4) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(2) > a", { timeout: 30000 });
        await Promise.all([
           page.click("body > div > div > div > ui-view > owner-details > table:nth-child(4) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(2) > a"),
           page.waitForNavigation({ timeout: 30000 })
        ]);
    });
    await synthetics.executeStep('input', async function () {
        await page.waitForSelector("body > div > div > div > ui-view > visits > form > div:nth-child(2) > textarea", { timeout: 120000 });
        await page.type("body > div > div > div > ui-view > visits > form > div:nth-child(2) > textarea", "i\'m going to visit");
    });
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("body > div > div > div > ui-view > visits > form > div:nth-child(3) > button", { timeout: 120000 });
        await Promise.all([
            page.click("body > div > div > div > ui-view > visits > form > div:nth-child(3) > button"),
           page.waitForNavigation({ timeout: 30000 })
        ]);
    });


};

exports.handler = async () => {
    return await flowBuilderBlueprint();
};