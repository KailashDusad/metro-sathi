interface Coordinates {
  lat: number
  lng: number
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const toRadians = (degree: number) => degree * (Math.PI / 180)
  const R = 6371 // Radius of the Earth in kilometers
  const dLat = toRadians(point2.lat - point1.lat)
  const dLon = toRadians(point2.lng - point1.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in kilometers
}

/**
 * Get coordinates for a location name using a geocoding service
 * This is a simplified version - in a real app, you'd use a proper geocoding service
 */
export async function getCoordinatesForLocation(locationName: string): Promise<Coordinates | null> {
  try {
    // Use Nominatim for geocoding (OpenStreetMap's geocoding service)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`,
    )

    if (!response.ok) {
      throw new Error(`Geocoding error: ${response.status} ${response.statusText}`)
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
    console.error("Error geocoding location:", error)
    return null
  }
}

