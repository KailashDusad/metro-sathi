import type { Station } from "@/data/stations"
import { calculateDistance } from "./distance"
import {
  fetchNearbyTransitStations,
  fetchTransitStationsForRoute,
  areStationsOnSameLine,
  haversineDistance,
} from "./osm-api"

interface Coordinates {
  lat: number
  lng: number
}

interface Location {
  name: string
  coordinates: Coordinates
}

export interface TransitOption extends Station {
  distance: number
}

export interface RouteStep {
  type: "walk" | "metro" | "bus"
  from: string
  to: string
  duration: number
  distance: number
  instructions?: string
  location?: {
    lat: number
    lng: number
  }
}

export interface Route {
  id: string
  duration: number
  steps: RouteStep[]
}

// Cache for stations to avoid repeated API calls
const stationCache: Record<string, TransitOption[]> = {}

/**
 * Find the nearest stations to a given location
 * @param location Coordinates of the location
 * @param maxResults Maximum number of results to return
 * @param maxDistance Maximum distance in kilometers (optional)
 * @returns Array of stations with distances
 */
export async function findNearestStations(
  location: Coordinates,
  maxResults = 3,
  maxDistance = 5,
): Promise<TransitOption[]> {
  console.time("findNearestStations")

  // Create a cache key based on coordinates and radius
  const cacheKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)},${maxDistance}`

  // Check if we have cached results
  if (stationCache[cacheKey]) {
    console.timeEnd("findNearestStations")
    return stationCache[cacheKey].slice(0, maxResults)
  }

  try {
    // Convert maxDistance from km to meters for the API call
    const radiusMeters = maxDistance * 1000

    // Fetch stations from OpenStreetMap
    const stations = await fetchNearbyTransitStations(
      location.lat,
      location.lng,
      radiusMeters,
      maxResults * 2, // Fetch more than needed to ensure we have enough after filtering
    )

    // Calculate distances for each station
    const stationsWithDistance = stations.map((station) => ({
      ...station,
      distance: station.distance || calculateDistance(location, station.location),
    }))

    // Filter by maximum distance if specified
    const filteredStations = maxDistance
      ? stationsWithDistance.filter((station) => station.distance <= maxDistance)
      : stationsWithDistance

    // Sort by distance and take the specified number of results
    const result = filteredStations.sort((a, b) => a.distance - b.distance).slice(0, maxResults)

    // Cache the results
    stationCache[cacheKey] = result

    console.timeEnd("findNearestStations")
    return result
  } catch (error) {
    console.error("Error finding nearest stations:", error)
    console.timeEnd("findNearestStations")
    return []
  }
}

async function checkSameLine(startStation: TransitOption, endStation: TransitOption): Promise<boolean> {
  let onSameLine = false
  if (startStation.type === "metro" && endStation.type === "metro") {
    try {
      // Only check if they're in the same city/region
      if (startStation.city === endStation.city || startStation.city === "unknown" || endStation.city === "unknown") {
        onSameLine = await areStationsOnSameLine(startStation.id, endStation.id)
      }
    } catch (error) {
      console.error("Error checking if stations are on same line:", error)
    }
  }
  return onSameLine
}

export async function generateRoutes(fromLocation: Location, toLocation: Location): Promise<Route[]> {
  console.time("generateRoutes")

  try {
    // First, try to find stations with a larger radius
    const { originStations, destinationStations } = await fetchTransitStationsForRoute(
      fromLocation.coordinates.lat,
      fromLocation.coordinates.lng,
      toLocation.coordinates.lat,
      toLocation.coordinates.lng,
      2000, // Increased to 2km radius
    )

    if (!originStations.length || !destinationStations.length) {
      console.timeEnd("generateRoutes")
      return []
    }

    // Filter and sort stations
    const nearestToStart = originStations
      .filter((station) => station.type === "metro") // Prefer metro stations
      .sort((a, b) => a.distance! - b.distance!)
      .slice(0, 3)

    const nearestToEnd = destinationStations
      .filter((station) => station.type === "metro")
      .sort((a, b) => a.distance! - b.distance!)
      .slice(0, 3)

    // If no metro stations found, include bus stations
    if (nearestToStart.length === 0) {
      nearestToStart.push(
        ...originStations
          .filter((station) => station.type === "bus")
          .sort((a, b) => a.distance! - b.distance!)
          .slice(0, 2),
      )
    }

    if (nearestToEnd.length === 0) {
      nearestToEnd.push(
        ...destinationStations
          .filter((station) => station.type === "bus")
          .sort((a, b) => a.distance! - b.distance!)
          .slice(0, 2),
      )
    }

    const routes: Route[] = []

    // Generate routes
    for (const startStation of nearestToStart) {
      for (const endStation of nearestToEnd) {
        if (startStation.id === endStation.id) continue

        // Check if stations are on the same line (for metro stations)
        const sameLine = await checkSameLine(startStation, endStation)

        // Calculate distances and durations
        const walkToStation = {
          distance: startStation.distance!,
          duration: Math.round(startStation.distance! * 15),
        }

        const transitSegment = {
          distance: haversineDistance(
            startStation.location.lat,
            startStation.location.lng,
            endStation.location.lat,
            endStation.location.lng,
          ),
          duration: 0, // Will be calculated based on type
        }

        // Calculate transit duration based on type and whether same line
        if (startStation.type === "metro" && endStation.type === "metro") {
          transitSegment.duration = sameLine
            ? Math.round(transitSegment.distance * 1.5) // Faster for same line
            : Math.round(transitSegment.distance * 2)
        } else {
          transitSegment.duration = Math.round(transitSegment.distance * 3)
        }

        const walkFromStation = {
          distance: endStation.distance!,
          duration: Math.round(endStation.distance! * 15),
        }

        // Create route steps with location data for map display
        const steps: RouteStep[] = [
          {
            type: "walk",
            from: fromLocation.name,
            to: startStation.name,
            duration: walkToStation.duration,
            distance: walkToStation.distance,
            instructions: `Walk to ${startStation.name}`,
            location: fromLocation.coordinates,
          },
        ]

        // Add transit step(s)
        if (startStation.type === "metro" && endStation.type === "metro") {
          steps.push({
            type: "metro",
            from: startStation.name,
            to: endStation.name,
            duration: transitSegment.duration,
            distance: transitSegment.distance,
            instructions: sameLine
              ? `Take metro directly from ${startStation.name} to ${endStation.name}`
              : `Take metro from ${startStation.name} to ${endStation.name} (may require transfer)`,
            location: startStation.location,
          })
        } else {
          // Handle bus or mixed transit
          steps.push({
            type: startStation.type,
            from: startStation.name,
            to: endStation.name,
            duration: transitSegment.duration,
            distance: transitSegment.distance,
            instructions: `Take ${startStation.type} from ${startStation.name} to ${endStation.name}`,
            location: startStation.location,
          })
        }

        // Add final walking step
        steps.push({
          type: "walk",
          from: endStation.name,
          to: toLocation.name,
          duration: walkFromStation.duration,
          distance: walkFromStation.distance,
          instructions: `Walk from ${endStation.name} to your destination`,
          location: endStation.location,
        })

        // Calculate total duration and add route
        const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0)
        routes.push({
          id: `route-${startStation.id}-${endStation.id}`,
          duration: totalDuration,
          steps,
        })
      }
    }

    // Sort routes by duration
    const result = routes.sort((a, b) => a.duration - b.duration)
    console.timeEnd("generateRoutes")
    return result
  } catch (error) {
    console.error("Error generating routes:", error)
    console.timeEnd("generateRoutes")
    return []
  }
}

