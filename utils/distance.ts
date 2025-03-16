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
 * In a real app, this would use a geocoding API like Google Maps, Mapbox, etc.
 * For this demo, we'll return mock coordinates for some common locations
 * @param locationName Name of the location
 * @returns Coordinates (latitude, longitude) or null if not found
 */
export function getCoordinatesForLocation(locationName: string): Coordinates | null {
  // Mock geocoding data for demonstration
  const locations: Record<string, Coordinates> = {
    // Ahmedabad locations
    "ahmedabad airport": { lat: 23.0734, lng: 72.6346 },
    "motera stadium": { lat: 23.0917, lng: 72.5972 },
    "sabarmati ashram": { lat: 23.0763, lng: 72.5929 },
    "science city": { lat: 23.0726, lng: 72.503 },
    "kankaria lake": { lat: 23.008, lng: 72.6036 },

    // Mumbai locations
    "mumbai airport": { lat: 19.0896, lng: 72.8656 },
    "gateway of india": { lat: 18.922, lng: 72.8347 },
    "marine drive": { lat: 18.9442, lng: 72.8237 },

    // Delhi locations
    "india gate": { lat: 28.6129, lng: 77.2295 },
    "red fort": { lat: 28.6562, lng: 77.241 },
    "qutub minar": { lat: 28.5245, lng: 77.1855 },

    // Gujarat locations
    "kudasan gandhinagar gujarat": { lat: 23.1865, lng: 72.6366 },
    "infocity gandhinagar": { lat: 23.2156, lng: 72.6369 },
    "gift city gandhinagar": { lat: 23.1618, lng: 72.6841 },
    "mahatma mandir gandhinagar": { lat: 23.2156, lng: 72.6536 },
    "akshardham gandhinagar": { lat: 23.2287, lng: 72.6719 },
  }

  // Try to match the location name (case insensitive)
  const normalizedName = locationName.toLowerCase()

  // Check for exact matches
  if (locations[normalizedName]) {
    return locations[normalizedName]
  }

  // Check for partial matches
  for (const [key, coords] of Object.entries(locations)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return coords
    }
  }

  // For demonstration, return a random location in Ahmedabad if no match is found
  // In a real app, you would return null or use a proper geocoding service
  return { lat: 23.0225 + Math.random() * 0.05, lng: 72.5714 + Math.random() * 0.05 }
}

/**
 * Get location suggestions based on input text
 * In a real app, this would use a geocoding API like Google Places API
 * @param input User input text
 * @returns Array of location suggestions
 */
export function getLocationSuggestions(
  input: string,
): Array<{ name: string; coordinates?: { lat: number; lng: number } }> {
  if (!input || input.length < 2) return []

  const normalizedInput = input.toLowerCase().trim()

  // Mock location database with detailed addresses
  const locationDatabase = [
    { name: "Ahmedabad Airport, Ahmedabad, Gujarat", coordinates: { lat: 23.0734, lng: 72.6346 } },
    { name: "Motera Stadium, Ahmedabad, Gujarat", coordinates: { lat: 23.0917, lng: 72.5972 } },
    { name: "Sabarmati Ashram, Ahmedabad, Gujarat", coordinates: { lat: 23.0763, lng: 72.5929 } },
    { name: "Science City, Ahmedabad, Gujarat", coordinates: { lat: 23.0726, lng: 72.503 } },
    { name: "Kankaria Lake, Ahmedabad, Gujarat", coordinates: { lat: 23.008, lng: 72.6036 } },
    { name: "Mumbai Airport (CSIA), Mumbai, Maharashtra", coordinates: { lat: 19.0896, lng: 72.8656 } },
    { name: "Gateway of India, Mumbai, Maharashtra", coordinates: { lat: 18.922, lng: 72.8347 } },
    { name: "Marine Drive, Mumbai, Maharashtra", coordinates: { lat: 18.9442, lng: 72.8237 } },
    { name: "India Gate, New Delhi, Delhi", coordinates: { lat: 28.6129, lng: 77.2295 } },
    { name: "Red Fort, Old Delhi, Delhi", coordinates: { lat: 28.6562, lng: 77.241 } },
    { name: "Qutub Minar, Mehrauli, New Delhi, Delhi", coordinates: { lat: 28.5245, lng: 77.1855 } },
    { name: "Kudasan, Gandhinagar, Gujarat", coordinates: { lat: 23.1865, lng: 72.6366 } },
    { name: "Infocity, Gandhinagar, Gujarat", coordinates: { lat: 23.2156, lng: 72.6369 } },
    { name: "GIFT City, Gandhinagar, Gujarat", coordinates: { lat: 23.1618, lng: 72.6841 } },
    { name: "Mahatma Mandir, Gandhinagar, Gujarat", coordinates: { lat: 23.2156, lng: 72.6536 } },
    { name: "Akshardham Temple, Gandhinagar, Gujarat", coordinates: { lat: 23.2287, lng: 72.6719 } },
    { name: "Swarnim Park, Gandhinagar, Gujarat", coordinates: { lat: 23.223, lng: 72.6502 } },
    { name: "Indroda Nature Park, Gandhinagar, Gujarat", coordinates: { lat: 23.2191, lng: 72.6479 } },
    { name: "Adalaj Stepwell, Gandhinagar, Gujarat", coordinates: { lat: 23.1645, lng: 72.5801 } },
    { name: "Sector 16, Gandhinagar, Gujarat", coordinates: { lat: 23.2225, lng: 72.6365 } },
    { name: "Sector 21, Gandhinagar, Gujarat", coordinates: { lat: 23.2384, lng: 72.6365 } },
  ]

  // Filter locations based on input
  return locationDatabase.filter((location) => location.name.toLowerCase().includes(normalizedInput)).slice(0, 5) // Limit to 5 suggestions
}

