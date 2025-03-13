/**
 * Utility functions for fetching transit data from OpenStreetMap via the Overpass API
 */
import type { Station } from "@/data/stations"

// Define the Overpass API endpoints (using multiple to handle rate limiting)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

// Track API request timestamps to implement rate limiting
const apiRequestTimestamps: number[] = []
const MAX_REQUESTS_PER_MINUTE = 2
const REQUEST_WINDOW_MS = 60000

/**
 * Get a random Overpass API endpoint
 */
function getOverpassEndpoint(): string {
  return OVERPASS_ENDPOINTS[Math.floor(Math.random() * OVERPASS_ENDPOINTS.length)]
}

/**
 * Fetch nearby transit stations with improved query
 */
export async function fetchNearbyTransitStations(
  lat: number,
  lng: number,
  radius = 2000, // Increased default radius to 2km
  limit = 20,
): Promise<Station[]> {
  try {
    // Build a more specific Overpass QL query
    const query = `
      [out:json][timeout:25];
      (
        // Metro stations - using multiple tags to ensure we catch all stations
        way["railway"="station"]["station"="subway"](around:${radius},${lat},${lng});
        node["railway"="station"]["station"="subway"](around:${radius},${lat},${lng});
        way["railway"="station"]["station"="metro"](around:${radius},${lat},${lng});
        node["railway"="station"]["station"="metro"](around:${radius},${lat},${lng});
        
        // Include specific Delhi Metro stations
        node["network"="Delhi Metro"](around:${radius},${lat},${lng});
        way["network"="Delhi Metro"](around:${radius},${lat},${lng});
        
        // Bus stations and stops
        node["highway"="bus_stop"](around:${radius},${lat},${lng});
        node["amenity"="bus_station"](around:${radius},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `

    // Execute the query with retries
    let response
    let retries = 3
    while (retries > 0) {
      try {
        const endpoint = getOverpassEndpoint()
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(query)}`,
        })

        if (response.ok) break
        retries--
      } catch (error) {
        console.warn(`Retry attempt ${3 - retries} failed:`, error)
        retries--
        if (retries > 0) await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    if (!response?.ok) {
      throw new Error(`Failed to fetch from Overpass API after retries`)
    }

    const data = await response.json()

    // Process and filter the results
    const stations = processOsmData(data, lat, lng)

    // Sort by distance and limit results
    return stations.sort((a, b) => a.distance! - b.distance!).slice(0, limit)
  } catch (error) {
    console.error("Error fetching transit stations:", error)
    return []
  }
}

/**
 * Process OSM data into Station format with improved filtering
 */
function processOsmData(osmData: any, centerLat: number, centerLng: number): Station[] {
  const stations: Station[] = []
  const seenNames = new Set<string>()

  if (!osmData.elements || !Array.isArray(osmData.elements)) {
    return stations
  }

  for (const element of osmData.elements) {
    if (!element.tags) continue

    const tags = element.tags
    let lat = element.lat
    let lon = element.lon

    // Handle way elements (stations defined as areas)
    if (element.type === "way" && element.center) {
      lat = element.center.lat
      lon = element.center.lon
    }

    if (!lat || !lon) continue

    // Determine station type with improved detection
    let stationType: "metro" | "bus" = "bus"
    if (
      tags.railway === "station" ||
      tags.station === "subway" ||
      tags.station === "metro" ||
      tags.network === "Delhi Metro"
    ) {
      stationType = "metro"
    }

    // Get station name with fallbacks
    const name =
      tags.name ||
      tags["name:en"] ||
      tags.ref ||
      `${stationType.charAt(0).toUpperCase() + stationType.slice(1)} Station`

    // Skip duplicates
    if (seenNames.has(name)) continue
    seenNames.add(name)

    // Calculate distance
    const distance = haversineDistance(centerLat, centerLng, lat, lon)

    // Create station object with improved metadata
    const station: Station = {
      id: `osm-${element.id}`,
      name: name,
      type: stationType,
      city: detectCity(tags),
      location: {
        lat: lat,
        lng: lon,
      },
      distance: distance,
      osmTags: tags,
      network: tags.network || "unknown",
    }

    stations.push(station)
  }

  return stations
}

/**
 * Detect city from OSM tags
 */
function detectCity(tags: any): string {
  if (tags.network === "Delhi Metro") return "Delhi"
  if (tags["addr:city"]) return tags["addr:city"]
  if (tags.city) return tags.city
  if (tags.network && tags.network.includes("Delhi")) return "Delhi"
  return "unknown"
}

/**
 * Calculate distance between coordinates
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lat2 - lat1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Check if two stations are on the same metro line
 */
export async function areStationsOnSameLine(station1: Station, station2: Station): Promise<boolean> {
  // If both stations are Delhi Metro, they're potentially connected
  if (station1.network === "Delhi Metro" && station2.network === "Delhi Metro") {
    return true
  }

  try {
    const query = `
      [out:json][timeout:25];
      (
        rel(around:500,${station1.location.lat},${station1.location.lng})["route"="subway"];
        rel(around:500,${station2.location.lat},${station2.location.lng})["route"="subway"];
      );
      out body;
    `

    const endpoint = getOverpassEndpoint()
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!response.ok) return false

    const data = await response.json()
    return data.elements && data.elements.length > 0
  } catch (error) {
    console.error("Error checking same line:", error)
    return false
  }
}

/**
 * Fetch transit stations for both origin and destination locations
 *
 * @param originLat Origin latitude
 * @param originLng Origin longitude
 * @param destLat Destination latitude
 * @param destLng Destination longitude
 * @param radius Search radius in meters
 * @returns Promise resolving to an object containing stations near origin and destination
 */
export async function fetchTransitStationsForRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  radius = 1000,
): Promise<{ originStations: Station[]; destinationStations: Station[] }> {
  try {
    // Fetch stations near origin and destination in parallel
    const [originStations, destinationStations] = await Promise.all([
      fetchNearbyTransitStations(originLat, originLng, radius),
      fetchNearbyTransitStations(destLat, destLng, radius),
    ])

    return {
      originStations,
      destinationStations,
    }
  } catch (error) {
    console.error("Error fetching transit stations for route:", error)
    return {
      originStations: [],
      destinationStations: [],
    }
  }
}

