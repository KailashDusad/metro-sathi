import axios from 'axios';
const fs = require('fs');

const overpassUrl = 'https://overpass-api.de/api/interpreter';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degree: number) => degree * (Math.PI / 180);
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

async function fetchStations(lat: number, lon: number, radius: number = 0.5) {
  const overpassQuery = `
  [out:json];
  (
    // Metro stations within the radius
    node["railway"="station"]["station"="subway"](around:${radius * 1000},${lat},${lon});
    // Bus stations within the radius
    node["highway"="bus_stop"](around:${radius * 1000},${lat},${lon});
  );
  out body;
  `;

  try {
    const response = await axios.post(overpassUrl, overpassQuery, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = response.data.elements
      .filter((element: any) => element.tags.name) // Remove entries with undefined names
      .map((element: any) => ({
        id: element.id,
        name: element.tags.name,
        type: element.tags.railway === 'station' ? 'metro' : 'bus',
        location: {
          lat: element.lat,
          lng: element.lon
        },
        distance: haversineDistance(lat, lon, element.lat, element.lon)
      }))
      .sort((a, b) => a.distance - b.distance);

    // Separate metro and bus stations
    const metroStations = data.filter(station => station.type === 'metro');
    const busStations = data.filter(station => station.type === 'bus');

    // Save data to NearestStations.ts
    const nearestStationsData = `
export interface Station {
  id: string;
  name: string;
  type: "metro" | "bus";
  location: {
    lat: number;
    lng: number;
  };
}

export const metroStations: Station[] = ${JSON.stringify(metroStations, null, 2)};

export const busStations: Station[] = ${JSON.stringify(busStations, null, 2)};

export const allStations: Station[] = [...metroStations, ...busStations];
`;
    fs.writeFileSync('d:\\Metro\\MetroSathiFinal\\data\\NearestStations.ts', nearestStationsData);

    return data;
  } catch (error) {
    console.error('Error fetching data from Overpass API:', error);
    return [];
  }
}

export async function getNearestStations(lat: number, lon: number, radius: number = 0.5) {
  const stations = await fetchStations(lat, lon, radius);
  return stations;
}