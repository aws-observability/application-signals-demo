/**
 * Scrolls down within an iFrame or specific element
 *
 * @param {string} iFrameId - Identifier of the iFrame.
 * @param {string} elementId - Selector of the scrollable element inside the iframe.
 *                             Use '"#html"' to scroll the whole iFrame window.
 * @param {number} scrollTimes - The number of viewport (pages) to scroll down.
 *
 * @returns {string} - Confirmation string after JS injection utilized by the Browser Use agent.
 */
function scrollDown(iframeId, elementId, scrollTimes) {
  // Get the iFrame
  const iframe = document.getElementById(`microConsole-${iframeId}`);
  const iframeWindow = iframe.contentWindow;

  if (elementId === "#html") {
    // Scroll the whole iFrame window
    const viewportHeight = iframeWindow.innerHeight;
    iframeWindow.scrollBy(0, viewportHeight * scrollTimes);
  } else {
    // Scroll the specific element
    const doc = iframeWindow.document;
    const main = doc.querySelector(elementId);
    main.scrollBy(0, main.clientHeight * scrollTimes);
  }
  return "JavaScript injected successfully.";
}
