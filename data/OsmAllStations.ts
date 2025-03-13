import axios from 'axios';
const fs = require('fs');

const overpassUrl = 'https://overpass-api.de/api/interpreter';

const overpassQuery = `
[out:json];
(
  // Metro stations in Gujarat and Delhi
  node["railway"="station"]["station"="subway"](23.0,68.0,24.0,74.0); // Gujarat
  node["railway"="station"]["station"="subway"](28.4,76.8,28.9,77.3); // Delhi

  // Bus stations in Gujarat and Delhi
  node["highway"="bus_stop"](23.0,68.0,24.0,74.0); // Gujarat
  node["highway"="bus_stop"](28.4,76.8,28.9,77.3); // Delhi
);
out body;
`;

export async function fetchStations() {
  try {
    const response = await axios.post(overpassUrl, overpassQuery, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = response.data.elements
      .filter((element: any) => element.tags.name) // Remove entries with undefined names
      .map((element: any) => {
        let city = element.tags['addr:city'] || 'unknown';
        if (city === 'unknown') {
          if (element.lat >= 23.0 && element.lat <= 24.0 && element.lon >= 68.0 && element.lon <= 74.0) {
            city = 'ahmedabad';
          } else if (element.lat >= 28.4 && element.lat <= 28.9 && element.lon >= 76.8 && element.lon <= 77.3) {
            city = 'delhi';
          }
        }
        return {
          id: element.id,
          name: element.tags.name,
          type: element.tags.railway === 'station' ? 'metro' : 'bus',
          city: city,
          location: {
            lat: element.lat,
            lng: element.lon
          }
        };
      });

    // Save data to stops.ts
    const stopsData = `export const stops = ${JSON.stringify(data, null, 2)};`;
    fs.writeFileSync('d:\\Metro\\MetroSathiFinal\\data\\stops.ts', stopsData);

    return data;
  } catch (error) {
    console.error('Error fetching data from Overpass API:', error);
    return [];
  }
}

// Example usage
fetchStations().then(stations => {
  console.log(stations);
});