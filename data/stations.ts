// Define the Station interface
export interface Station {
  id: string
  name: string
  type: "metro" | "bus"
  city: string
  location: {
    lat: number
    lng: number
  }
  distance?: number
  osmTags?: any 
}
