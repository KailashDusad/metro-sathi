import axios from "axios"

// Define station interface
export interface Station {
  id: string
  name: string
  type: "metro" | "bus"
  city: string
  location: {
    lat: number
    lng: number
  }
  distance?: number
}

// Define regions with bounding boxes for Gujarat and Delhi
const regions = {
  GUJARAT: {
    name: "Gujarat",
    // Bounding box coordinates for Gujarat
    bbox: [68.1, 20.1, 74.5, 24.7],
  },
  DELHI: {
    name: "Delhi",
    // Bounding box coordinates for Delhi
    bbox: [76.8, 28.4, 77.4, 28.9],
  },
}

// Cache for stations to avoid repeated API calls
const stationCache: {
  [key: string]: Station[]
} = {}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degree: number) => degree * (Math.PI / 180)
  const R = 6371 // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in kilometers
}

/**
 * Fetch stations from OpenStreetMap for a specific region
 */
export async function fetchStationsForRegion(
  region: typeof regions.GUJARAT | typeof regions.DELHI,
): Promise<Station[]> {
  // Check if we have cached data for this region
  const cacheKey = region.name
  if (stationCache[cacheKey]) {
    return stationCache[cacheKey]
  }

  const [minLon, minLat, maxLon, maxLat] = region.bbox

  // Overpass API query to fetch metro and bus stations within the bounding box
  const overpassQuery = `
    [out:json];
    (
      // Metro stations within the bounding box
      node["railway"="station"]["station"="subway"](${minLat},${minLon},${maxLat},${maxLon});
      node["railway"="station"]["station"="metro"](${minLat},${minLon},${maxLat},${maxLon});
      
      // Bus stations within the bounding box
      node["highway"="bus_stop"](${minLat},${minLon},${maxLat},${maxLon});
      node["public_transport"="stop_position"]["bus"="yes"](${minLat},${minLon},${maxLat},${maxLon});
    );
    out body;
  `

  try {
    const response = await axios.post("https://overpass-api.de/api/interpreter", overpassQuery, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    const stations = response.data.elements
      .filter((element: any) => element.tags && element.tags.name) // Filter out entries without names
      .map((element: any) => ({
        id: element.id.toString(),
        name: element.tags.name,
        type:
          element.tags.railway === "station" || element.tags.station === "subway" || element.tags.station === "metro"
            ? "metro"
            : "bus",
        city: region.name,
        location: {
          lat: element.lat,
          lng: element.lon,
        },
      }))

    // Cache the results
    stationCache[cacheKey] = stations
    return stations
  } catch (error) {
    console.error(`Error fetching stations for ${region.name}:`, error)
    return []
  }
}

/**
 * Get nearest stations to a given location using Overpass API directly
 * This is an alternative approach that queries OSM directly for nearby stations
 */
export async function getNearestStationsFromOSM(
  lat: number,
  lon: number,
  radius = 0.5,
  limit = 10,
): Promise<Station[]> {
  // Convert radius from km to meters for Overpass
  const radiusInMeters = radius * 1000

  const overpassQuery = `
    [out:json];
    (
      // Metro stations within the radius
      node["railway"="station"]["station"="subway"](around:${radiusInMeters},${lat},${lon});
      node["railway"="station"]["station"="metro"](around:${radiusInMeters},${lat},${lon});
      
      // Bus stations within the radius
      node["highway"="bus_stop"](around:${radiusInMeters},${lat},${lon});
      node["public_transport"="stop_position"]["bus"="yes"](around:${radiusInMeters},${lat},${lon});
    );
    out body;
  `

  try {
    const response = await axios.post("https://overpass-api.de/api/interpreter", overpassQuery, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    // Determine city based on location
    const city = isPointInRegion(lat, lon, regions.GUJARAT)
      ? "Gujarat"
      : isPointInRegion(lat, lon, regions.DELHI)
        ? "Delhi"
        : "Unknown"

    const stations = response.data.elements
      .filter((element: any) => element.tags && element.tags.name)
      .map((element: any) => ({
        id: element.id.toString(),
        name: element.tags.name,
        type:
          element.tags.railway === "station" || element.tags.station === "subway" || element.tags.station === "metro"
            ? "metro"
            : "bus",
        city,
        location: {
          lat: element.lat,
          lng: element.lon,
        },
        distance: haversineDistance(lat, lon, element.lat, element.lon),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)

    return stations
  } catch (error) {
    console.error("Error fetching nearest stations from OSM:", error)
    return []
  }
}

/**
 * Check if a point is within a region's bounding box
 */
function isPointInRegion(lat: number, lon: number, region: typeof regions.GUJARAT | typeof regions.DELHI): boolean {
  const [minLon, minLat, maxLon, maxLat] = region.bbox
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon
}

