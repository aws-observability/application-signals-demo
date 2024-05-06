const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

/**
 * A canary which exercises the landing page of the Pet Clinic web app
 */
const landing = async function () {
    // Configure Synthetics
    const syntheticsConfiguration = synthetics.getConfiguration();
    syntheticsConfiguration.setConfig({
        includeRequestHeaders: true,
        includeResponseHeaders: true,
        includeRequestBody: true,
        includeResponseBody: true,
        logRequestBody: true,
        logResponseBody: true,
        screenshotOnStepStart: false,
        screenshotOnStepSuccess: false,
        screenshotOnStepFailure: false
    });

    // Configure the user agent for RUM
    const page = await synthetics.getPage();
    const chromeUserAgent =
        'HTC Mozilla/5.0 (Linux; Android 7.0; HTC 10 Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.83 Mobile Safari/537.36';
    await page.setUserAgent(chromeUserAgent);

    // Set up
    const url = 'http://af8a22467efd14a978624fc6aaeb4506-1281957169.us-east-2.elb.amazonaws.com/#!/welcome';

    // Load the page
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Verify the page loaded
    await synthetics.executeStep('Await LCP element', async function () {
        await page.waitForSelector('#pets', { visible: true });
        await page.click('#pets');
        await page.screenshot({ path: '/tmp/landing.png' });
    });

    // Navigate to owners page
    await synthetics.executeStep('Navigate to owners', async function () {
        await page.click('a.dropdown-toggle');
        await page.click('a[ui-sref="owners"]');
        await page.waitForSelector('a[href="#!/owners/details/1"]');
        await page.screenshot({ path: '/tmp/owners.png' });
    });

    // Navigate to vets page
    await synthetics.executeStep('Navigate to owners', async function () {
        await page.click('a[ui-sref="vets');
        await page.waitForSelector('tr[class="ng-scope"]');
        await page.screenshot({ path: '/tmp/vets.png' });
    });

    // Wait for RUM dispatch
    await new Promise((r) => setTimeout(r, 6000));
};

exports.handler = async () => {
    return await landing();
};
