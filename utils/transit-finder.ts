// Transit finder utilities
import type { Station } from "@/data/stations"
import { calculateDistance } from "./distance"
// Update the imports at the top of the file to use the new data loading utilities
import { findNearestMetroStations, findNearestBusStations } from "./load-network-data"

// Interface for location
export interface Location {
  name: string
  coordinates: {
    lat: number
    lng: number
  }
}

// Interface for transit options
export interface TransitOption extends Station {
  distance: number
}

// Interface for route step
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

// Interface for route
export interface Route {
  id: string
  duration: number
  steps: RouteStep[]
}

/**
 * Find nearest transit stations to a location
 * @param location Location coordinates
 * @param maxResults Maximum number of results
 * @returns Array of nearest transit options
 */
export async function findNearestTransitStations(
  location: { lat: number; lng: number },
  maxResults = 5,
): Promise<TransitOption[]> {
  try {
    // Find nearest metro and bus stations in parallel
    const [metroStations, busStations] = await Promise.all([
      findNearestMetroStations(location.lat, location.lng, maxResults),
      findNearestBusStations(location.lat, location.lng, maxResults),
    ])

    // Combine and sort by distance
    const allStations = [...metroStations, ...busStations]
      .sort((a, b) => a.distance! - b.distance!)
      .slice(0, maxResults)

    return allStations as TransitOption[]
  } catch (error) {
    console.error("Error finding nearest transit stations:", error)
    return []
  }
}

/**
 * Generate transit routes between two locations
 * @param from Starting location
 * @param to Destination location
 * @returns Array of possible routes
 */
export async function generateTransitRoutes(from: Location, to: Location): Promise<Route[]> {
  try {
    // Find nearest transit stations to both locations
    const [nearFromStations, nearToStations] = await Promise.all([
      findNearestTransitStations(from.coordinates, 3),
      findNearestTransitStations(to.coordinates, 3),
    ])

    if (nearFromStations.length === 0 || nearToStations.length === 0) {
      return []
    }

    const routes: Route[] = []

    // Generate routes for each combination of stations
    for (const fromStation of nearFromStations) {
      for (const toStation of nearToStations) {
        // Skip if same station
        if (fromStation.id === toStation.id) continue

        // Calculate distances and durations
        const walkToStation = {
          distance: fromStation.distance!,
          duration: Math.round(fromStation.distance! * 15), // 15 min per km walking
        }

        const transitDistance = calculateDistance(fromStation.location, toStation.location)

        // Calculate transit duration based on type
        let transitDuration = 0
        if (fromStation.type === "metro" && toStation.type === "metro") {
          transitDuration = Math.round(transitDistance * 2) // 2 min per km for metro
        } else if (fromStation.type === "bus" && toStation.type === "bus") {
          transitDuration = Math.round(transitDistance * 4) // 4 min per km for bus
        } else {
          // Mixed transit (requires transfer)
          transitDuration = Math.round(transitDistance * 3) + 10 // Additional transfer time
        }

        const walkFromStation = {
          distance: toStation.distance!,
          duration: Math.round(toStation.distance! * 15), // 15 min per km walking
        }

        // Create route steps
        const steps: RouteStep[] = [
          {
            type: "walk",
            from: from.name,
            to: fromStation.name,
            duration: walkToStation.duration,
            distance: walkToStation.distance,
            instructions: `Walk to ${fromStation.name}`,
            location: from.coordinates,
          },
        ]

        // Add transit step
        if (fromStation.type === "metro" && toStation.type === "metro") {
          steps.push({
            type: "metro",
            from: fromStation.name,
            to: toStation.name,
            duration: transitDuration,
            distance: transitDistance,
            instructions: `Take metro from ${fromStation.name} to ${toStation.name}`,
            location: fromStation.location,
          })
        } else if (fromStation.type === "bus" && toStation.type === "bus") {
          steps.push({
            type: "bus",
            from: fromStation.name,
            to: toStation.name,
            duration: transitDuration,
            distance: transitDistance,
            instructions: `Take bus from ${fromStation.name} to ${toStation.name}`,
            location: fromStation.location,
          })
        } else {
          // Mixed transit (requires transfer)
          // For simplicity, we'll just add the dominant mode of transport
          const transitType = fromStation.type === "metro" ? "metro" : "bus"
          steps.push({
            type: transitType,
            from: fromStation.name,
            to: toStation.name,
            duration: transitDuration,
            distance: transitDistance,
            instructions: `Take ${transitType} from ${fromStation.name} to ${toStation.name} (may require transfer)`,
            location: fromStation.location,
          })
        }

        // Add final walking step
        steps.push({
          type: "walk",
          from: toStation.name,
          to: to.name,
          duration: walkFromStation.duration,
          distance: walkFromStation.distance,
          instructions: `Walk from ${toStation.name} to your destination`,
          location: toStation.location,
        })

        // Calculate total duration
        const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0)

        // Create route
        routes.push({
          id: `route-${fromStation.id}-${toStation.id}`,
          duration: totalDuration,
          steps,
        })
      }
    }

    // Sort routes by duration
    return routes.sort((a, b) => a.duration - b.duration)
  } catch (error) {
    console.error("Error generating transit routes:", error)
    return []
  }
}

