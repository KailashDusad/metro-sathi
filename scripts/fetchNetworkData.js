"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var axios_1 = require("axios");
var fs = require("fs");
var path = require("path");
// Define the Overpass API endpoints (multiple to handle rate limiting)
var OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
// Define major Indian cities to chunk our requests
var MAJOR_CITIES = [
    { name: "Delhi", bbox: "28.4,77.0,28.8,77.4" },
    { name: "Rajashtan", bbox: "26.0,69.0,30.0,75.0" },
    { name: "Maharashtra", bbox: "17.0,73.0,22.0,80.0" },
    { name: "Madhya Pradesh", bbox: "21.0,74.0,26.0,82.0" },
    { name: "Uttar Pradesh", bbox: "26.0,77.0,31.0,84.0" },
    { name: "Bihar", bbox: "24.0,83.0,27.0,88.0" },
    { name: "Gujarat", bbox: "20.0,70.0,24.0,75.0" },
];
// Function to get a random Overpass API endpoint
function getOverpassEndpoint() {
    return OVERPASS_ENDPOINTS[Math.floor(Math.random() * OVERPASS_ENDPOINTS.length)];
}
// Function to fetch data from Overpass API with retry logic
function fetchOSMData(query_1) {
    return __awaiter(this, arguments, void 0, function (query, retries, city) {
        var _loop_1, attempt, state_1;
        if (retries === void 0) { retries = 3; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Fetching ".concat(city ? "data for ".concat(city) : "data", "..."));
                    _loop_1 = function (attempt) {
                        var endpoint, response, error_1, waitTime_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 4]);
                                    endpoint = getOverpassEndpoint();
                                    console.log("Using endpoint: ".concat(endpoint, " (attempt ").concat(attempt, ")"));
                                    return [4 /*yield*/, axios_1.default.post(endpoint, "data=".concat(encodeURIComponent(query)), {
                                            headers: {
                                                "Content-Type": "application/x-www-form-urlencoded",
                                                "User-Agent": "TransitFinderIndia/1.0",
                                            },
                                            timeout: 60000, // 60 second timeout
                                        })];
                                case 1:
                                    response = _b.sent();
                                    console.log("Successfully fetched ".concat(city ? "data for ".concat(city) : "data"));
                                    return [2 /*return*/, { value: response.data }];
                                case 2:
                                    error_1 = _b.sent();
                                    console.error("Error (attempt ".concat(attempt, "/").concat(retries, "):"), error_1.message);
                                    if (attempt === retries) {
                                        console.error("Failed to fetch data after ".concat(retries, " attempts"));
                                        throw error_1;
                                    }
                                    waitTime_1 = 2000 * Math.pow(2, attempt - 1);
                                    console.log("Waiting ".concat(waitTime_1, "ms before retry..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, waitTime_1); })];
                                case 3:
                                    _b.sent();
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Function to save data to a file
function saveDataToFile(data, filename) {
    // Ensure the directory exists
    var dirPath = path.join(process.cwd(), "public/data");
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    var filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log("Data saved to ".concat(filePath));
}
// Function to fetch metro network data by city chunks
function fetchMetroNetworkData() {
    return __awaiter(this, void 0, void 0, function () {
        var allCityData, _loop_2, _i, MAJOR_CITIES_1, city, processedData, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    console.log("Fetching metro network data (chunked by city)...");
                    allCityData = { elements: [] };
                    _loop_2 = function (city) {
                        var query, cityData, error_3;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    query = "\n          [out:json][timeout:25];\n          (\n            node[\"railway\"=\"station\"][\"station\"=\"subway\"](".concat(city.bbox, ");\n            node[\"railway\"=\"station\"][\"station\"=\"metro\"](").concat(city.bbox, ");\n            node[\"railway\"=\"station\"](").concat(city.bbox, ");\n            way[\"railway\"=\"subway\"](").concat(city.bbox, ");\n            relation[\"route\"=\"subway\"](").concat(city.bbox, ");\n            relation[\"route\"=\"metro\"](").concat(city.bbox, ");\n          );\n          out body;\n          >;\n          out skel qt;\n        ");
                                    return [4 /*yield*/, fetchOSMData(query, 3, city.name)];
                                case 1:
                                    cityData = _b.sent();
                                    if (cityData && cityData.elements) {
                                        console.log("Found ".concat(cityData.elements.length, " metro elements in ").concat(city.name));
                                        // Annotate elements with city info for easier processing later
                                        cityData.elements.forEach(function (element) {
                                            if (!element.tags)
                                                element.tags = {};
                                            element.tags.fetchedCity = city.name;
                                        });
                                        // Add to our collection
                                        allCityData.elements = allCityData.elements.concat(cityData.elements);
                                    }
                                    // Wait a bit between cities to avoid rate limiting
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                                case 2:
                                    // Wait a bit between cities to avoid rate limiting
                                    _b.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_3 = _b.sent();
                                    console.error("Error fetching metro data for ".concat(city.name, ":"), error_3);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, MAJOR_CITIES_1 = MAJOR_CITIES;
                    _a.label = 1;
                case 1:
                    if (!(_i < MAJOR_CITIES_1.length)) return [3 /*break*/, 4];
                    city = MAJOR_CITIES_1[_i];
                    return [5 /*yield**/, _loop_2(city)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("Total metro elements found: ".concat(allCityData.elements.length));
                    processedData = processMetroNetworkData(allCityData);
                    // Save both raw and processed data
                    saveDataToFile(allCityData, "metroNetworkRaw.json");
                    saveDataToFile(processedData, "metroNetwork.json");
                    console.log("Metro data processing completed");
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    console.error("Error in metro network data fetching process:", error_2);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Function to process raw metro data into a more usable format
function processMetroNetworkData(rawData) {
    var stations = [];
    var lines = [];
    var seenStationIds = new Set();
    // First pass: extract all stations
    rawData.elements.forEach(function (element) {
        if (element.type === "node" &&
            element.tags &&
            (element.tags.railway === "station" || element.tags.station === "subway" || element.tags.station === "metro")) {
            // Skip if we've already processed this station
            if (seenStationIds.has(element.id))
                return;
            seenStationIds.add(element.id);
            // Extract and normalize station name
            var name_1 = element.tags.name || element.tags["name:en"] || "Station ".concat(element.id);
            stations.push({
                id: "metro-".concat(element.id),
                name: name_1,
                type: "metro",
                city: element.tags.fetchedCity || detectCityFromCoordinates(element.lat, element.lon),
                location: {
                    lat: element.lat,
                    lng: element.lon,
                },
                network: element.tags.network || "unknown",
                osmTags: element.tags,
            });
        }
    });
    // Second pass: extract metro lines
    rawData.elements.forEach(function (element) {
        if (element.type === "relation" &&
            element.tags &&
            (element.tags.route === "subway" || element.tags.route === "metro")) {
            var name_2 = element.tags.name || element.tags["name:en"] || "Line ".concat(element.id);
            var color = element.tags.colour || element.tags.color || "#888888";
            lines.push({
                id: "line-".concat(element.id),
                name: name_2,
                color: color,
                network: element.tags.network || "unknown",
                city: element.tags.fetchedCity || "unknown",
                osmId: element.id,
                osmTags: element.tags,
            });
        }
    });
    return {
        stations: stations,
        lines: lines,
        lastUpdated: new Date().toISOString(),
    };
}
// Function to fetch bus network data by city chunks
function fetchBusNetworkData() {
    return __awaiter(this, void 0, void 0, function () {
        var allCityData, _loop_3, _i, MAJOR_CITIES_2, city, processedData, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    console.log("Fetching bus network data (chunked by city)...");
                    allCityData = { elements: [] };
                    _loop_3 = function (city) {
                        var query, cityData, error_5;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    query = "\n          [out:json][timeout:25];\n          (\n            node[\"highway\"=\"bus_stop\"](".concat(city.bbox, ");\n            node[\"amenity\"=\"bus_station\"](").concat(city.bbox, ");\n            node[\"public_transport\"=\"stop_position\"][\"bus\"=\"yes\"](").concat(city.bbox, ");\n          );\n          out body;\n          >;\n          out skel qt;\n        ");
                                    return [4 /*yield*/, fetchOSMData(query, 3, city.name)];
                                case 1:
                                    cityData = _b.sent();
                                    if (cityData && cityData.elements) {
                                        console.log("Found ".concat(cityData.elements.length, " bus elements in ").concat(city.name));
                                        // Annotate elements with city info
                                        cityData.elements.forEach(function (element) {
                                            if (!element.tags)
                                                element.tags = {};
                                            element.tags.fetchedCity = city.name;
                                        });
                                        // Add to our collection
                                        allCityData.elements = allCityData.elements.concat(cityData.elements);
                                    }
                                    // Wait to avoid rate limiting
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                                case 2:
                                    // Wait to avoid rate limiting
                                    _b.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_5 = _b.sent();
                                    console.error("Error fetching bus data for ".concat(city.name, ":"), error_5);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, MAJOR_CITIES_2 = MAJOR_CITIES;
                    _a.label = 1;
                case 1:
                    if (!(_i < MAJOR_CITIES_2.length)) return [3 /*break*/, 4];
                    city = MAJOR_CITIES_2[_i];
                    return [5 /*yield**/, _loop_3(city)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("Total bus elements found: ".concat(allCityData.elements.length));
                    processedData = processBusNetworkData(allCityData);
                    // Save both raw and processed data
                    saveDataToFile(allCityData, "busNetworkRaw.json");
                    saveDataToFile(processedData, "busNetwork.json");
                    console.log("Bus data processing completed");
                    return [3 /*break*/, 6];
                case 5:
                    error_4 = _a.sent();
                    console.error("Error in bus network data fetching process:", error_4);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Function to process raw bus data into a more usable format
function processBusNetworkData(rawData) {
    var stations = [];
    var routes = [];
    var seenStationIds = new Set();
    // Extract all bus stops
    rawData.elements.forEach(function (element) {
        if (element.type === "node" &&
            element.tags &&
            (element.tags.highway === "bus_stop" ||
                element.tags.amenity === "bus_station" ||
                (element.tags.public_transport === "stop_position" && element.tags.bus === "yes"))) {
            // Skip if we've already processed this station
            if (seenStationIds.has(element.id))
                return;
            seenStationIds.add(element.id);
            // Extract and normalize station name
            var name_3 = element.tags.name || element.tags["name:en"] || element.tags.ref || "Bus Stop ".concat(element.id);
            stations.push({
                id: "bus-".concat(element.id),
                name: name_3,
                type: "bus",
                city: element.tags.fetchedCity || detectCityFromCoordinates(element.lat, element.lon),
                location: {
                    lat: element.lat,
                    lng: element.lon,
                },
                network: element.tags.network || element.tags.operator || "unknown",
                osmTags: element.tags,
            });
        }
    });
    return {
        stations: stations,
        routes: routes,
        lastUpdated: new Date().toISOString(),
    };
}
// Utility to detect city from coordinates
function detectCityFromCoordinates(lat, lon) {
    for (var _i = 0, MAJOR_CITIES_3 = MAJOR_CITIES; _i < MAJOR_CITIES_3.length; _i++) {
        var city = MAJOR_CITIES_3[_i];
        var _a = city.bbox.split(",").map(Number), minLat = _a[0], minLon = _a[1], maxLat = _a[2], maxLon = _a[3];
        if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
            return city.name;
        }
    }
    return "unknown";
}
// Main function
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Starting data fetching process...");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    // Fetch metro network data first
                    return [4 /*yield*/, fetchMetroNetworkData()
                        // Then fetch bus network data
                    ];
                case 2:
                    // Fetch metro network data first
                    _a.sent();
                    // Then fetch bus network data
                    return [4 /*yield*/, fetchBusNetworkData()];
                case 3:
                    // Then fetch bus network data
                    _a.sent();
                    console.log("Data fetching and processing completed successfully!");
                    console.log("Files have been saved to the public/data directory.");
                    return [3 /*break*/, 5];
                case 4:
                    error_6 = _a.sent();
                    console.error("Error in main execution:", error_6);
                    process.exit(1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Execute the main function
main();
