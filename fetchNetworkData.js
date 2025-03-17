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
// Define the Overpass API URL
var OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
// Function to fetch data from Overpass API with retry logic
function fetchOSMData(query_1) {
    return __awaiter(this, arguments, void 0, function (query, retries) {
        var attempt, response, error_1;
        if (retries === void 0) { retries = 3; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 6];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, axios_1.default.post(OVERPASS_API_URL, "data=".concat(encodeURIComponent(query)))];
                case 3:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
                case 4:
                    error_1 = _a.sent();
                    if (attempt === retries) {
                        console.error("Error fetching data from Overpass API after ".concat(retries, " attempts:"), error_1);
                        throw error_1;
                    }
                    console.warn("Retrying fetchOSMData (attempt ".concat(attempt, " of ").concat(retries, ")..."));
                    return [3 /*break*/, 5];
                case 5:
                    attempt++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Function to save data to a file
function saveDataToFile(data, filename) {
    var filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log("Data saved to ".concat(filePath));
}
// Function to fetch metro network data
function fetchMetroNetworkData() {
    return __awaiter(this, void 0, void 0, function () {
        var query, data, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log('Fetching metro network data...');
                    query = "\n            [out:json][timeout:25];\n            area[\"name\"=\"India\"]->.searchArea;\n            (\n                node[\"railway\"=\"station\"](area.searchArea);\n                way[\"railway\"=\"rail\"](area.searchArea);\n                relation[\"railway\"=\"rail\"](area.searchArea);\n            );\n            out body;\n            >;\n            out skel qt;\n        ";
                    return [4 /*yield*/, fetchOSMData(query)];
                case 1:
                    data = _a.sent();
                    fs.writeFileSync('d:\\Metro\\MetroSathiFinal\\metroNetworkData.json', JSON.stringify(data, null, 2));
                    console.log('Data saved to D:\\Metro\\MetroSathiFinal\\metroNetworkData.json');
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error fetching metro network data:', error_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Function to fetch citi-bus network data
function fetchCitiBusNetworkData() {
    return __awaiter(this, void 0, void 0, function () {
        var query, data, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log('Fetching citi-bus network data...');
                    query = "\n            [out:json][timeout:60];\n            area[\"name\"=\"India\"]->.searchArea;\n            (\n                node[\"highway\"=\"bus_stop\"](area.searchArea);\n                way[\"highway\"=\"busway\"](area.searchArea);\n                relation[\"route\"=\"bus\"](area.searchArea);\n            );\n            out body;\n            >;\n            out skel qt;\n        ";
                    return [4 /*yield*/, fetchOSMData(query)];
                case 1:
                    data = _a.sent();
                    // Fetch names of nodes and links if available
                    if (data.elements) {
                        data.elements.forEach(function (element) {
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
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error fetching citi-bus network data:', error_3);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Main function to fetch and save metro and citi-bus network data
function main() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchMetroNetworkData()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, fetchCitiBusNetworkData()];
                case 2:
                    _a.sent();
                    console.log('Data fetching and saving completed successfully.');
                    return [2 /*return*/];
            }
        });
    });
}
// Execute the main function
main();
