// Utility functions for calculating distances between coordinates

interface Coordinates {
  lat: number
  lng: number
}

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param coord1 First coordinate (latitude, longitude)
 * @param coord2 Second coordinate (latitude, longitude)
 * @returns Distance in kilometers
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
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
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Get the approximate coordinates for a location name using a geocoding service
 * @param locationName Name of the location
 * @returns Coordinates (latitude, longitude) or null if not found
 */
export async function getCoordinatesForLocation(locationName: string): Promise<Coordinates | null> {
  try {
    // Use the Nominatim API to get coordinates
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1&countrycodes=in`,
      {
        headers: {
          "User-Agent": "TransitFinderIndia/1.0",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    if (data && data.length > 0) {
      return {
        lat: Number.parseFloat(data[0].lat),
        lng: Number.parseFloat(data[0].lon),
      }
    }

    return null
  } catch (error) {
    console.error("Error getting coordinates for location:", error)
    return null
  }
}

