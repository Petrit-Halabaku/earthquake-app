# SeismoKode User Guide

Welcome to the SeismoKode Earthquake Dashboard! This guide will help you navigate and use the dashboard effectively.

## Getting Started

SeismoKode is a web-based dashboard that visualizes earthquake data from the USGS Earthquake Catalog. The dashboard allows you to:

- View recent earthquakes on an interactive map
- Filter earthquakes by various criteria
- Analyze earthquake patterns through charts and statistics
- Access detailed information about specific earthquake events

## Dashboard Overview


The dashboard consists of several key sections:

1. **Filter Panel**: Control what earthquake data is displayed
2. **Summary Statistics**: View key metrics about the displayed earthquakes
3. **Charts**: Visualize earthquake frequency and magnitude distribution
4. **Interactive Map**: See the geographic distribution of earthquakes
5. **Data Table**: Browse detailed information about each earthquake

## Using the Filter Panel

The filter panel allows you to customize what earthquake data is displayed:

### Basic Filters

- **Date Range**: Select start and end dates to view earthquakes within a specific time period
- **Magnitude Range**: Set minimum and maximum magnitude values

### Advanced Filters

Click the "Advanced Filters" dropdown to access additional options:

- **Geographic Coordinates**: Specify latitude and longitude boundaries
- **Results Limit**: Control the number of results returned (max 500)

After setting your desired filters, click "Apply Filters" to update the dashboard.

## Understanding the Map

The interactive map displays earthquakes as colored circles:

- **Circle Size**: Represents the earthquake's magnitude (larger circles = stronger earthquakes)
- **Circle Color**: Indicates the earthquake's intensity:
  - Blue: Minor (&lt; 2.0)
  - Green: Light (2.0 - 3.9)
  - Yellow: Moderate (4.0 - 5.9)
  - Orange: Strong (6.0 - 7.9)
  - Red: Major (8.0 or greater)

### Map Interaction

- **Click on a circle**: Opens a popup with detailed information about that earthquake
- **Zoom**: Use the mouse wheel or pinch gestures to zoom in/out
- **Pan**: Click and drag to move around the map

## Reading the Charts

The dashboard includes two main charts:

### Frequency Chart

Shows the number of earthquakes per day over the selected time period. This helps identify trends or unusual spikes in seismic activity.

### Magnitude Distribution

Displays the distribution of earthquakes by magnitude range, helping you understand the relative frequency of different earthquake intensities.

## Using the Data Table

The earthquake table provides a detailed list of all earthquakes matching your filter criteria:

- **Sorting**: Click on column headers to sort the data
- **Color Coding**: Rows are color-coded based on earthquake magnitude
- **Details Link**: Click the link icon to view the official USGS page for that earthquake

## Tips for Optimal Use

1. **Start with a Reasonable Date Range**: Large date ranges (more than three months) may cause slower performance.
2. **Use Geographic Filters**: If you're interested in a specific region, use the latitude/longitude filters
3. **Adjust Magnitude Filters**: To focus on significant earthquakes, set a higher minimum magnitude
4. **Check the Summary Statistics**: These provide a quick overview of the data you're viewing

## Troubleshooting

### Slow Loading Times

- Reduce your date range.
- Increase your minimum magnitude filter.
- Specify a geographic region.
- Reduce the results limit.

### No Data Displayed

- Check that your filter criteria aren't too restrictive.
- Ensure your date range includes periods with known earthquake activity.
- Verify that your minimum and maximum magnitude values make sense.

### Map Not Loading Properly

- Try refreshing the page.
- Check your internet connection.
- Ensure your browser is up to date.

## Getting Help

If you encounter any issues or have questions about using the dashboard, please contact our support team or open an issue on our GitHub repository.

Thank you for using SeismoKode!
