# SeismoKode - Developer Documentation

## Project Overview

SeismoKode is an Angular-based earthquake visualization dashboard that integrates with the USGS Earthquake API to provide real-time earthquake data in an interactive format. This document provides technical details for developers working on or extending the codebase.

## Architecture

The application follows a component-based architecture using Angular's standalone components approach. Key parts of the architecture include:

- **Components**: Reusable UI elements with specific responsibilities
- **Services**: Handle data fetching, processing, and shared functionality
- **Models**: Define interfaces and types used throughout the application
- **Reactive approach**: Uses RxJS for reactive data handling
#### Application Structure
Following Angular’s best practices, the application is organized as follows:
```
src/
├── app/
│   ├── components/           # Reusable UI components
│   │   ├── charts/           # Components for data visualization
│   │   ├── earthquake-map/   # Interactive earthquake map
│   │   ├── earthquake-table/ # Tabular display of earthquake data
│   │   ├── filter/           # Filtering and search functionality
│   │   ├── header/           # Application header
│   │   └── summary/          # Summary statistics display
│   ├── models/               # TypeScript models and interfaces
│   ├── services/             # Data handling and utility services
│   └── app.component.ts      # Root component
├── environments/             # Environment-specific configurations
└── global_styles.css         # Global stylesheet
```

### Key Components

1. **AppComponent**: The root component that orchestrates the dashboard
2. **FilterComponent**: Handles user search criteria input
3. **EarthquakeMapComponent**: Visualizes earthquake locations using Leaflet
4. **EarthquakeTableComponent**: Displays detailed earthquake data in tabular format
5. **Charts Components**: Visualize earthquake statistics using ECharts
6. **SummaryComponent**: Shows aggregated earthquake statistics

### Data Flow

1. User inputs search criteria in the FilterComponent
2. FilterComponent emits filter parameters to the AppComponent
3. AppComponent passes filters to the EarthquakeService
4. EarthquakeService fetches data from the USGS API
5. EarthquakeService processes and distributes the data to components via Observables
6. Components render the data in various formats (map, table, charts)

## Dependencies

### Core Dependencies

- **Angular**: Framework for building the application
- **RxJS**: Library for reactive programming
- **date-fns**: Date utility library

### UI Dependencies

- **Leaflet**: Interactive mapping library
- **ECharts**: Data visualization library
- **ngx-toastr**: Notification system

## API Integration

The application integrates with the USGS Earthquake API:

- **Endpoint**: `https://earthquake.usgs.gov/fdsnws/event/1/query`
- **Format**: GeoJSON
- **Key Parameters**:
  - `starttime`: Start of date range (YYYY-MM-DD)
  - `endtime`: End of date range (YYYY-MM-DD)
  - `minmagnitude`: Minimum earthquake magnitude
  - `maxmagnitude`: Maximum earthquake magnitude
  - `limit`: Maximum number of results to return

## Performance Optimizations

The application implements several performance optimizations:

1. **Data Caching**: Recent queries are cached to reduce API calls
2. **Request Cancellation**: Long-running requests can be cancelled
3. **Timeout Handling**: Requests time out after 30 seconds
4. **Progressive Loading**: Loading state shows progress to users
5. **Lazy Components**: Components load efficiently

## Responsive Design

The application uses CSS variables and a custom grid system to ensure responsive behavior across devices:

- **Desktop**: Full layout with side-by-side components
- **Tablet**: Adjusted layout with stacked components as needed
- **Mobile**: Fully stacked layout with optimized controls

## Error Handling

The application implements comprehensive error handling:

1. **API Errors**: Captured and displayed with recovery options
2. **Validation Errors**: Form validation prevents invalid requests
3. **Timeout Handling**: Long-running requests are detected
4. **User Feedback**: Toast notifications inform users of status

## Future Enhancements

Potential areas for future development:

1. **Authentication**: Add user accounts for saved searches
2. **Push Notifications**: Alert users to significant earthquakes
3. **Offline Support**: Implement service workers for offline functionality
4. **Advanced Analytics**: Add more statistical analysis features
5. **Multiple Data Sources**: Integrate additional earthquake data sources

## Overview

SeismoKode is a comprehensive, real-time earthquake data visualization dashboard built with Angular. It provides an intuitive interface for users to explore and analyze earthquake data from the USGS Earthquake Catalog.

## Features

- **Real-time Data**: Fetches and displays the latest earthquake data from USGS
- **Interactive Map**: Visualizes earthquake locations with magnitude-based markers
- **Advanced Filtering**: Filter earthquakes by date range, magnitude, and geographic coordinates
- **Data Visualization**: Charts showing earthquake frequency and magnitude distribution
- **Sortable Data Table**: View detailed earthquake information in a sortable table
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Caching System**: Improves performance by caching recent queries

## Technology Stack

- **Framework**: Angular 17+
- **UI Components**: Custom-built responsive components
- **Maps**: Leaflet.js for interactive mapping
- **Charts**: ECharts for data visualization
- **HTTP**: Angular HttpClient for API requests
- **Notifications**: ngx-toastr for user notifications
- **Date Handling**: date-fns for date manipulation
- **CSS**: Custom variables and utility classes


4. Open your browser and navigate to `http://localhost:4200`


### Performance Tips

- Limit your date range to improve loading times
- Use geographic filters to focus on specific regions
- The system caches recent queries to improve performance
- For large result sets, increase the limit gradually
