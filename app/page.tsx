"use client"

import { useState, useEffect } from "react"
import { Navigation, Bus, Train, AlertCircle, Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { findNearestTransitStations, generateTransitRoutes } from "@/utils/transit-finder"
import { getCoordinatesForLocation } from "@/utils/distance"
import { clearNetworkCaches } from "@/utils/load-network-data"
import NavigationMode from "@/components/navigation-mode"
import ShareRouteDialog from "@/components/share-route-dialog"
import LocationInput from "@/components/location-input"
import type { TransitOption, Route } from "@/utils/transit-finder"

interface Location {
  name: string
  coordinates?: {
    lat: number
    lng: number
  }
}

function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${(distance * 1000).toFixed(0)} meters`
  } else {
    return `${distance.toFixed(2)} km`
  }
}

interface RouteCardProps {
  route: Route
  onStartNavigation: () => void
  onShareRoute: () => void
}

function RouteCard({ route, onStartNavigation, onShareRoute }: RouteCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-muted rounded-full">
              {route.steps.some((step) => step.type === "metro") ? (
                <Train className="h-4 w-4" />
              ) : (
                <Bus className="h-4 w-4" />
              )}
            </div>
            <span className="font-medium">{route.duration} min</span>
          </div>

          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide Details" : "Show Details"}
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="font-medium">{route.steps[0].from}</div>
          <div className="h-px w-3 bg-muted-foreground/30"></div>
          <div className="font-medium">{route.steps[route.steps.length - 1].to}</div>
        </div>

        <div className="flex gap-2 mb-4">
          {route.steps.map((step, index) => (
            <div key={index} className="flex items-center">
              {step.type === "walk" && (
                <div className="bg-muted rounded-full p-1">
                  <Navigation className="h-3 w-3" />
                </div>
              )}
              {step.type === "metro" && (
                <div className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full p-1">
                  <Train className="h-3 w-3" />
                </div>
              )}
              {step.type === "bus" && (
                <div className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full p-1">
                  <Bus className="h-3 w-3" />
                </div>
              )}
              {index < route.steps.length - 1 && <div className="h-px w-3 bg-muted-foreground/30"></div>}
            </div>
          ))}
        </div>

        {expanded && (
          <div className="border-t pt-4 mt-2 space-y-4">
            {route.steps.map((step, index) => (
              <div key={index} className="flex gap-3">
                <div className="mt-1">
                  {step.type === "walk" && (
                    <div className="bg-muted rounded-full p-1.5">
                      <Navigation className="h-4 w-4" />
                    </div>
                  )}
                  {step.type === "metro" && (
                    <div className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full p-1.5">
                      <Train className="h-4 w-4" />
                    </div>
                  )}
                  {step.type === "bus" && (
                    <div className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full p-1.5">
                      <Bus className="h-4 w-4" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex justify-between">
                    <div className="font-medium">
                      {step.type === "walk" ? "Walk" : step.type === "metro" ? "Metro" : "Bus"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {step.duration} min ({formatDistance(step.distance)})
                    </div>
                  </div>

                  <div className="text-sm mt-1">
                    {step.from} to {step.to}
                  </div>

                  {step.instructions && <div className="text-sm text-muted-foreground mt-1">{step.instructions}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={onStartNavigation}>
            <Navigation className="h-4 w-4 mr-2" />
            Start Navigation
          </Button>
          <Button variant="outline" onClick={onShareRoute}>
            <Share2 className="h-4 w-4 mr-2" />
            Share Route
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TransitFinder() {
  const [fromLocation, setFromLocation] = useState<Location | null>(null)
  const [toLocation, setToLocation] = useState<Location | null>(null)
  const [fromInput, setFromInput] = useState("")
  const [toInput, setToInput] = useState("")
  const [isLocating, setIsLocating] = useState(false)
  const [routes, setRoutes] = useState<Route[]>([])
  const [nearbyStations, setNearbyStations] = useState<TransitOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchPerformance, setSearchPerformance] = useState<{
    nearestStationsTime: number
    routeGenerationTime: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [navigationRoute, setNavigationRoute] = useState<Route | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [routeToShare, setRouteToShare] = useState<Route | null>(null)
  const { toast } = useToast()

  // Ensure consistent initial state values
  useEffect(() => {
    setFromInput(fromLocation?.name || "")
    setToInput(toLocation?.name || "")
  }, [fromLocation, toLocation])

  // Get user's current location
  const getUserLocation = async () => {
    setIsLocating(true);
    setError(null);

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const location = {
          name: "Current Location",
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        };

        setFromLocation(location);
        setFromInput("Current Location");

        toast({
          title: "Location found",
          description: "Your current location has been set.",
        });
      } catch (error) {
        console.error("Error getting location:", error);

        if (error instanceof GeolocationPositionError && error.code === 1) {
          toast({
            title: "Permission denied",
            description: "Please allow location access or enter your location manually.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Location error",
            description: "Unable to get your location. Please enter it manually.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLocating(false);
      }
    } else {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation. Please enter your location manually.",
        variant: "destructive",
      });
      setIsLocating(false);
    }
  };

  // Search for routes
  const handleSearch = async () => {
    // Reset all derived states
    setFromLocation(null)
    setToLocation(null)
    setRoutes([])
    setNearbyStations([])
    setSearchPerformance(null)
    setError(null)

    if (!fromInput.trim() && !fromLocation) {
      toast({
        title: "Enter starting point",
        description: "Please enter your starting location.",
        variant: "destructive",
      })
      return
    }

    if (!toInput.trim()) {
      toast({
        title: "Enter destination",
        description: "Please enter your destination.",
        variant: "destructive",
      })
      return
    }

    // Clear previous results and reset state
    setIsSearching(true)

    // Clear all caches to ensure fresh results
    clearNetworkCaches()

    try {
      let fromCoordinates = fromLocation?.coordinates;

      if (!fromCoordinates) {
        fromCoordinates = await getCoordinatesForLocation(fromInput);
      }

      const toCoordinates = await getCoordinatesForLocation(toInput);

      if (!fromCoordinates || !fromCoordinates.lat || !fromCoordinates.lng) {
        throw new Error("Could not find coordinates for your starting location.");
      }

      if (!toCoordinates || !toCoordinates.lat || !toCoordinates.lng) {
        throw new Error("Could not find coordinates for your destination.");
      }

      // Update locations with coordinates
      const from = {
        name: fromInput,
        coordinates: fromCoordinates,
      };

      const to = {
        name: toInput,
        coordinates: toCoordinates,
      };

      setFromLocation(from);
      setToLocation(to);

      // Measure performance
      const nearestStationsStartTime = performance.now();

      // Find nearby stations to destination
      const nearbyToDestination = await findNearestTransitStations(toCoordinates, 3);
      setNearbyStations(nearbyToDestination);

      const nearestStationsEndTime = performance.now();

      // Generate routes between locations
      const routeGenStartTime = performance.now();
      const generatedRoutes = await generateTransitRoutes(from, to);
      const routeGenEndTime = performance.now();

      // Log the generated routes for debugging
      console.log(`Generated ${generatedRoutes.length} routes for "${fromInput}" to "${toInput}"`);

      // Set routes with the fresh results
      setRoutes(generatedRoutes);

      // Set performance metrics
      setSearchPerformance({
        nearestStationsTime: nearestStationsEndTime - nearestStationsStartTime,
        routeGenerationTime: routeGenEndTime - routeGenStartTime,
      });

      if (generatedRoutes.length === 0) {
        setError("No transit routes found between these locations. Try different locations or increase search radius.");
        toast({
          title: "No routes found",
          description: "Could not find any transit routes between these locations.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Routes found",
          description: `Found ${generatedRoutes.length} transit options to your destination.`,
        });
      }
    } catch (error) {
      console.error("Error searching for routes:", error)
      setError(
        error instanceof Error ? error.message : "An error occurred while searching for routes. Please try again.",
      )
      toast({
        title: "Search error",
        description: error instanceof Error ? error.message : "An error occurred while searching for routes.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Start navigation for a route
  const startNavigation = (route: Route) => {
    setNavigationRoute(route)
    toast({
      title: "Navigation started",
      description: "Follow the directions to reach your destination",
    })
  }

  // Exit navigation mode
  const exitNavigation = () => {
    setNavigationRoute(null)
  }

  // Open share dialog for a route
  const openShareDialog = (route: Route) => {
    setRouteToShare(route)
    setShareDialogOpen(true)
  }

  // If in navigation mode, show the navigation UI
  if (navigationRoute) {
    return <NavigationMode route={navigationRoute} onExit={exitNavigation} />
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Transit Finder India</h1>
        <p className="text-muted-foreground text-center mb-6">
          Find the best metro and bus routes to reach your destination
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="w-full mb-8">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <LocationInput
              id="from"
              label="From"
              placeholder="Your current location"
              value={fromInput}
              onChange={(value, coordinates) => {
                setFromInput(value);
                if (coordinates) {
                  setFromLocation({
                    name: value,
                    coordinates: coordinates,
                  });
                } else {
                  // Reset `fromLocation` if the input is manually changed
                  setFromLocation(null);
                }
              }}
              showLocationButton={true}
              isLocating={isLocating}
              onUseCurrentLocation={getUserLocation}
            />

            <LocationInput
              id="to"
              label="To"
              placeholder="Where do you want to go?"
              value={toInput}
              onChange={(value, coordinates) => {
                setToInput(value)
                if (coordinates) {
                  setToLocation({
                    name: value,
                    coordinates: coordinates,
                  })
                }
              }}
            />

            <Button onClick={handleSearch} disabled={isSearching} className="w-full">
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Find Routes"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchPerformance && (
        <div className="mb-4 text-xs text-muted-foreground">
          <p>
            Search completed in{" "}
            {(searchPerformance.nearestStationsTime + searchPerformance.routeGenerationTime).toFixed(2)}ms
          </p>
        </div>
      )}

      {isSearching && (
        <div className="flex justify-center my-8">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Searching for transit options...</p>
          </div>
        </div>
      )}

      {nearbyStations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Nearest Transit Options to Your Destination</h2>
            {/* <div className="space-y-4">
            {nearbyStations.map((station) => (
              <Card key={station.id} className="w-full">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                <div className="mt-1 p-2 bg-muted rounded-full">
                  {station.type === "metro" ? <Train className="h-5 w-5" /> : <Bus className="h-5 w-5" />}
                </div>

                <div className="flex-1">
                  <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{station.name}</h3>
                    <p className="text-sm text-muted-foreground">
                    {station.type === "metro" ? "Metro Station" : "Bus Station"}
                    </p>
                  </div>
                  <div className="text-sm font-medium">{formatDistance(station.distance)} from destination</div>
                  </div>
                </div>
                </div>
              </CardContent>
              </Card>
            ))}
            </div> */}
        </div>
      )}

      {routes.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recommended Routes</h2>
          <div className="space-y-4">
            {routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                onStartNavigation={() => startNavigation(route)}
                onShareRoute={() => openShareDialog(route)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Share Route Dialog */}
      {routeToShare && (
        <ShareRouteDialog
          route={routeToShare}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          fromLocation={fromInput}
          toLocation={toInput}
        />
      )}
    </div>
  )
}

