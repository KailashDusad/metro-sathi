// Utility to load network data files into the application

import type { Station } from "@/data/stations"

// Metro network interfaces
export interface MetroLine {
  id: string
  name: string
  color: string
  network: string
  city: string
}

export interface MetroNetwork {
  stations: Station[]
  lines: MetroLine[]
  lastUpdated: string
}

// Bus network interfaces
export interface BusRoute {
  id: string
  name: string
  network: string
  city: string
}

export interface BusNetwork {
  stations: Station[]
  routes: BusRoute[]
  lastUpdated: string
}

// Cache for loaded network data
let cachedMetroNetwork: MetroNetwork | null = null
let cachedBusNetwork: BusNetwork | null = null

/**
 * Load metro network data from JSON file
 */
export async function loadMetroNetworkData(): Promise<MetroNetwork> {
  if (cachedMetroNetwork) {
    return cachedMetroNetwork
  }

  try {
    const response = await fetch("/data/metroNetwork.json")
    if (!response.ok) {
      throw new Error(`Failed to load metro network data: ${response.status}`)
    }

    cachedMetroNetwork = await response.json()
    return cachedMetroNetwork
  } catch (error) {
    console.error("Error loading metro network data:", error)
    // Return empty data if file loading fails
    return { stations: [], lines: [], lastUpdated: new Date().toISOString() }
  }
}

/**
 * Load bus network data from JSON file
 */
export async function loadBusNetworkData(): Promise<BusNetwork> {
  if (cachedBusNetwork) {
    return cachedBusNetwork
  }

  try {
    const response = await fetch("/data/busNetwork.json")
    if (!response.ok) {
      throw new Error(`Failed to load bus network data: ${response.status}`)
    }

    cachedBusNetwork = await response.json()
    return cachedBusNetwork
  } catch (error) {
    console.error("Error loading bus network data:", error)
    // Return empty data if file loading fails
    return { stations: [], routes: [], lastUpdated: new Date().toISOString() }
  }
}

/**
 * Find nearest metro stations to a location
 */
export async function findNearestMetroStations(lat: number, lng: number, limit = 3): Promise<Station[]> {
  try {
    const networkData = await loadMetroNetworkData()

    // Calculate distance to each station
    const stationsWithDistance = networkData.stations.map((station) => {
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
 * Find nearest bus stations to a location
 */
export async function findNearestBusStations(lat: number, lng: number, limit = 3): Promise<Station[]> {
  try {
    const networkData = await loadBusNetworkData()

    // Calculate distance to each station
    const stationsWithDistance = networkData.stations.map((station) => {
      const distance = calculateDistance({ lat, lng }, { lat: station.location.lat, lng: station.location.lng })

      return {
        ...station,
        distance,
      }
    })

    // Sort by distance and return the nearest ones
    return stationsWithDistance.sort((a, b) => a.distance! - b.distance!).slice(0, limit)
  } catch (error) {
    console.error("Error finding nearest bus stations:", error)
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

