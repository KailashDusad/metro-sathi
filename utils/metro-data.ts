// Metro line and connectivity data for major Indian cities

export interface MetroLine {
    id: string
    name: string
    color: string
    stations: string[]
  }
  
  export interface MetroNetwork {
    city: string
    lines: MetroLine[]
  }
  
  // Delhi Metro network data
  export const delhiMetroNetwork: MetroNetwork = {
    city: "delhi",
    lines: [
      {
        id: "yellow",
        name: "Yellow Line",
        color: "yellow",
        stations: [
          "samaypur-badli",
          "rohini-sector-18-19",
          "haiderpur-badli-mor",
          "jahangirpuri",
          "adarsh-nagar",
          "azadpur",
          "model-town",
          "guru-teg-bahadur-nagar",
          "vishwa-vidyalaya",
          "vidhan-sabha",
          "civil-lines",
          "kashmere-gate",
          "chandni-chowk",
          "chawri-bazar",
          "new-delhi",
          "rajiv-chowk",
          "patel-chowk",
          "central-secretariat",
          "udyog-bhawan",
          "lok-kalyan-marg",
          "jor-bagh",
          "ina",
          "aiims",
          "green-park",
          "hauz-khas",
          "malviya-nagar",
          "saket",
          "qutab-minar",
          "chhatarpur",
          "sultanpur",
          "ghitorni",
          "arjan-garh",
          "guru-dronacharya",
          "sikanderpur",
          "mg-road",
          "iffco-chowk",
          "huda-city-centre",
        ],
      },
      // Add other Delhi Metro lines as needed
    ],
  }
  
  // Function to check if two stations are directly connected
  export function areStationsConnected(
    station1: string,
    station2: string,
    network: MetroNetwork,
  ): { connected: boolean; line?: MetroLine } {
    for (const line of network.lines) {
      const station1Index = line.stations.indexOf(station1.toLowerCase())
      const station2Index = line.stations.indexOf(station2.toLowerCase())
  
      if (station1Index !== -1 && station2Index !== -1) {
        return { connected: true, line }
      }
    }
  
    return { connected: false }
  }
  
  // Function to get the number of stops between two stations
  export function getStopsBetween(station1: string, station2: string, line: MetroLine): number {
    const station1Index = line.stations.indexOf(station1.toLowerCase())
    const station2Index = line.stations.indexOf(station2.toLowerCase())
  
    if (station1Index === -1 || station2Index === -1) {
      return -1
    }
  
    return Math.abs(station2Index - station1Index)
  }
  
  // Function to normalize station name for comparison
  export function normalizeStationName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "")
  }
  
  // Function to get metro line information for a station
  export function getStationLineInfo(stationName: string, network: MetroNetwork): MetroLine | null {
    const normalizedName = normalizeStationName(stationName)
  
    for (const line of network.lines) {
      if (line.stations.includes(normalizedName)) {
        return line
      }
    }
  
    return null
  }
  
  