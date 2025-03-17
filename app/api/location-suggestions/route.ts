import { NextResponse } from "next/server"
import { getCombinedLocationSuggestions } from "@/utils/api-client"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  try {
    const suggestions = await getCombinedLocationSuggestions(query)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("Error in location suggestions API:", error)
    return NextResponse.json({ error: "Failed to fetch location suggestions" }, { status: 500 })
  }
}