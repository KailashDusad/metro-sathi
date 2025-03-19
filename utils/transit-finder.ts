// Transit finder utilities
import type { Station } from "@/data/stations"
import { calculateDistance } from "./distance"
// Update the imports at the top of the file to use the new data loading utilities
import {
  findNearestMetroStations,
  findNearestBusStations,
  loadMetroNetworkData,
  loadBusNetworkData,
} from "./load-network-data"

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

// Create a cache to store city information for stations
const stationCityCache = new Map<string, string>()

/**
 * Find nearest transit stations to a location
 * @param location Location coordinates
 * @param maxResults Maximum number of results
 * @returns Array of nearest transit options
 */
export async function findNearestTransitStations(
  location: { lat: number; lng: number },
  maxResults = 5,
  maxDistanceKm = 10, // Add a maximum distance parameter (10km by default)
): Promise<TransitOption[]> {
  try {
    // Find nearest metro and bus stations in parallel
    const [metroStations, busStations] = await Promise.all([
      findNearestMetroStations(location.lat, location.lng, maxResults * 2), // Get more results to filter
      findNearestBusStations(location.lat, location.lng, maxResults * 2),
    ])

    // Filter stations by maximum distance
    const filteredMetroStations = metroStations.filter((station) => station.distance <= maxDistanceKm)
    const filteredBusStations = busStations.filter((station) => station.distance <= maxDistanceKm)

    // Store city information in cache for connectivity checks later
    ;[...filteredMetroStations, ...filteredBusStations].forEach((station) => {
      if (station.city && station.id) {
        stationCityCache.set(station.id, station.city)
      }
    })

    // Combine and sort by distance
    const allStations = [...filteredMetroStations, ...filteredBusStations]
      .sort((a, b) => a.distance! - b.distance!)
      .slice(0, maxResults)

    return allStations as TransitOption[]
  } catch (error) {
    console.error("Error finding nearest transit stations:", error)
    return []
  }
}

/**
 * Check if two stations are in the same city
 */
// function areStationsInSameCity(station1: TransitOption, station2: TransitOption): boolean {
//   // Get city from station or from cache
//   const city1 = station1.city || stationCityCache.get(station1.id) || ""
//   const city2 = station2.city || stationCityCache.get(station2.id) || ""

//   // If either city is unknown, be conservative and return false
//   if (!city1 || !city2 || city1 === "unknown" || city2 === "unknown") {
//     return false
//   }

//   // Compare cities (case insensitive)
//   return city1.toLowerCase() === city2.toLowerCase()
// }

/**
 * Check if two metro stations are on the same network
 */
async function areMetroStationsConnected(station1: TransitOption, station2: TransitOption): Promise<boolean> {
  // First check if they're in the same city
  // if (!areStationsInSameCity(station1, station2)) {
  //   return false
  // }

  try {
    // Load metro network data
    const metroNetwork = await loadMetroNetworkData()

    // Get the networks for both stations
    const network1 = station1.network || "unknown"
    const network2 = station2.network || "unknown"

    // If they're on the same named network, they're likely connected
    if (network1 !== "unknown" && network2 !== "unknown" && network1 === network2) {
      return true
    }

    // Check if they're on the same metro line
    for (const line of metroNetwork.lines) {
      // This is a simplified check - in a real app, you'd have a more sophisticated
      // way to check if stations are on the same line
      if (line.city.toLowerCase() === station1.city?.toLowerCase()) {
        // For now, if they're in the same city and both are metro stations,
        // we'll assume they might be connected
        return true
      }
    }

    return false
  } catch (error) {
    console.error("Error checking metro station connectivity:", error)
    return false
  }
}

/**
 * Check if two bus stations are on the same network
 */
async function areBusStationsConnected(station1: TransitOption, station2: TransitOption): Promise<boolean> {
  // First check if they're in the same city
  // if (!areStationsInSameCity(station1, station2)) {
  //   return false
  // }

  try {
    // Load bus network data
    const busNetwork = await loadBusNetworkData()

    // Get the networks for both stations
    const network1 = station1.network || "unknown"
    const network2 = station2.network || "unknown"

    // If they're on the same named network, they're likely connected
    if (network1 !== "unknown" && network2 !== "unknown" && network1 === network2) {
      return true
    }

    // For now, if they're in the same city, we'll assume they might be connected
    // In a real app, you'd check actual bus routes
    return true
  } catch (error) {
    console.error("Error checking bus station connectivity:", error)
    return false
  }
}

/**
 * Check if two transit stations are connected
 */
async function areTransitStationsConnected(station1: TransitOption, station2: TransitOption): Promise<boolean> {
  // First check if they're in the same city
  const city1 = station1.city || "unknown"
  const city2 = station2.city || "unknown"

  // If either city is unknown, check the distance between them
  if (city1 === "unknown" || city2 === "unknown") {
    // Calculate the distance between stations
    const distance = calculateDistance(station1.location, station2.location)

    // Only consider them potentially connected if they're within 30km
    if (distance > 30) {
      console.log(`Stations too far apart: ${station1.name} and ${station2.name} (${distance.toFixed(2)}km)`)
      return false
    }
  }
  // If both cities are known and different, they're definitely not connected
  else if (city1.toLowerCase() !== city2.toLowerCase()) {
    console.log(`Stations in different cities: ${station1.name} (${city1}) and ${station2.name} (${city2})`)
    return false
  }

  // If they're the same type of station
  if (station1.type === station2.type) {
    if (station1.type === "metro") {
      return await areMetroStationsConnected(station1, station2)
    } else if (station1.type === "bus") {
      return await areBusStationsConnected(station1, station2)
    }
  }

  // Different types of stations are not directly connected
  return false
}

// Update the generateTransitRoutes function to include connectivity checks
export async function generateTransitRoutes(from: Location, to: Location): Promise<Route[]> {
  try {
    console.log(`Generating routes from ${from.name} to ${to.name}`)

    // Calculate direct distance between origin and destination
    const directDistance = calculateDistance(from.coordinates, to.coordinates)

    // Set reasonable search radius based on direct distance
    const searchRadius = Math.min(Math.max(directDistance * 1.5, 10), 30) // Between 10km and 30km

    console.log(`Direct distance: ${directDistance.toFixed(2)}km, Search radius: ${searchRadius.toFixed(2)}km`)

    // Find nearest transit stations to both locations with the calculated radius
    // Use completely fresh calls each time to avoid any caching issues
    const nearFromStations = await findNearestTransitStations(from.coordinates, 5, searchRadius)
    const nearToStations = await findNearestTransitStations(to.coordinates, 5, searchRadius)

    console.log(
      `Found ${nearFromStations.length} stations near origin and ${nearToStations.length} stations near destination`,
    )

    // Log the stations for debugging
    nearFromStations.forEach((s) =>
      console.log(`Origin station: ${s.name}, type: ${s.type}, city: ${s.city}, distance: ${s.distance}km`),
    )
    nearToStations.forEach((s) =>
      console.log(`Destination station: ${s.name}, type: ${s.type}, city: ${s.city}, distance: ${s.distance}km`),
    )

    if (nearFromStations.length === 0 || nearToStations.length === 0) {
      console.log("No stations found within search radius")
      return []
    }

    const routes: Route[] = []
    const maxReasonableDistance = directDistance * 3 // Maximum reasonable transit distance

    // Generate routes for each combination of stations
    for (const fromStation of nearFromStations) {
      for (const toStation of nearToStations) {
        // Skip if same station
        if (fromStation.id === toStation.id) continue

        // Calculate the distance between stations
        const transitDistance = calculateDistance(fromStation.location, toStation.location)

        // Skip if transit distance is unreasonably large compared to direct distance
        if (transitDistance > maxReasonableDistance) {
          console.log(
            `Skipping unreasonable route: ${fromStation.name} to ${toStation.name} (${transitDistance.toFixed(2)}km)`,
          )
          continue
        }

        // Skip if stations are not connected
        const connected = await areTransitStationsConnected(fromStation, toStation)
        if (!connected) {
          console.log(`Skipping route: ${fromStation.name} to ${toStation.name} - not connected`)
          continue
        }

        // Calculate distances and durations
        const walkToStation = {
          distance: fromStation.distance!,
          duration: Math.round(fromStation.distance! * 15), // 15 min per km walking
        }

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

        // Create route with a unique ID that includes a timestamp and random component
        routes.push({
          id: `route-${Date.now()}-${Math.random().toString(36).substring(2)}`,
          duration: totalDuration,
          steps,
        })
      }
    }

    console.log(`Generated ${routes.length} valid routes`)

    // Sort routes by duration
    return routes.sort((a, b) => a.duration - b.duration)
  } catch (error) {
    console.error("Error generating transit routes:", error)
    return []
  }
}

