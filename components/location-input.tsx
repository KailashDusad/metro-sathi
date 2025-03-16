"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Check, MapPin, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getLocationSuggestions } from "@/utils/distance"

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
  const [suggestions, setSuggestions] = useState<Array<{ name: string; coordinates?: { lat: number; lng: number } }>>(
    [],
  )
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Get suggestions for the input value
    if (value.length > 2) {
      const newSuggestions = getLocationSuggestions(value)
      setSuggestions(newSuggestions)
      setShowSuggestions(newSuggestions.length > 0)
      setSelectedIndex(-1)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: { name: string; coordinates?: { lat: number; lng: number } }) => {
    setInputValue(suggestion.name)
    onChange(suggestion.name, suggestion.coordinates)
    setSuggestions([])
    setShowSuggestions(false)
    if (onLocationSelect) {
      onLocationSelect()
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return

    // Arrow down
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
    }
    // Arrow up
    else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    }
    // Enter
    else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault()
      handleSelectSuggestion(suggestions[selectedIndex])
    }
    // Escape
    else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [selectedIndex])

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
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            className="flex-1"
          />

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                    index === selectedIndex ? "bg-muted" : "hover:bg-muted"
                  }`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm">{suggestion.name}</div>
                  </div>
                  {index === selectedIndex && <Check className="h-4 w-4 text-primary" />}
                </div>
              ))}
            </div>
          )}
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

