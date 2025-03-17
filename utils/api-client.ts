// API client for external services

import { findMetroStationsByName } from "./metro-network"

/**
 * Fetch location suggestions from OpenStreetMap Nominatim API
 * @param query Search query
 * @returns Array of location suggestions
 */
export async function fetchLocationSuggestions(query: string) {
  if (!query || query.length < 2) return []

  try {
    // Use OpenStreetMap's Nominatim API for geocoding
    // This is free and doesn't require an API key, but has usage limits
    // For production, consider using a commercial API like Google Places, Mapbox, etc.
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=in`,
      {
        headers: {
          // Add a user agent as required by Nominatim's usage policy
          "User-Agent": "TransitFinderIndia/1.0",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform the response to our format
    return data.map((item: any) => {
      // Determine location type based on OSM type and class
      let type = "poi"

      if (item.class === "railway" && (item.type === "station" || item.type === "halt")) {
        type = "metro"
      } else if (item.class === "highway" && item.type === "bus_stop") {
        type = "bus"
      } else if (item.type === "city" || item.type === "town") {
        type = "city"
      } else if (item.type === "suburb" || item.type === "neighbourhood") {
        type = "area"
      }

      return {
        name: item.display_name,
        type: type,
        coordinates: {
          lat: Number.parseFloat(item.lat),
          lng: Number.parseFloat(item.lon),
        },
        osmId: item.osm_id,
        osmType: item.osm_type,
      }
    })
  } catch (error) {
    console.error("Error fetching location suggestions:", error)
    return []
  }
}

/**
 * Cache for location suggestions to reduce API calls
 */
const suggestionsCache: Record<string, any> = {}
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

/**
 * Get combined location suggestions with caching
 * @param query Search query
 * @returns Array of location suggestions
 */
export async function getCombinedLocationSuggestions(query: string) {
  // Normalize query for caching
  const normalizedQuery = query.toLowerCase().trim()

  // Check if we have a valid cached result
  if (suggestionsCache[normalizedQuery] && suggestionsCache[normalizedQuery].timestamp > Date.now() - CACHE_EXPIRY) {
    return suggestionsCache[normalizedQuery].data
  }

  try {
    // Get metro stations from our local data
    const metroStations = await findMetroStationsByName(normalizedQuery, 3)

    // Format metro stations for suggestions
    const metroSuggestions = metroStations.map((station) => ({
      name: station.name,
      type: "metro",
      coordinates: {
        lat: station.location.lat,
        lng: station.location.lng,
      },
      network: station.network,
      city: station.city,
    }))

    // Fetch other locations from API
    const apiSuggestions = await fetchLocationSuggestions(normalizedQuery)

    // Combine results, removing duplicates
    // Metro stations from our data take precedence
    const metroStationNames = new Set(metroSuggestions.map((s) => s.name.toLowerCase()))
    const filteredApiSuggestions = apiSuggestions.filter(
      (s) => s.type !== "metro" || !metroStationNames.has(s.name.toLowerCase()),
    )

    const combinedSuggestions = [...metroSuggestions, ...filteredApiSuggestions].slice(0, 8)

    // Cache the result
    suggestionsCache[normalizedQuery] = {
      data: combinedSuggestions,
      timestamp: Date.now(),
    }

    return combinedSuggestions
  } catch (error) {
    console.error("Error getting combined location suggestions:", error)

    // If there's an error, try to return at least one of the data sources
    try {
      const metroStations = await findMetroStationsByName(normalizedQuery, 5)
      return metroStations.map((station) => ({
        name: station.name,
        type: "metro",
        coordinates: {
          lat: station.location.lat,
          lng: station.location.lng,
        },
        network: station.network,
        city: station.city,
      }))
    } catch {
      return []
    }
  }
}