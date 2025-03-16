// This file now only defines the Station interface
// All station data is fetched dynamically from OpenStreetMap

// Define the Station interface
export interface Station {
  id: string
  name: string
  type: "metro" | "bus"
  city: string
  location: {
    lat: number
    lng: number
  }
  distance?: number
  osmTags?: any
  network?: string
  metroLine?: string
}

// These empty arrays are kept for compatibility with existing code
// but will not be used for actual data
export const metroStations: Station[] = []
export const busStations: Station[] = []
export const allStations: Station[] = []

