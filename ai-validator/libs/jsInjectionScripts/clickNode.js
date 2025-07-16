/**
 * Clicks a specific node inside the Service Map
 *
 * Steps:
 * 1. Get the iFrame for the current page
 * 2. Query for the selected node in the Service Map
 * 3. Click this node
 * 
 * @param {string} testid - The value of the 'data-testid' element for the node
 *
 * @returns {string} - Confirmation string after JS injection utilized by the Browser Use agent.
 */
function clickNode(testid) {
  // Get the iFrame
  const iframe = document.querySelector(`iframe#microConsole-Pulse`);
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

  setTimeout(() => {
    // Get the node
    const node = iframeDoc.querySelector(`g[data-testid="${testid}"]`);
    if (node) {
      const nodeBounds = node.getBoundingClientRect();
      const nodeHoverX = nodeBounds.left + nodeBounds.width / 2;
      const nodeHoverY = nodeBounds.top + nodeBounds.height / 2;

      const nodeHoverEvent = new MouseEvent("mousemove", {
        clientX: nodeHoverX,
        clientY: nodeHoverY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      node.dispatchEvent(nodeHoverEvent);

      const nodeClickEvent = new MouseEvent("click", {
        clientX: nodeHoverX,
        clientY: nodeHoverY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      node.dispatchEvent(nodeClickEvent);
    } else {
      return "JavaScript not injected. Try again.";
    }
  }, 1000);

  return "JavaScript injected successfully. Continue with the steps.";
}
