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
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("#main-navbar > ul > li.dropdown > a", { timeout: 120000 });
        await page.click("#main-navbar > ul > li.dropdown > a");
    });
    await synthetics.executeStep('click', async function () {
        await page.waitForSelector("#main-navbar > ul > li.dropdown.open > ul > li:nth-child(2) > a", { timeout: 30000 });
        await Promise.all([
            page.click("#main-navbar > ul > li.dropdown.open > ul > li:nth-child(2) > a"),
            page.waitForNavigation({ timeout: 30000 })
         ]);
    });


};

exports.handler = async () => {
    return await flowBuilderBlueprint();
};