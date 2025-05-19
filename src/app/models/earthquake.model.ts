/**
 * Interface representing a single earthquake feature
 * Based on the GeoJSON format provided by the USGS API
 */
export interface EarthquakeFeature {
  type: string;
  properties: {
    mag: number; // Magnitude
    place: string; // Location description
    time: number; // Time of the earthquake (UTC milliseconds)
    updated: number; // Last update time (UTC milliseconds)
    tz: number | null; // Timezone offset
    url: string; // URL to earthquake details page
    detail: string; // URL to detailed earthquake data
    felt: number | null; // Number of "felt" reports submitted
    cdi: number | null; // Community Determined Intensity
    mmi: number | null; // Maximum Modified Mercalli Intensity
    alert: string | null; // Alert level (green, yellow, orange, red)
    status: string; // Status of the event (reviewed, automatic, etc.)
    tsunami: number; // Tsunami warning flag (1 = tsunami warning)
    sig: number; // Significance of the event (based on magnitude, felt reports, etc.)
    net: string; // Network that reported the event
    code: string; // Event code
    ids: string; // Comma-separated list of event IDs
    sources: string; // Comma-separated list of data sources
    types: string; // Comma-separated list of product types
    nst: number | null; // Number of stations that reported the event
    dmin: number | null; // Minimum distance to station
    rms: number; // Root mean square of travel time residuals
    gap: number | null; // Azimuthal gap
    magType: string; // Method used to calculate the magnitude
    type: string; // Type of seismic event
    title: string; // Title/summary of the event
  };
  geometry: {
    type: string; // GeoJSON geometry type (typically "Point")
    coordinates: [number, number, number]; // [longitude, latitude, depth in km]
  };
  id: string; // Unique identifier for the event
}

/**
 * Interface representing the complete response from the USGS API
 */
export interface EarthquakeResponse {
  type: string; // GeoJSON type (typically "FeatureCollection")
  metadata: {
    generated: number; // Generation time of the feed
    url: string; // URL of the feed
    title: string; // Title of the feed
    status: number; // HTTP status code
    api: string; // API version
    count: number; // Count of earthquakes in the feed
  };
  features: EarthquakeFeature[]; // Array of earthquake features
  bbox: number[]; // Bounding box coordinates
}

/**
 * Interface representing the filter parameters for earthquake searches
 */
export interface EarthquakeFilters {
  startTime: string; // Start date (ISO string)
  endTime: string; // End date (ISO string)
  minMagnitude: number; // Minimum magnitude
  maxMagnitude?: number; // Maximum magnitude (optional)
  minLatitude?: number; // Minimum latitude (optional)
  maxLatitude?: number; // Maximum latitude (optional)
  minLongitude?: number; // Minimum longitude (optional)
  maxLongitude?: number; // Maximum longitude (optional)
  limit: number; // Maximum number of results
  offset: number; // Offset for pagination
}

/**
 * Interface representing summary statistics calculated from earthquake data
 */
export interface EarthquakeSummary {
  count: number; // Total count of earthquakes
  averageMagnitude: number; // Average magnitude
  strongestEarthquake: EarthquakeFeature | null; // Strongest earthquake in the set
  frequencyPerDay: { date: string; count: number }[]; // Daily frequency distribution
  magnitudeDistribution: { range: string; count: number }[]; // Magnitude distribution
}
