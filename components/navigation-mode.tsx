"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Navigation, MapPin, Bus, Train, Volume2, VolumeX, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { calculateDistance } from "@/utils/distance"
import type { RouteStep } from "@/utils/routing"
import MapView from "@/components/map-view"

interface NavigationModeProps {
  route: {
    steps: RouteStep[]
    duration: number
  }
  onExit: () => void
}

export default function NavigationMode({ route, onExit }: NavigationModeProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [distanceToNextPoint, setDistanceToNextPoint] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isTracking, setIsTracking] = useState(true)
  const [heading, setHeading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const { toast } = useToast()
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)

  const currentStep = route.steps[currentStepIndex]
  const nextStep = currentStepIndex < route.steps.length - 1 ? route.steps[currentStepIndex + 1] : null

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesisRef.current = new SpeechSynthesisUtterance()
      speechSynthesisRef.current.lang = "en-US"
      speechSynthesisRef.current.rate = 1
      speechSynthesisRef.current.pitch = 1
    }

    return () => {
      if (window.speechSynthesis && speechSynthesisRef.current) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Start location tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser")
      return
    }

    // Start tracking location
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setCurrentLocation(newLocation)

        // Update heading if available
        if (position.coords.heading) {
          setHeading(position.coords.heading)
        }

        // Calculate distance to next waypoint
        if (currentStep) {
          // For simplicity, we're using the destination of the current step
          // In a real app, you'd have waypoints for each step
          const targetLocation = getStepTargetLocation(currentStep)
          if (targetLocation) {
            const distance = calculateDistance(newLocation, targetLocation)
            setDistanceToNextPoint(distance)

            // Check if we've reached the waypoint (within 50 meters)
            if (distance < 0.05) {
              handleStepCompleted()
            }

            // Update progress based on distance
            const totalStepDistance = currentStep.distance
            const remainingDistance = distance
            const stepProgress = Math.min(
              100,
              Math.max(0, ((totalStepDistance - remainingDistance) / totalStepDistance) * 100),
            )
            setProgress(stepProgress)
          }
        }
      },
      (err) => {
        console.error("Error getting location:", err)
        setError(`Location error: ${err.message}`)
        setIsTracking(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      },
    )

    // Announce the first step
    if (!isMuted) {
      announceStep(currentStep)
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [currentStep])

  // Get target location for a step
  const getStepTargetLocation = (step: RouteStep) => {
    // Use the step's location if available
    if (step.location) {
      return step.location
    }

    // Otherwise, try to find the next step with a location
    const nextStepIndex = route.steps.findIndex((s, i) => i > currentStepIndex && s.location)
    if (nextStepIndex !== -1) {
      return route.steps[nextStepIndex].location
    }

    return null
  }

  // Handle step completion
  const handleStepCompleted = () => {
    if (currentStepIndex < route.steps.length - 1) {
      // Move to next step
      setCurrentStepIndex(currentStepIndex + 1)
      setProgress(0)

      // Announce the next step
      if (!isMuted) {
        announceStep(route.steps[currentStepIndex + 1])
      }

      toast({
        title: "Next step",
        description: `Now ${route.steps[currentStepIndex + 1].type} to ${route.steps[currentStepIndex + 1].to}`,
      })
    } else {
      // Route completed
      if (!isMuted) {
        speak("You have reached your destination!")
      }

      toast({
        title: "Destination reached",
        description: "You have arrived at your destination!",
      })

      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }

      setIsTracking(false)
    }
  }

  // Manually move to next step (for demo purposes)
  const moveToNextStep = () => {
    if (currentStepIndex < route.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
      setProgress(0)

      if (!isMuted) {
        announceStep(route.steps[currentStepIndex + 1])
      }
    }
  }

  // Announce step using speech synthesis
  const announceStep = (step: RouteStep) => {
    const announcement = step.instructions || `${step.type} from ${step.from} to ${step.to}`
    speak(announcement)
  }

  // Text-to-speech function
  const speak = (text: string) => {
    if (window.speechSynthesis && speechSynthesisRef.current && !isMuted) {
      window.speechSynthesis.cancel() // Cancel any ongoing speech
      speechSynthesisRef.current.text = text
      window.speechSynthesis.speak(speechSynthesisRef.current)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (window.speechSynthesis) {
      if (!isMuted) {
        window.speechSynthesis.cancel()
      }
    }
    setIsMuted(!isMuted)
  }

  // Get step icon
  const getStepIcon = (type: string) => {
    switch (type) {
      case "walk":
        return <Navigation className="h-5 w-5" />
      case "metro":
        return <Train className="h-5 w-5" />
      case "bus":
        return <Bus className="h-5 w-5" />
      default:
        return <MapPin className="h-5 w-5" />
    }
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onExit}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Navigation</h2>
        <Button variant="ghost" size="icon" onClick={toggleMute}>
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col md:flex-row gap-4">
        {/* Map section */}
        <div className="w-full md:w-1/2 h-[300px] md:h-auto">
          <MapView
            steps={route.steps}
            currentStepIndex={currentStepIndex}
            currentLocation={currentLocation}
            heading={heading}
          />
        </div>

        {/* Navigation instructions */}
        <div className="w-full md:w-1/2 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Current Step</h3>
              <span className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {route.steps.length}
              </span>
            </div>

            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 p-2 rounded-full ${getStepBackgroundColor(currentStep.type)}`}>
                    {getStepIcon(currentStep.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div className="font-medium capitalize">{currentStep.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {currentStep.duration} min ({formatDistance(currentStep.distance)})
                      </div>
                    </div>
                    <div className="text-sm mt-1">
                      {currentStep.from} to {currentStep.to}
                    </div>
                    {currentStep.instructions && (
                      <div className="text-sm text-muted-foreground mt-1">{currentStep.instructions}</div>
                    )}

                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {distanceToNextPoint !== null && (
                      <div className="mt-2 text-sm font-medium">{formatDistance(distanceToNextPoint)} remaining</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {nextStep && (
            <div>
              <h3 className="font-medium mb-2">Next Step</h3>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-full ${getStepBackgroundColor(nextStep.type)}`}>
                      {getStepIcon(nextStep.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-medium capitalize">{nextStep.type}</div>
                        <div className="text-sm text-muted-foreground">
                          {nextStep.duration} min ({formatDistance(nextStep.distance)})
                        </div>
                      </div>
                      <div className="text-sm mt-1">
                        {nextStep.from} to {nextStep.to}
                      </div>
                      {nextStep.instructions && (
                        <div className="text-sm text-muted-foreground mt-1">{nextStep.instructions}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentLocation && (
            <div>
              <h3 className="font-medium mb-2">Current Location</h3>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-full">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm">
                        Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                      </div>
                      {heading !== null && (
                        <div className="flex items-center mt-1">
                          <Compass className="h-4 w-4 mr-1" />
                          <span className="text-sm">{Math.round(heading)}°</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* For demo purposes - allows manually advancing steps */}
          <div className="mt-6">
            <Button onClick={moveToNextStep} disabled={currentStepIndex >= route.steps.length - 1} className="w-full">
              Simulate Arrival at Next Step
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${(distance * 1000).toFixed(0)}m`
  } else {
    return `${distance.toFixed(2)}km`
  }
}

function getStepBackgroundColor(type: string): string {
  switch (type) {
    case "walk":
      return "bg-muted"
    case "metro":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
    case "bus":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
    default:
      return "bg-muted"
  }
}

