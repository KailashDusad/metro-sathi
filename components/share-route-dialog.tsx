"use client"

import { useState } from "react"
import { Copy, Share, Check, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { Route } from "@/utils/routing"

interface ShareRouteDialogProps {
  route: Route
  open: boolean
  onOpenChange: (open: boolean) => void
  fromLocation: string
  toLocation: string
}

export default function ShareRouteDialog({
  route,
  open,
  onOpenChange,
  fromLocation,
  toLocation,
}: ShareRouteDialogProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // Generate route summary text
  const routeSummary = generateRouteSummary(route, fromLocation, toLocation)

  // Generate shareable text
  const shareableText = `Transit route from ${fromLocation} to ${toLocation}:\n\n${routeSummary}\n\nTotal duration: ${route.duration} minutes`

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareableText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: "Copied to clipboard",
        description: "Route details copied to clipboard",
      })
    } catch (err) {
      console.error("Failed to copy:", err)
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      })
    }
  }

  // Handle share via Web Share API
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Transit route: ${fromLocation} to ${toLocation}`,
          text: shareableText,
        })
        toast({
          title: "Shared successfully",
          description: "Route details shared",
        })
      } catch (err) {
        console.error("Share failed:", err)
        // User probably canceled the share
        if (err instanceof Error && err.name !== "AbortError") {
          toast({
            title: "Share failed",
            description: "Could not share route details",
            variant: "destructive",
          })
        }
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      handleCopy()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Route</DialogTitle>
          <DialogDescription>
            Share your route from {fromLocation} to {toLocation}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border rounded-md p-3 bg-muted/30">
            <p className="text-sm whitespace-pre-wrap">{shareableText}</p>
          </div>

          <div className="flex items-center space-x-2">
            <Input value={shareableText} readOnly className="flex-1" />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex justify-between">
          <DialogClose asChild>
            <Button variant="outline">
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </DialogClose>

          <Button onClick={handleShare}>
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to generate a human-readable route summary
function generateRouteSummary(route: Route, fromLocation: string, toLocation: string): string {
  return route.steps
    .map((step, index) => {
      const stepNumber = index + 1
      const stepType = step.type.charAt(0).toUpperCase() + step.type.slice(1)
      const duration = step.duration
      const distance = step.distance < 1 ? `${(step.distance * 1000).toFixed(0)}m` : `${step.distance.toFixed(2)}km`

      return `${stepNumber}. ${stepType} from ${step.from} to ${step.to} (${duration} min, ${distance})`
    })
    .join("\n")
}

