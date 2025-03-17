// Bus network data processing utilities
import type { Station } from "@/data/stations"

// Interface for bus network data
interface BusNetworkData {
  elements: Array<{
    type: string
    id: number
    lat?: number
    lon?: number
    nodes?: number[]
    tags?: {
      [key: string]: string
    }
  }>
}

// Cache for bus stations to avoid repeated API calls
const busStationsCache: Record<string, Station[]> = {}

/**
 * Fetch bus stations from OpenStreetMap API
 * @param lat Center latitude
 * @param lng Center longitude
 * @param radius Search radius in meters
 * @returns Array of bus stations
 */
export async function fetchBusStations(
  lat: number,
  lng: number,
  radius = 2000, // 2km radius
): Promise<Station[]> {
  try {
    // Create a cache key based on coordinates and radius
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`

    // Check if we have cached results
    if (busStationsCache[cacheKey]) {
      return busStationsCache[cacheKey]
    }

    // Overpass API query to find bus stops
    const query = `
      [out:json][timeout:25];
      (
        node["highway"="bus_stop"](around:${radius},${lat},${lng});
        node["amenity"="bus_station"](around:${radius},${lat},${lng});
        node["public_transport"="stop_position"]["bus"="yes"](around:${radius},${lat},${lng});
      );
      out body;
    `

    // Use a random Overpass API endpoint to distribute load
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]

    // Fetch data from Overpass API
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "TransitFinderIndia/1.0",
      },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch bus stations: ${response.status}`)
    }

    const data = await response.json()

    // Process the data
    const busStations = processBusNetworkData(data, lat, lng)

    // Cache the results
    busStationsCache[cacheKey] = busStations

    return busStations
  } catch (error) {
    console.error("Error fetching bus stations:", error)
    return []
  }
}

/**
 * Process OSM bus network data into Station format
 * @param data Raw OSM data
 * @param centerLat Center latitude for distance calculation
 * @param centerLng Center longitude for distance calculation
 * @returns Array of processed bus stations
 */
function processBusNetworkData(data: BusNetworkData, centerLat: number, centerLng: number): Station[] {
  const stations: Station[] = []

  // Process only node elements with bus stop tags
  const busStops = data.elements.filter(
    (element) =>
      element.type === "node" &&
      element.tags &&
      (element.tags.highway === "bus_stop" ||
        element.tags.amenity === "bus_station" ||
        (element.tags.public_transport === "stop_position" && element.tags.bus === "yes")),
  )

  for (const stop of busStops) {
    if (!stop.lat || !stop.lon) continue

    // Use name or generate a default name
    const name = stop.tags?.name || stop.tags?.["name:en"] || stop.tags?.ref || `Bus Stop ${stop.id}`

    // Calculate distance from center point
    const distance = calculateDistance({ lat: centerLat, lng: centerLng }, { lat: stop.lat, lng: stop.lon })

    // Create station object
    const stationObj: Station = {
      id: `osm-bus-${stop.id}`,
      name: name,
      type: "bus",
      city: detectCityFromCoordinates(stop.lat, stop.lon),
      location: {
        lat: stop.lat,
        lng: stop.lon,
      },
      distance: distance,
      osmTags: stop.tags,
      network: stop.tags?.network || stop.tags?.operator || "unknown",
    }

    stations.push(stationObj)
  }

  // Sort by distance
  return stations.sort((a, b) => a.distance! - b.distance!)
}

/**
 * Detect city from coordinates (approximate)
 */
function detectCityFromCoordinates(lat: number, lon: number): string {
  // Define bounding boxes for major Indian cities
  const cityBounds: Record<string, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
    Mumbai: { minLat: 18.8, maxLat: 19.3, minLon: 72.7, maxLon: 73.0 },
    Delhi: { minLat: 28.4, maxLat: 28.8, minLon: 76.8, maxLon: 77.4 },
    Bangalore: { minLat: 12.8, maxLat: 13.1, minLon: 77.4, maxLon: 77.8 },
    Hyderabad: { minLat: 17.3, maxLat: 17.6, minLon: 78.3, maxLon: 78.6 },
    Chennai: { minLat: 12.9, maxLat: 13.2, minLon: 80.1, maxLon: 80.3 },
    Kolkata: { minLat: 22.5, maxLat: 22.7, minLon: 88.2, maxLon: 88.5 },
    Ahmedabad: { minLat: 22.9, maxLat: 23.1, minLon: 72.4, maxLon: 72.7 },
    Pune: { minLat: 18.4, maxLat: 18.7, minLon: 73.7, maxLon: 74.0 },
  }

  for (const [city, bounds] of Object.entries(cityBounds)) {
    if (lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon) {
      return city
    }
  }

  return "unknown"
}

/**
 * Calculate distance between two coordinates using the Haversine formula
 */
function calculateDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat)
  const dLng = toRadians(coord2.lng - coord1.lng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c // Distance in kilometers

  return Number.parseFloat(distance.toFixed(2)) // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Find nearest bus stations to a location
 * @param lat Latitude
 * @param lng Longitude
 * @param limit Maximum number of stations to return
 * @returns Array of nearest stations with distances
 */
export async function findNearestBusStations(lat: number, lng: number, limit = 3): Promise<Station[]> {
  try {
    // Fetch bus stations around the location
    const busStations = await fetchBusStations(lat, lng)

    // Return the nearest ones (they're already sorted by distance)
    return busStations.slice(0, limit)
  } catch (error) {
    console.error("Error finding nearest bus stations:", error)
    return []
  }
}

