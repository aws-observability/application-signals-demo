/**
 * Clicks a blue hexadecimal string in the "Correlated Spans" panel
 *
 * Steps:
 * 1. Get the iFrame for the current page
 * 2. Query for the first hexadecimal string in the page
 * 3. Click this element
 *
 * @returns {string} - Confirmation string after JS injection utilized by the Browser Use agent.
 */
function clickHexadecimal() {
  const iframeDoc =
    document.querySelector("#microConsole-Pulse")?.contentDocument ||
    document.querySelector("#microConsole-Pulse")?.contentWindow?.document;

  iframeDoc
    ?.querySelector('a[aria-label^="Trace details for trace "]')
    ?.click();

  return "JavaScript injected successfully. Continue with the steps.";
}
