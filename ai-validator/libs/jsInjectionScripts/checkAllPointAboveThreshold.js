/**
 * Determines if all data points in the selected metric graph are above a threshold line
 * or are all zero (based on the provided parameter - checkZero).
 *
 * @param {number} chartPosition - Index of the metric graph to be selected.
 * @param {number} checkboxPosition - Index of the legend checkbox to de-select to clearly display the correct line.
 * @param {boolean} checkZero - If true, ensures all points are zero (cy = 90); if false, checks if all points are above the threshold line.
 *
 * @returns {Promise<boolean>} - Returns true if all data points satisfy the condition, or false if any fail.
 */
async function checkAllPointAboveThreshold(
  chartPosition,
  checkboxPosition,
  checkZero
) {
  // Define constants
  const LEADER_BOARD_DATA_POINT_SELECTOR = "circle.leaderboard-datapoint";
  const EVENT_LAYER_SELECTOR = ".event-layer";
  const ALL_DATA_POINT_SELECTOR = "circle.all-datapoint";
  const IFRAME_SELECTOR = "iframe#microConsole-Pulse";
  const LEGEND_CHECKBOX_SELECTOR = "rect.legend-checkbox";
  const CWDB_CHART_SELECTOR = "div.cwdb-chart";
  const ANNOTATION_LINE_SELECTOR = "line.annotation-line";

  const MAX_RETRIES = 10;
  const RETRY_DELAY = 500;

  // Get the iFrame
  const iframe = document.querySelector(IFRAME_SELECTOR);
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

  // Each graph has 2+ lines graphed. To ensure the correct line is selected, we remove the other plot
  const checkboxes = iframeDoc.querySelectorAll(LEGEND_CHECKBOX_SELECTOR);
  const checkbox = checkboxes[checkboxPosition];
  const checkboxGroup = checkbox.closest("g.legend.dimmable");

  // If this checkbox is not already disabled, we disable it
  if (!checkboxGroup?.classList.contains("legend-disabled")) {
    const checkboxBounds = checkbox.getBoundingClientRect();
    const checkboxHoverX = checkboxBounds.left + checkboxBounds.width / 2;
    const checkboxHoverY = checkboxBounds.top + checkboxBounds.height / 2;

    const checkboxHoverEvent = new MouseEvent("mousemove", {
      clientX: checkboxHoverX,
      clientY: checkboxHoverY,
      bubbles: true,
      cancelable: true,
      view: window,
    });

    checkbox.dispatchEvent(checkboxHoverEvent);

    const checkboxClickEvent = new MouseEvent("click", {
      clientX: checkboxHoverX,
      clientY: checkboxHoverY,
      bubbles: true,
      cancelable: true,
      view: window,
    });

    checkbox.dispatchEvent(checkboxClickEvent);
  }

  // Query all of the graphs in the iFrame
  const charts = iframeDoc.querySelectorAll(CWDB_CHART_SELECTOR);

  // Select the specific chart
  const chart = charts[chartPosition];

  // Get the <rect> element within this chart. This will help us hover over the dynamic part
  const eventLayer = chart.querySelector(EVENT_LAYER_SELECTOR);

  // Get the position of this object relative to the viewport (https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
  const rect = eventLayer.getBoundingClientRect();

  // Hover over the middle of this element (does not have to be the middle, but this step is required to access all <circle> element datapoints)
  const hoverX = rect.left + rect.width / 2;
  const hoverY = rect.top + rect.height / 2;

  // Create new MouseEvent to move the mouse to these specific hover coordinates
  const hoverEvent = new MouseEvent("mousemove", {
    clientX: hoverX,
    clientY: hoverY,
    bubbles: true,
    cancelable: true,
    view: window,
  });

  // Send this hover event to the eventLayer object (https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent)
  eventLayer.dispatchEvent(hoverEvent);

  // Wait 1 second for hover event to update the graph
  setTimeout(() => {}, 1000);

  // Get the leaderboard datapoint
  const leaderBoardDataPoint = chart.querySelector(
    LEADER_BOARD_DATA_POINT_SELECTOR
  );

  // Get the position of this object relative to the viewpoint
  const leaderBoardDataPointRect = leaderBoardDataPoint.getBoundingClientRect();

  const leaderBoardDataPointX =
    leaderBoardDataPointRect.left + leaderBoardDataPointRect.width / 2;
  const leaderBoardDataPointY =
    leaderBoardDataPointRect.top + leaderBoardDataPointRect.height / 2;

  const leaderBoardDataPointEvent = new MouseEvent("mousemove", {
    clientX: leaderBoardDataPointX,
    clientY: leaderBoardDataPointY,
    bubbles: true,
    cancelable: true,
    view: window,
  });
  leaderBoardDataPoint.dispatchEvent(leaderBoardDataPointEvent);

  // Get the threshold line
  const annotationLines = iframeDoc.querySelectorAll(ANNOTATION_LINE_SELECTOR);
  const annotationLineY = parseFloat(annotationLines[2].getAttribute("y1"));

  /**
   * Waits for the chart to populate all data points, then verifies
   * each point against the threshold or zero value depending on checkZero boolean.
   *
   * @returns {Promise<boolean|[]>} - Returns true if all are valid, false if any fail, [] if none found
   */
  async function waitForAllDatapoints() {
    for (let i = 0; i < MAX_RETRIES; i++) {
      const allDatapoints = iframeDoc.querySelectorAll(ALL_DATA_POINT_SELECTOR);

      if (allDatapoints.length > 0) {
        for (const datapoint of allDatapoints) {
          const cy = parseFloat(datapoint.getAttribute("cy"));
          // If the points are above the threshold line OR not equal to zero, we immediately return false
          if ((cy > annotationLineY && !checkZero) || (cy != 90 && checkZero)) {
            return false;
          }
        }
        // If we make it to the end, we return true
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
    return [];
  }

  const result = await waitForAllDatapoints();
  return result;
}
