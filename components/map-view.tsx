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
          geometries[stepKey] = generateSimulatedRoute(currentStep.location, nextStep.location, currentStep.type)
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
        geometries[stepKey] = generateSimulatedRoute(currentStep.location, nextStep.location, currentStep.type)
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

  // Generate a simulated route with waypoints to mimic real roads
  const generateSimulatedRoute = (
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    type: string,
  ): Array<[number, number]> => {
    const points: Array<[number, number]> = []
    points.push([start.lat, start.lng])

    // For walking and bus routes, add some waypoints to simulate roads
    if (type === "walk" || type === "bus") {
      const numPoints = type === "walk" ? 5 : 3
      const jitterFactor = type === "walk" ? 0.0005 : 0.0002

      // Create a path with slight deviations to simulate roads
      for (let i = 1; i <= numPoints; i++) {
        const ratio = i / (numPoints + 1)
        const lat = start.lat + (end.lat - start.lat) * ratio
        const lng = start.lng + (end.lng - start.lng) * ratio

        // Add some randomness to make it look like a real path
        const jitterLat = (Math.random() - 0.5) * jitterFactor
        const jitterLng = (Math.random() - 0.5) * jitterFactor

        points.push([lat + jitterLat, lng + jitterLng])
      }
    } else if (type === "metro") {
      // For metro, use the metro track data
      points.push(...getMetroTrackPoints(start, end))
    }

    points.push([end.lat, end.lng])
    return points
  }

  // Function to get metro track points
  const getMetroTrackPoints = (start: { lat: number; lng: number }, end: { lat: number; lng: number }): Array<[number, number]> => {
    // This function should return the points that represent the metro track between start and end locations.
    // For simplicity, we return a straight line here. Replace this with actual metro track data.
    return [
      [start.lat, start.lng],
      [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2],
      [end.lat, end.lng],
    ]
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
          weight: 4,
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