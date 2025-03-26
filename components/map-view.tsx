"use client"

import { useEffect, useRef, useState } from "react"
import type { RouteStep } from "@/utils/routing"
import { fetchOsmMapData, fetchRouteGeometry } from "@/utils/osm-api"

interface MapViewProps {
  steps: RouteStep[]
  currentStepIndex: number
  currentLocation?: { lat: number; lng: number } | null
  heading?: number | null
}

export default function MapView({ steps, currentStepIndex, currentLocation, heading }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const routeLayersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapData, setMapData] = useState<any>(null)
  const [routeGeometries, setRouteGeometries] = useState<Record<string, any[]>>({})
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)
  const currentStep = steps[currentStepIndex]

  // Initialize the map
  useEffect(() => {
    if (typeof window !== "undefined" && mapRef.current && !leafletMapRef.current) {
      // Dynamically import Leaflet
      import("leaflet").then(async (L) => {
        // Import CSS
        await import("leaflet/dist/leaflet.css")

        // Fix icon paths issue in Leaflet
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
        })

        // Create map if it doesn't exist yet
        if (!leafletMapRef.current) {
          // Use the first step's coordinates as initial center
          const initialLat = steps[0]?.location?.lat || 28.6139
          const initialLng = steps[0]?.location?.lng || 77.209

          const map = L.map(mapRef.current).setView([initialLat, initialLng], 14)

          // Add OSM tile layer
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(map)

          leafletMapRef.current = map

          // Create route layers group
          routeLayersRef.current = []
          setMapLoaded(true)

          // Load initial map data
          loadMapData(currentStep.type)

          // Fetch route geometries
          fetchRouteGeometries()
        }
      })
    }

    // Cleanup
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [])

  // Load appropriate map data based on transport mode
  const loadMapData = async (transportType: string) => {
    try {
      if (!currentLocation && steps.length === 0) return

      const location = currentLocation || steps[0].location
      if (!location) return

      // Determine what data to fetch based on transport type
      let networkType = "roads"
      if (transportType === "metro") {
        networkType = "subway"
      } else if (transportType === "bus") {
        networkType = "bus"
      }

      // Fetch map data from OSM
      const data = await fetchOsmMapData(
        location.lat,
        location.lng,
        networkType,
        1000, // 1km radius
      )

      setMapData(data)
    } catch (error) {
      console.error("Error loading map data:", error)
    }
  }

  // Fetch route geometries for all steps
  const fetchRouteGeometries = async () => {
    if (steps.length < 2) return

    setIsLoadingRoutes(true)
    const geometries: Record<string, any[]> = {}

    try {
      // Fetch geometries for each step
      for (let i = 0; i < steps.length - 1; i++) {
        const currentStep = steps[i]
        const nextStep = steps[i + 1]

        if (!currentStep.location || !nextStep.location) continue

        const stepKey = `${i}-${i + 1}`
        const profile = getRoutingProfile(currentStep.type)

        // Fetch route geometry from routing service
        const routeData = await fetchRouteGeometry(
          currentStep.location.lat,
          currentStep.location.lng,
          nextStep.location.lat,
          nextStep.location.lng,
          profile,
        )

        if (routeData && routeData.length > 0) {
          geometries[stepKey] = routeData
        } else {
          // Fallback: generate simulated route if API fails
          geometries[stepKey] = generateRealisticRoute(currentStep.location, nextStep.location, currentStep.type)
        }
      }

      setRouteGeometries(geometries)
    } catch (error) {
      console.error("Error fetching route geometries:", error)

      // Generate fallback routes for all steps
      for (let i = 0; i < steps.length - 1; i++) {
        const currentStep = steps[i]
        const nextStep = steps[i + 1]

        if (!currentStep.location || !nextStep.location) continue

        const stepKey = `${i}-${i + 1}`
        geometries[stepKey] = generateRealisticRoute(currentStep.location, nextStep.location, currentStep.type)
      }

      setRouteGeometries(geometries)
    } finally {
      setIsLoadingRoutes(false)
    }
  }

  // Get routing profile based on transport type
  const getRoutingProfile = (transportType: string): string => {
    switch (transportType) {
      case "walk":
        return "foot"
      case "bus":
        return "driving"
      case "metro":
        return "rail"
      default:
        return "foot"
    }
  }

  // Generate a realistic route with waypoints that follow roads
  const generateRealisticRoute = (
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    type: string,
  ): Array<[number, number]> => {
    const points: Array<[number, number]> = []
    points.push([start.lat, start.lng])

    // Calculate the direct distance and bearing between points
    const directDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng)
    const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng)

    // Determine number of waypoints based on distance and transport type
    let numWaypoints = Math.max(5, Math.ceil(directDistance / 0.5)) // One point every 500m at minimum

    if (type === "metro") {
      // Metro lines are more direct with fewer waypoints
      numWaypoints = Math.min(numWaypoints, 8)
    } else if (type === "bus") {
      // Bus routes follow roads with more waypoints
      numWaypoints = Math.min(numWaypoints, 15)
    } else {
      // Walking routes have the most waypoints to follow sidewalks
      numWaypoints = Math.min(numWaypoints, 20)
    }

    // Create a path with realistic deviations to simulate roads
    for (let i = 1; i <= numWaypoints; i++) {
      const ratio = i / (numWaypoints + 1)

      // Calculate intermediate point along the direct path
      const intermediatePoint = intermediatePointOnGreatCircle(start.lat, start.lng, end.lat, end.lng, ratio)

      // Add some randomness to make it look like a real path
      // The randomness is perpendicular to the direct path
      let jitterAmount = 0

      if (type === "walk") {
        // Walking paths have small jitter
        jitterAmount = (Math.random() - 0.5) * 0.0008 * directDistance
      } else if (type === "bus") {
        // Bus routes follow roads with medium jitter
        jitterAmount = (Math.random() - 0.5) * 0.0005 * directDistance
      } else if (type === "metro") {
        // Metro routes have slight curves
        // Use a sine wave pattern for more realistic curves
        jitterAmount = Math.sin(ratio * Math.PI) * 0.0003 * directDistance
      }

      // Apply jitter perpendicular to the path
      const perpendicularBearing = (bearing + 90) % 360
      const jitteredPoint = destinationPoint(
        intermediatePoint[0],
        intermediatePoint[1],
        perpendicularBearing,
        jitterAmount,
      )

      points.push([jitteredPoint[0], jitteredPoint[1]])
    }

    points.push([end.lat, end.lng])
    return points
  }

  // Calculate distance between two points in km using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Calculate bearing between two points in degrees
  function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = toRad(lon2 - lon1)
    const y = Math.sin(dLon) * Math.cos(toRad(lat2))
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
    let bearing = Math.atan2(y, x)
    bearing = toDeg(bearing)
    return (bearing + 360) % 360
  }

  // Calculate an intermediate point on a great circle path
  function intermediatePointOnGreatCircle(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    fraction: number,
  ): [number, number] {
    const φ1 = toRad(lat1)
    const λ1 = toRad(lon1)
    const φ2 = toRad(lat2)
    const λ2 = toRad(lon2)

    const sinφ1 = Math.sin(φ1)
    const cosφ1 = Math.cos(φ1)
    const sinλ1 = Math.sin(λ1)
    const cosλ1 = Math.cosλ1
    const sinφ2 = Math.sin(φ2)
    const cosφ2 = Math.cos(φ2)
    const sinλ2 = Math.sin(λ2)
    const cosλ2 = Math.cosλ2

    // Distance between points
    const Δφ = φ2 - φ1
    const Δλ = λ2 - λ1
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    const A = Math.sin((1 - fraction) * δ) / Math.sin(δ)
    const B = Math.sin(fraction * δ) / Math.sin(δ)

    const x = A * cosφ1 * cosλ1 + B * cosφ2 * cosλ2
    const y = A * cosφ1 * sinλ1 + B * cosφ2 * sinλ2
    const z = A * sinφ1 + B * sinφ2

    const φ3 = Math.atan2(z, Math.sqrt(x * x + y * y))
    const λ3 = Math.atan2(y, x)

    return [toDeg(φ3), toDeg(λ3)]
  }

  // Calculate destination point given start, bearing and distance
  function destinationPoint(lat: number, lon: number, bearing: number, distance: number): [number, number] {
    const R = 6371 // Earth's radius in km
    const δ = distance / R // Angular distance
    const θ = toRad(bearing)

    const φ1 = toRad(lat)
    const λ1 = toRad(lon)

    const sinφ1 = Math.sin(φ1)
    const cosφ1 = Math.cos(φ1)
    const sinδ = Math.sin(δ)
    const cosδ = Math.cos(δ)
    const sinθ = Math.sin(θ)
    const cosθ = Math.cos(θ)

    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * cosθ
    const φ2 = Math.asin(sinφ2)
    const y = sinθ * sinδ * cosφ1
    const x = cosδ - sinφ1 * sinφ2
    const λ2 = λ1 + Math.atan2(y, x)

    return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180] // Normalize lon to -180..+180
  }

  // Convert degrees to radians
  function toRad(degrees: number): number {
    return (degrees * Math.PI) / 180
  }

  // Convert radians to degrees
  function toDeg(radians: number): number {
    return (radians * 180) / Math.PI
  }

  // Update map when current step changes
  useEffect(() => {
    if (mapLoaded && leafletMapRef.current) {
      // Load appropriate map data for the current transport mode
      loadMapData(currentStep.type)

      // Update route display
      updateRouteDisplay()
    }
  }, [currentStepIndex, mapLoaded, routeGeometries])

  // Update map when route geometries are loaded
  useEffect(() => {
    if (mapLoaded && leafletMapRef.current && Object.keys(routeGeometries).length > 0) {
      updateRouteDisplay()
    }
  }, [routeGeometries, mapLoaded])

  // Update map when current location changes
  useEffect(() => {
    if (mapLoaded && leafletMapRef.current && currentLocation) {
      import("leaflet").then((L) => {
        // Center map on current location
        leafletMapRef.current.setView([currentLocation.lat, currentLocation.lng], 16)

        // Update or create user marker
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng])

          // Update rotation based on heading if available
          if (heading !== null && heading !== undefined) {
            updateMarkerRotation(userMarkerRef.current, heading)
          }
        } else {
          // Create appropriate icon based on current transport mode
          const icon = createTransportIcon(L, currentStep.type)

          userMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon }).addTo(
            leafletMapRef.current,
          )

          if (heading !== null && heading !== undefined) {
            updateMarkerRotation(userMarkerRef.current, heading)
          }
        }
      })
    }
  }, [currentLocation, heading, mapLoaded, currentStep.type])

  // Update route display on the map
  const updateRouteDisplay = () => {
    if (!leafletMapRef.current) return

    import("leaflet").then((L) => {
      // Clear existing routes and markers
      routeLayersRef.current.forEach((layer) => {
        if (leafletMapRef.current) {
          leafletMapRef.current.removeLayer(layer)
        }
      })
      routeLayersRef.current = []

      markersRef.current.forEach((marker) => {
        if (leafletMapRef.current) {
          leafletMapRef.current.removeLayer(marker)
        }
      })
      markersRef.current = []

      // Create bounds to fit all points
      const bounds = L.latLngBounds([])

      // Add markers for each step
      steps.forEach((step, index) => {
        if (!step.location) return

        // Add point to bounds
        bounds.extend([step.location.lat, step.location.lng])

        // Create marker with step number
        const markerColor = step.type === "walk" ? "gray" : step.type === "metro" ? "blue" : "green"
        const icon = L.divIcon({
          html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-${markerColor}-100 border-2 border-${markerColor}-500 text-${markerColor}-700">
                  <span class="text-xs font-bold">${index + 1}</span>
                </div>`,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const marker = L.marker([step.location.lat, step.location.lng], { icon })
          .addTo(leafletMapRef.current)
          .bindPopup(`<b>${step.type}</b><br>${step.from} to ${step.to}`)

        markersRef.current.push(marker)
      })

      // Draw route lines using the fetched/generated geometries
      steps.forEach((step, index) => {
        if (index >= steps.length - 1) return // Skip last step

        const stepKey = `${index}-${index + 1}`
        const geometry = routeGeometries[stepKey]

        if (geometry && geometry.length > 0) {
          // Style based on transport type
          const lineStyle = getLineStyle(step.type)

          // Create route line with the geometry points
          const routeLine = L.polyline(geometry, lineStyle).addTo(leafletMapRef.current)
          routeLayersRef.current.push(routeLine)

          // Extend bounds to include all points in the route
          geometry.forEach((point) => {
            bounds.extend(point)
          })

          // For walking routes, add dots along the path
          if (step.type === "walk") {
            // Add dots at regular intervals
            for (let i = 1; i < geometry.length; i += 2) {
              const dot = L.circleMarker(geometry[i], {
                radius: 2,
                color: "#6b7280",
                fillColor: "#6b7280",
                fillOpacity: 1,
              }).addTo(leafletMapRef.current)
              routeLayersRef.current.push(dot)
            }
          }

          // For metro routes, add station markers
          if (step.type === "metro") {
            // Add station markers at regular intervals
            const stationInterval = Math.max(1, Math.floor(geometry.length / 5)) // At most 5 stations
            for (let i = 1; i < geometry.length - 1; i += stationInterval) {
              const stationMarker = L.circleMarker(geometry[i], {
                radius: 4,
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 1,
                weight: 2,
              }).addTo(leafletMapRef.current)
              routeLayersRef.current.push(stationMarker)
            }
          }

          // For bus routes, add bus stop markers
          if (step.type === "bus") {
            // Add bus stop markers at regular intervals
            const stopInterval = Math.max(1, Math.floor(geometry.length / 4)) // At most 4 stops
            for (let i = 1; i < geometry.length - 1; i += stopInterval) {
              const busStopMarker = L.circleMarker(geometry[i], {
                radius: 3,
                color: "#10b981",
                fillColor: "#10b981",
                fillOpacity: 1,
                weight: 2,
              }).addTo(leafletMapRef.current)
              routeLayersRef.current.push(busStopMarker)
            }
          }
        }
      })

      // Fit map to show all points
      if (!bounds.isEmpty()) {
        leafletMapRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
        })
      }
    })
  }

  // Get line style based on transport type
  const getLineStyle = (transportType: string) => {
    switch (transportType) {
      case "walk":
        return {
          color: "#6b7280",
          weight: 3,
          opacity: 0.7,
          dashArray: "5, 10",
        }
      case "metro":
        return {
          color: "#3b82f6",
          weight: 5,
          opacity: 0.8,
        }
      case "bus":
        return {
          color: "#10b981",
          weight: 4,
          opacity: 0.8,
        }
      default:
        return {
          color: "#6b7280",
          weight: 3,
          opacity: 0.7,
        }
    }
  }

  // Create appropriate icon based on transport mode
  const createTransportIcon = (L: any, transportType: string) => {
    let iconHtml = ""
    let iconClass = ""

    switch (transportType) {
      case "walk":
        iconHtml = `<div class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-500">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="text-gray-700">
                       <path d="M13 4v16"></path><path d="M17 4v16"></path><path d="M19 16H2"></path><path d="M22 8H5"></path>
                     </svg>
                   </div>`
        iconClass = "walking-icon"
        break
      case "bus":
        iconHtml = `<div class="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 border-2 border-green-500">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="text-green-700">
                       <path d="M19 17h2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10h2"></path><path d="M14 17H9"></path><circle cx="6.5" cy="17.5" r="2.5"></circle><circle cx="16.5" cy="17.5" r="2.5"></circle>
                     </svg>
                   </div>`
        iconClass = "bus-icon"
        break
      case "metro":
        iconHtml = `<div class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-500">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="text-blue-700">
                       <rect x="4" y="3" width="16" height="16" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v16"></path>
                     </svg>
                   </div>`
        iconClass = "metro-icon"
        break
      default:
        iconHtml = `<div class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-500">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="text-gray-700">
                       <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>
                     </svg>
                   </div>`
        iconClass = "default-icon"
    }

    return L.divIcon({
      html: iconHtml,
      className: iconClass,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    })
  }

  // Update marker rotation based on heading
  const updateMarkerRotation = (marker: any, heading: number) => {
    const markerElement = marker.getElement()
    if (markerElement) {
      const iconElement = markerElement.querySelector("div")
      if (iconElement) {
        iconElement.style.transform = `rotate(${heading}deg)`
      }
    }
  }

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-lg overflow-hidden border">
      <div ref={mapRef} className="w-full h-full" />

      {(!mapLoaded || isLoadingRoutes) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">{!mapLoaded ? "Loading map..." : "Calculating routes..."}</p>
          </div>
        </div>
      )}
    </div>
  )
}

