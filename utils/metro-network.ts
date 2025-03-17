// Metro network data processing utilities
import type { Station } from "@/data/stations"

// Interface for metro network data
interface MetroNetworkData {
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

// Cache for processed metro stations
let processedMetroStations: Station[] = []

/**
 * Process OSM metro network data into Station format
 * @param data Raw OSM data
 * @returns Array of processed metro stations
 */
export function processMetroNetworkData(data: MetroNetworkData): Station[] {
  if (processedMetroStations.length > 0) {
    return processedMetroStations
  }

  const stations: Station[] = []

  // Process only node elements with railway=station tag
  const metroStations = data.elements.filter(
    (element) =>
      element.type === "node" &&
      element.tags &&
      (element.tags.railway === "station" || element.tags.public_transport === "station"),
  )

  for (const station of metroStations) {
    if (!station.lat || !station.lon || !station.tags?.name) continue

    // Create station object
    const stationObj: Station = {
      id: `osm-${station.id}`,
      name: station.tags.name,
      type: "metro",
      city: detectCityFromNetwork(station.tags?.network || ""),
      location: {
        lat: station.lat,
        lng: station.lon,
      },
      osmTags: station.tags,
      network: station.tags.network || "unknown",
    }

    stations.push(stationObj)
  }

  processedMetroStations = stations
  return stations
}

/**
 * Detect city from network name
 */
function detectCityFromNetwork(network: string): string {
  const networkLower = network.toLowerCase()

  if (networkLower.includes("mumbai")) return "Mumbai"
  if (networkLower.includes("delhi")) return "Delhi"
  if (networkLower.includes("kolkata")) return "Kolkata"
  if (networkLower.includes("chennai")) return "Chennai"
  if (networkLower.includes("bangalore") || networkLower.includes("bengaluru")) return "Bangalore"
  if (networkLower.includes("hyderabad")) return "Hyderabad"
  if (networkLower.includes("ahmedabad")) return "Ahmedabad"
  if (networkLower.includes("pune")) return "Pune"
  if (networkLower.includes("lucknow")) return "Lucknow"
  if (networkLower.includes("jaipur")) return "Jaipur"
  if (networkLower.includes("kochi")) return "Kochi"
  if (networkLower.includes("nagpur")) return "Nagpur"

  return "unknown"
}

/**
 * Load metro network data from JSON file
 * @returns Promise with metro stations
 */
export async function loadMetroNetworkData(): Promise<Station[]> {
  try {
    // If we already have processed data, return it
    if (processedMetroStations.length > 0) {
      return processedMetroStations
    }

    // Load the data from the JSON file
    const response = await fetch("data/metroNetworkData.json")
    if (!response.ok) {
      throw new Error(`Failed to load metro network data: ${response.status}`)
    }

    const data = await response.json()
    return processMetroNetworkData(data)
  } catch (error) {
    console.error("Error loading metro network data:", error)
    return []
  }
}

/**
 * Find nearest metro stations to a location
 * @param lat Latitude
 * @param lng Longitude
 * @param limit Maximum number of stations to return
 * @returns Array of nearest stations with distances
 */
export async function findNearestMetroStations(lat: number, lng: number, limit = 3): Promise<Station[]> {
  try {
    // Load all metro stations
    const allStations = await loadMetroNetworkData()

    // Calculate distance to each station
    const stationsWithDistance = allStations.map((station) => {
      const distance = calculateDistance({ lat, lng }, { lat: station.location.lat, lng: station.location.lng })

      return {
        ...station,
        distance,
      }
    })

    // Sort by distance and return the nearest ones
    return stationsWithDistance.sort((a, b) => a.distance! - b.distance!).slice(0, limit)
  } catch (error) {
    console.error("Error finding nearest metro stations:", error)
    return []
  }
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
 * Find metro stations by name
 * @param name Station name (or part of it)
 * @param limit Maximum number of stations to return
 * @returns Array of stations matching the name
 */
export async function findMetroStationsByName(name: string, limit = 5): Promise<Station[]> {
  try {
    // Load all metro stations
    const allStations = await loadMetroNetworkData()

    // Filter stations by name (case-insensitive)
    const matchingStations = allStations.filter((station) => station.name.toLowerCase().includes(name.toLowerCase()))

    return matchingStations.slice(0, limit)
  } catch (error) {
    console.error("Error finding metro stations by name:", error)
    return []
  }
}

