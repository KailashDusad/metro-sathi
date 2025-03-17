"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { MapPin, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface LocationInputProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string, coordinates?: { lat: number; lng: number }) => void
  onLocationSelect?: () => void
  showLocationButton?: boolean
  isLocating?: boolean
  onUseCurrentLocation?: () => void
}

export default function LocationInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  onLocationSelect,
  showLocationButton = false,
  isLocating = false,
  onUseCurrentLocation,
}: LocationInputProps) {
  const [inputValue, setInputValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    onChange(value)
  }

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (onLocationSelect) {
        onLocationSelect()
      }
    }
  }

  return (
    <div className="space-y-2 relative">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            id={id}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
        </div>

        {showLocationButton && (
          <Button
            variant="outline"
            size="icon"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            title="Use current location"
          >
            {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}