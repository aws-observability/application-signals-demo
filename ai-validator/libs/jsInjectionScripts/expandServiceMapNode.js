/**
 * Expands a node in the Service Map
 *
 * @param {string} testid - The value of the 'data-testid' node to expand
 */
function expandServiceMapNode(testid) {
  // Get the iFrame
  const iframe = document.querySelector("iframe#microConsole-Pulse");
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

  const expandNode = `[data-testid="EXPAND_GROUP_TEST_ID-group:AWS::${testid}"]`;
  iframeDoc.querySelector(expandNode).click();
}
