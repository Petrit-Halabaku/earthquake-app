# Earthquake Dashboard Challange

## Background & Context

You are building an interactive web dashboard for SeismoKode, a seismology enthusiast community. The goal is to visualize real-time earthquake data, allowing users to explore, filter, and analyze seismic activity around the globe. This challenge will test your skills in HTML, CSS, and JavaScript, as well as your ability to work with external APIs, handle large datasets, and create published, responsive visualizations.

## Tech Stack
- Any framework (**Angular** preferred)
- Charting library of your choice (**ECharts** preferred)
- Map library of your choice (**Leaflet** preferred)

## Data Source

### USGS Earthquake Catalog APIs

To demonstrate your ability to understand and work with external APIs, you will be integrating the [USGS Earthquake Catalog API](https://earthquake.usgs.gov/fdsnws/event/1). This task will assess your ability to read API documentation, interpret the available data, and implement a solution that effectively utilizes the API.

## Requirements

### 1. Data Handling and Manipulation
   - Retrieve data from USGS API with filtering capabilities (magnitude, date range, geographic area).
   - Summarize average magnitude, earthquake frequency per day, strongest earthquakes within criteria.
   - Efficient handling of potentially large datasets.

### 2. Alert Table
   - Present earthquake data in a sortable table.
   - Clearly highlight critical alerts or warnings based on magnitude or depth.
   - Infinite scrolling recommended as optional enhancement for data loading.

### 3. Visualization with Charts
   - Interactive map visualization using Leaflet or Mapbox.
   - At least two dynamic charts (e.g., line, bar, pie) illustrating earthquake frequency and magnitude distribution.
   - Charts must respond to user-applied filters.
   - Create reusable chart templates that consume data in a specific structure."

### 4. Styling
   - Modern, responsive design for excellent user experience on desktop and mobile devices.
   - Clean, intuitive interface with clear navigation and interactivity.

## Additional Considerations
   - Comprehensive documentation in README covering setup, library choices, and component explanations.
   - Provide basic tests for critical components such as data fetching, filtering, and infinite scrolling.
   - Offer guidelines for deploying your application.

## Evaluation Criteria
Your submission will be evaluated based on:

- **Architecture** – Clarity, scalability, and modularity of your overall solution design.
- **Code Quality** – Readability, maintainability, and adherence to best practices.
- **Functionality** – Correct implementation of all required features and behaviors.
- **User Experience (UX)** – Intuitive, responsive, and visually appealing interface across devices.
- **Performance** – Efficient data handling, responsiveness under large datasets, and optimization.
- **Documentation** – Completeness, clarity, and usefulness of the README and code comments.

## Bonus Points
   - Animation effects on data updates.
   - Robust error handling with user-friendly notifications.
   - Demonstrate exceptional performance with large-scale data.
