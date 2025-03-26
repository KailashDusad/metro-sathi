import axios from "axios"
import * as fs from "fs"
import * as path from "path"

// Define the Overpass API endpoints (multiple to handle rate limiting)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

// Define major Indian cities to chunk our requests
const MAJOR_CITIES = [
  { name: "Delhi", bbox: "28.4,77.0,28.8,77.4" },
  { name: "Rajashtan", bbox: "26.0,69.0,30.0,75.0" },
  { name: "Maharashtra", bbox: "17.0,73.0,22.0,80.0" },
  { name: "Madhya Pradesh", bbox: "21.0,74.0,26.0,82.0" },
  { name: "Uttar Pradesh", bbox: "26.0,77.0,31.0,84.0" },
  { name: "Bihar", bbox: "24.0,83.0,27.0,88.0" },
  {name: "Gujarat", bbox: "20.0,70.0,24.0,75.0"},
]

// Function to get a random Overpass API endpoint
function getOverpassEndpoint(): string {
  return OVERPASS_ENDPOINTS[Math.floor(Math.random() * OVERPASS_ENDPOINTS.length)]
}

// Function to fetch data from Overpass API with retry logic
async function fetchOSMData(query: string, retries = 3, city?: string): Promise<any> {
  console.log(`Fetching ${city ? `data for ${city}` : "data"}...`)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const endpoint = getOverpassEndpoint()
      console.log(`Using endpoint: ${endpoint} (attempt ${attempt})`)

      const response = await axios.post(endpoint, `data=${encodeURIComponent(query)}`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "TransitFinderIndia/1.0",
        },
        timeout: 60000, // 60 second timeout
      })

      console.log(`Successfully fetched ${city ? `data for ${city}` : "data"}`)
      return response.data
    } catch (error: any) {
      console.error(`Error (attempt ${attempt}/${retries}):`, error.message)

      if (attempt === retries) {
        console.error(`Failed to fetch data after ${retries} attempts`)
        throw error
      }

      // Wait before retrying (with exponential backoff)
      const waitTime = 2000 * Math.pow(2, attempt - 1)
      console.log(`Waiting ${waitTime}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }
}

// Function to save data to a file
function saveDataToFile(data: any, filename: string): void {
  // Ensure the directory exists
  const dirPath = path.join(process.cwd(), "public/data")
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const filePath = path.join(dirPath, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  console.log(`Data saved to ${filePath}`)
}

// Function to fetch metro network data by city chunks
async function fetchMetroNetworkData() {
  try {
    console.log("Fetching metro network data (chunked by city)...")
    const allCityData: any = { elements: [] }

    // Process each city separately to avoid timeout
    for (const city of MAJOR_CITIES) {
      try {
        // Fetch metro stations and lines in this city's bounding box
        const query = `
          [out:json][timeout:25];
          (
            node["railway"="station"]["station"="subway"](${city.bbox});
            node["railway"="station"]["station"="metro"](${city.bbox});
            node["railway"="station"](${city.bbox});
            way["railway"="subway"](${city.bbox});
            relation["route"="subway"](${city.bbox});
            relation["route"="metro"](${city.bbox});
          );
          out body;
          >;
          out skel qt;
        `

        const cityData = await fetchOSMData(query, 3, city.name)

        if (cityData && cityData.elements) {
          console.log(`Found ${cityData.elements.length} metro elements in ${city.name}`)

          // Annotate elements with city info for easier processing later
          cityData.elements.forEach((element: any) => {
            if (!element.tags) element.tags = {}
            element.tags.fetchedCity = city.name
          })

          // Add to our collection
          allCityData.elements = allCityData.elements.concat(cityData.elements)
        }

        // Wait a bit between cities to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        console.error(`Error fetching metro data for ${city.name}:`, error)
        // Continue with next city even if one fails
      }
    }

    console.log(`Total metro elements found: ${allCityData.elements.length}`)

    // Process the data to filter duplicates and normalize
    const processedData = processMetroNetworkData(allCityData)

    // Save both raw and processed data
    saveDataToFile(allCityData, "metroNetworkRaw.json")
    saveDataToFile(processedData, "metroNetwork.json")

    console.log("Metro data processing completed")
  } catch (error) {
    console.error("Error in metro network data fetching process:", error)
  }
}

// Function to process raw metro data into a more usable format
function processMetroNetworkData(rawData: any) {
  const stations: any[] = []
  const lines: any[] = []
  const seenStationIds = new Set()

  // First pass: extract all stations
  rawData.elements.forEach((element: any) => {
    if (
      element.type === "node" &&
      element.tags &&
      (element.tags.railway === "station" || element.tags.station === "subway" || element.tags.station === "metro")
    ) {
      // Skip if we've already processed this station
      if (seenStationIds.has(element.id)) return
      seenStationIds.add(element.id)

      // Extract and normalize station name
      const name = element.tags.name || element.tags["name:en"] || `Station ${element.id}`

      stations.push({
        id: `metro-${element.id}`,
        name: name,
        type: "metro",
        city: element.tags.fetchedCity || detectCityFromCoordinates(element.lat, element.lon),
        location: {
          lat: element.lat,
          lng: element.lon,
        },
        network: element.tags.network || "unknown",
        osmTags: element.tags,
      })
    }
  })

  // Second pass: extract metro lines
  rawData.elements.forEach((element: any) => {
    if (
      element.type === "relation" &&
      element.tags &&
      (element.tags.route === "subway" || element.tags.route === "metro")
    ) {
      const name = element.tags.name || element.tags["name:en"] || `Line ${element.id}`
      const color = element.tags.colour || element.tags.color || "#888888"

      lines.push({
        id: `line-${element.id}`,
        name: name,
        color: color,
        network: element.tags.network || "unknown",
        city: element.tags.fetchedCity || "unknown",
        osmId: element.id,
        osmTags: element.tags,
      })
    }
  })

  return {
    stations,
    lines,
    lastUpdated: new Date().toISOString(),
  }
}

// Function to fetch bus network data by city chunks
async function fetchBusNetworkData() {
  try {
    console.log("Fetching bus network data (chunked by city)...")
    const allCityData: any = { elements: [] }

    // Process each city separately to avoid timeout
    for (const city of MAJOR_CITIES) {
      try {
        // Fetch bus stops in this city's bounding box
        const query = `
          [out:json][timeout:25];
          (
            node["highway"="bus_stop"](${city.bbox});
            node["amenity"="bus_station"](${city.bbox});
            node["public_transport"="stop_position"]["bus"="yes"](${city.bbox});
          );
          out body;
          >;
          out skel qt;
        `

        const cityData = await fetchOSMData(query, 3, city.name)

        if (cityData && cityData.elements) {
          console.log(`Found ${cityData.elements.length} bus elements in ${city.name}`)

          // Annotate elements with city info
          cityData.elements.forEach((element: any) => {
            if (!element.tags) element.tags = {}
            element.tags.fetchedCity = city.name
          })

          // Add to our collection
          allCityData.elements = allCityData.elements.concat(cityData.elements)
        }

        // Wait to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        console.error(`Error fetching bus data for ${city.name}:`, error)
        // Continue with next city
      }
    }

    console.log(`Total bus elements found: ${allCityData.elements.length}`)

    // Process the data to filter duplicates and normalize
    const processedData = processBusNetworkData(allCityData)

    // Save both raw and processed data
    saveDataToFile(allCityData, "busNetworkRaw.json")
    saveDataToFile(processedData, "busNetwork.json")

    console.log("Bus data processing completed")
  } catch (error) {
    console.error("Error in bus network data fetching process:", error)
  }
}

// Function to process raw bus data into a more usable format
function processBusNetworkData(rawData: any) {
  const stations: any[] = []
  const routes: any[] = []
  const seenStationIds = new Set()

  // Extract all bus stops
  rawData.elements.forEach((element: any) => {
    if (
      element.type === "node" &&
      element.tags &&
      (element.tags.highway === "bus_stop" ||
        element.tags.amenity === "bus_station" ||
        (element.tags.public_transport === "stop_position" && element.tags.bus === "yes"))
    ) {
      // Skip if we've already processed this station
      if (seenStationIds.has(element.id)) return
      seenStationIds.add(element.id)

      // Extract and normalize station name
      const name = element.tags.name || element.tags["name:en"] || element.tags.ref || `Bus Stop ${element.id}`

      stations.push({
        id: `bus-${element.id}`,
        name: name,
        type: "bus",
        city: element.tags.fetchedCity || detectCityFromCoordinates(element.lat, element.lon),
        location: {
          lat: element.lat,
          lng: element.lon,
        },
        network: element.tags.network || element.tags.operator || "unknown",
        osmTags: element.tags,
      })
    }
  })

  return {
    stations,
    routes,
    lastUpdated: new Date().toISOString(),
  }
}

// Utility to detect city from coordinates
function detectCityFromCoordinates(lat: number, lon: number): string {
  for (const city of MAJOR_CITIES) {
    const [minLat, minLon, maxLat, maxLon] = city.bbox.split(",").map(Number)
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      return city.name
    }
  }
  return "unknown"
}

// Main function
async function main() {
  console.log("Starting data fetching process...")

  try {
    // Fetch metro network data first
    await fetchMetroNetworkData()

    // Then fetch bus network data
    await fetchBusNetworkData()

    console.log("Data fetching and processing completed successfully!")
    console.log("Files have been saved to the public/data directory.")
  } catch (error) {
    console.error("Error in main execution:", error)
    process.exit(1)
  }
}

// Execute the main function
main()

