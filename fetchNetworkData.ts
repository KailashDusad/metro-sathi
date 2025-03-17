import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Define the Overpass API URL
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Function to fetch data from Overpass API with retry logic
async function fetchOSMData(query: string, retries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(OVERPASS_API_URL, `data=${encodeURIComponent(query)}`);
            return response.data;
        } catch (error) {
            if (attempt === retries) {
                console.error(`Error fetching data from Overpass API after ${retries} attempts:`, error);
                throw error;
            }
            console.warn(`Retrying fetchOSMData (attempt ${attempt} of ${retries})...`);
        }
    }
}

// Function to save data to a file
function saveDataToFile(data: any, filename: string): void {
    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filePath}`);
}

// Function to fetch metro network data
async function fetchMetroNetworkData() {
    try {
        console.log('Fetching metro network data...');
        const query = `
            [out:json][timeout:25];
            area["name"="India"]->.searchArea;
            (
                node["railway"="station"](area.searchArea);
                way["railway"="rail"](area.searchArea);
                relation["railway"="rail"](area.searchArea);
            );
            out body;
            >;
            out skel qt;
        `;
        const data = await fetchOSMData(query);
        fs.writeFileSync('d:\\Metro\\MetroSathiFinal\\metroNetworkData.json', JSON.stringify(data, null, 2));
        console.log('Data saved to D:\\Metro\\MetroSathiFinal\\metroNetworkData.json');
    } catch (error) {
        console.error('Error fetching metro network data:', error);
    }
}

// Function to fetch citi-bus network data
async function fetchCitiBusNetworkData() {
    try {
        console.log('Fetching citi-bus network data...');
        const query = `
            [out:json][timeout:60];
            area["name"="India"]->.searchArea;
            (
                node["highway"="bus_stop"](area.searchArea);
                way["highway"="busway"](area.searchArea);
                relation["route"="bus"](area.searchArea);
            );
            out body;
            >;
            out skel qt;
        `;
        const data = await fetchOSMData(query);
        // Fetch names of nodes and links if available
        if (data.elements) {
            data.elements.forEach(element => {
                if (element.type === 'node' && element.tags && element.tags.name) {
                    element.name = element.tags.name;
                }
                if (element.type === 'way' && element.tags && element.tags.name) {
                    element.name = element.tags.name;
                }
            });
        }
        fs.writeFileSync('d:\\Metro\\MetroSathiFinal\\citiBusNetworkData.json', JSON.stringify(data, null, 2));
        console.log('Data saved to D:\\Metro\\MetroSathiFinal\\citiBusNetworkData.json');
    } catch (error) {
        console.error('Error fetching citi-bus network data:', error);
    }
}

// Main function to fetch and save metro and citi-bus network data
async function main() {
    await fetchMetroNetworkData();
    await fetchCitiBusNetworkData();
    console.log('Data fetching and saving completed successfully.');
}

// Execute the main function
main();