/**
 * Selects the random point in the selected metric graph.
 *
 * Steps:
 * 1. Get the iFrame for the current page
 * 2. De-select the line graph that we are not trying to access
 * 3. Query for the metric graph
 * 4. Hover over the graph to make the leaderboard datapoint visible
 * 5. Hover over the leaderboard datapoint to make all datapoints visible
 * 6. Return a random point in the metric graph
 * 7. Click the returned datapoint
 *
 * @param {number} chartPosition - Index of the target chart to be selected.
 * @param {number} checkboxPosition - Index of the legend checkbox to de-select to clearly display the correct line.
 *
 * @returns {string} - Confirmation string after JS injection utilized by the Browser Use agent.
 */
function clickRandomGraphPoint(chartPosition, checkboxPosition) {
  const TRIAGE_CHART_SELECTOR = '[data-testid="triage-chart"]';
  const LEADER_BOARD_DATA_POINT_SELECTOR = "circle.leaderboard-datapoint";
  const EVENT_LAYER_SELECTOR = ".event-layer";
  const DATA_POINT_SELECTOR = "circle.datapoint";
  const ALL_DATA_POINT_SELECTOR = "circle.all-datapoint:not(.hidden)";
  const IFRAME_SELECTOR = "iframe#microConsole-Pulse";
  const LEGEND_CHECKBOX_SELECTOR = "rect.legend-checkbox";

  const MAX_RETRIES = 10;
  const RETRY_DELAY = 500; // milliseconds (ms)

  // Get the iFrame
  const iframe = document.querySelector(IFRAME_SELECTOR);
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

  // Each graph has 2+ lines graphed. To ensure the correct line is selected, we remove the other plot
  const checkboxes = iframeDoc.querySelectorAll(LEGEND_CHECKBOX_SELECTOR);
  const checkbox = checkboxes[checkboxPosition]; // TEST PARAM (6)
  const checkboxGroup = checkbox.closest("g.legend.dimmable");

  // If this checkbox is not already disabled, we disable it
  if (!checkboxGroup?.classList.contains("legend-disabled")) {
    const checkboxBounds = checkbox.getBoundingClientRect();
    const checkboxHoverX = checkboxBounds.left + checkboxBounds.width / 2;
    const checkboxHoverY = checkboxBounds.top + checkboxBounds.height / 2;

    for (let i = 0; i < MAX_RETRIES; i++) {
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

      if (checkboxGroup?.classList.contains("legend-disabled")) {
        break;
      }
    }
  }

  // This will query all of the graphs in the iFrame
  const charts = iframeDoc.querySelectorAll(TRIAGE_CHART_SELECTOR);

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

  waitForRandomDatapoint().then((element) => {
    if (element) {
      const elementRect = element.getBoundingClientRect();
      const elementX = elementRect.left + elementRect.width / 2;
      const elementY = elementRect.top + elementRect.height / 2;

      const hoverEvent = new MouseEvent("mousemove", {
        clientX: elementX,
        clientY: elementY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      element.dispatchEvent(hoverEvent);
      clickDataPoint(DATA_POINT_SELECTOR);
    } else {
      console.warn("No element with a `cy` value found.");
    }
  });

  /**
   * Waits for the chart to populate all data points and returns a random element.
   *
   * Retries MAX_RETRIES times to account for rendering delays.
   *
   * @returns {Promise<Element|null>} - A random SVG circle element, or null if none found.
   */
  async function waitForRandomDatapoint() {
    for (let i = 0; i < MAX_RETRIES; i++) {
      // Find all <circle> datapoints in line graph
      const allDatapoints = iframeDoc.querySelectorAll(ALL_DATA_POINT_SELECTOR);

      if (allDatapoints.length > 0) {
        const index = Math.floor(Math.random() * allDatapoints.length);
        return allDatapoints[index];
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }

    console.warn("No datapoints found after retries.");
    return null;
  }

  /**
   * Simulates a full mouse click (mousedown → mouseup → click) on the provided data point.
   * Will retry if the point is not found, has invalid coordinates, or fails to open a valid popup.
   *
   * Reference: Console team code (https://code.amazon.com/packages/CloudWatchConsole-ApplicationMonitoringTests/blobs/4cea84c2b68bccc4ca05269b23223004798db39f/--/src/selectors/triage/charts.ts#L233)
   *
   * @param {string} selector - CSS selector (DATA_POINT_SELECTOR) to identify the SVG circle to click.
   * @returns {Promise<void>}
   */
  async function clickDataPoint(selector) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const datapoint = chart.querySelector(selector);

        // Sometimes, the datapoint may not be findable. If this is the case, try again
        if (!datapoint) {
          console.warn(`Attempt ${attempt}: Datapoint not found.`);
          await wait(RETRY_DELAY);
          continue;
        }

        // Parse the x/y-coordinates from string to float
        const cx = parseFloat(datapoint.getAttribute("cx"));
        const cy = parseFloat(datapoint.getAttribute("cy"));

        // Sometimes, the datapoint is not correctly found. If this is the case, try again
        if (isNaN(cx) || isNaN(cy)) {
          await wait(RETRY_DELAY);
          continue;
        }

        // Create new MouseEvent to move the mouse down at these coordinates
        const mousedownEvent = new MouseEvent("mousedown", {
          clientX: cx,
          clientY: cy,
          bubbles: true,
          cancelable: true,
          view: window,
        });
        // Send this hover event to the <circle> datapoint object
        datapoint.dispatchEvent(mousedownEvent);

        // Create new MouseEvent to move the mouse up at these coordinates
        const mouseupEvent = new MouseEvent("mouseup", {
          clientX: cx,
          clientY: cy,
          bubbles: true,
          cancelable: true,
          view: window,
        });
        // Send this hover event to the <circle> datapoint object
        datapoint.dispatchEvent(mouseupEvent);

        // Create new MouseEvent to click the mouse down at these coordinates
        const clickEvent = new MouseEvent("click", {
          clientX: cx,
          clientY: cy,
          bubbles: true,
          cancelable: true,
          view: window,
        });
        // Send this hover event to the <circle> datapoint object
        datapoint.dispatchEvent(clickEvent);

        return; // If this was successful, you can exit this loop
      } catch (error) {
        console.warn(`Attempt ${attempt}: Error occurred - ${error.message}`);
      }

      await wait(RETRY_DELAY); // If this was not successful, delay then try again
    }

    console.error(`Failed to click datapoint after ${MAX_RETRIES} attempts.`);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  return "JavaScript injected successfully.";
}
