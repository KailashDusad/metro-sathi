import type { Station } from "@/data/stations"

// Define a grid cell to hold stations
interface GridCell {
  stations: Station[]
}

// Define a spatial grid for efficient station lookup
export class SpatialGrid {
  private grid: Map<string, GridCell>
  private cellSize: number // Cell size in degrees (approximately)

  constructor(cellSize = 0.1) {
    // Default cell size of 0.1 degrees (roughly 11km)
    this.grid = new Map()
    this.cellSize = cellSize
  }

  // Add a station to the grid
  addStation(station: Station): void {
    const cellKey = this.getCellKey(station.location.lat, station.location.lng)

    if (!this.grid.has(cellKey)) {
      this.grid.set(cellKey, { stations: [] })
    }

    this.grid.get(cellKey)!.stations.push(station)
  }

  // Build the grid from an array of stations
  buildGrid(stations: Station[]): void {
    this.grid.clear()
    stations.forEach((station) => this.addStation(station))
  }

  // Get stations near a location within a certain radius
  getStationsNear(lat: number, lng: number, radiusDegrees = 0.5): Station[] {
    // Calculate the cell range to search
    const cellRadius = Math.ceil(radiusDegrees / this.cellSize)
    const centerCellX = Math.floor(lat / this.cellSize)
    const centerCellY = Math.floor(lng / this.cellSize)

    const nearbyStations: Station[] = []

    // Search in surrounding cells
    for (let i = -cellRadius; i <= cellRadius; i++) {
      for (let j = -cellRadius; j <= cellRadius; j++) {
        const cellX = centerCellX + i
        const cellY = centerCellY + j
        const cellKey = `${cellX}:${cellY}`

        if (this.grid.has(cellKey)) {
          nearbyStations.push(...this.grid.get(cellKey)!.stations)
        }
      }
    }

    return nearbyStations
  }

  // Get the cell key for a location
  private getCellKey(lat: number, lng: number): string {
    const cellX = Math.floor(lat / this.cellSize)
    const cellY = Math.floor(lng / this.cellSize)
    return `${cellX}:${cellY}`
  }
}

// Create a bounding box for quick spatial filtering
export interface BoundingBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

// Check if a location is within a bounding box
export function isWithinBoundingBox(lat: number, lng: number, bbox: BoundingBox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng
}

// Create a bounding box around a point with a radius in kilometers
export function createBoundingBox(lat: number, lng: number, radiusKm: number): BoundingBox {
  // Approximate degrees per kilometer (varies by latitude)
  const degreesPerKmLat = 1 / 110.574 // 1 degree latitude is approximately 110.574 km
  const degreesPerKmLng = 1 / (111.32 * Math.cos((lat * Math.PI) / 180)) // Varies by latitude

  const latDelta = radiusKm * degreesPerKmLat
  const lngDelta = radiusKm * degreesPerKmLng

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  }
}

// Filter stations by city for quick filtering
export function filterStationsByCity(stations: Station[], city: string): Station[] {
  return stations.filter((station) => station.city.toLowerCase() === city.toLowerCase())
}

// Get the likely city based on coordinates
export function getCityFromCoordinates(lat: number, lng: number): string | null {
  // Define bounding boxes for major Indian cities
  const cityBounds: Record<string, BoundingBox> = {
    ahmedabad: {
      minLat: 22.9,
      maxLat: 23.1,
      minLng: 72.4,
      maxLng: 72.7,
    },
    mumbai: {
      minLat: 18.9,
      maxLat: 19.2,
      minLng: 72.7,
      maxLng: 73.0,
    },
    delhi: {
      minLat: 28.4,
      maxLat: 28.8,
      minLng: 77.0,
      maxLng: 77.4,
    },
    bangalore: {
      minLat: 12.8,
      maxLat: 13.1,
      minLng: 77.4,
      maxLng: 77.8,
    },
    chennai: {
      minLat: 12.9,
      maxLat: 13.2,
      minLng: 80.1,
      maxLng: 80.4,
    },
  }

  for (const [city, bounds] of Object.entries(cityBounds)) {
    if (isWithinBoundingBox(lat, lng, bounds)) {
      return city
    }
  }

  return null
}

