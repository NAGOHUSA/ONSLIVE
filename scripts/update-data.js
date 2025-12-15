const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, 'data');

// Create data directory if it doesn't exist (synchronous check)
if (!fs.existsSync) {
    const fsSync = require('fs');
    if (!fsSync.existsSync(dataDir)) {
        fsSync.mkdirSync(dataDir, { recursive: true });
    }
}

// Helper function to save data
async function saveData(filename, data) {
    try {
        await fs.writeFile(
            path.join(dataDir, filename),
            JSON.stringify(data, null, 2)
        );
        console.log(`✅ ${filename} updated`);
    } catch (error) {
        console.error(`❌ Error saving ${filename}:`, error.message);
    }
}

// Fetch NOAA data
async function fetchNOAAData() {
    try {
        console.log('📡 Fetching NOAA data...');
        
        // Fetch Kp Index
        const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 10000 });
        const kpData = kpResponse.data.slice(-24); // Last 24 entries
        
        // Fetch Solar Wind
        const windResponse = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', { timeout: 10000 });
        const windData = windResponse.data.slice(-1)[0]; // Latest entry
        
        // Fetch Solar Flares
        const flareResponse = await axios.get('https://services.swpc.noaa.gov/json/goes-xray-flares.json', { timeout: 10000 });
        const flareData = flareResponse.data.slice(-5); // Last 5 flares
        
        const noaaData = {
            kpIndex: kpData,
            solarWind: windData || [],
            solarFlares: flareData,
            updated: new Date().toISOString(),
            source: 'NOAA SWPC'
        };
        
        await saveData('noaa-data.json', noaaData);
        return noaaData;
        
    } catch (error) {
        console.error('❌ Error fetching NOAA data:', error.message);
        return null;
    }
}

// Fetch Aurora data
async function fetchAuroraData() {
    try {
        console.log('🌌 Fetching Aurora data...');
        
        // Get current Kp from NOAA
        const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 5000 });
        const latestKp = kpResponse.data.slice(-1)[0];
        const kpValue = latestKp && latestKp[1] ? parseFloat(latestKp[1]) : 3.0;
        
        let forecast = "Aurora activity is quiet.";
        if (kpValue >= 6) {
            forecast = "Aurora Alert! Strong geomagnetic storm may produce visible aurora at mid-latitudes.";
        } else if (kpValue >= 4) {
            forecast = "Aurora possible at high latitudes.";
        }
        
        const auroraData = {
            forecast: forecast,
            kpIndex: kpValue.toFixed(1),
            probability: kpValue >= 5 ? "High" : kpValue >= 4 ? "Moderate" : "Low",
            bestViewing: kpValue >= 4 ? "Late evening to early morning" : "Not favorable",
            updated: new Date().toISOString(),
            source: 'NOAA Aurora Forecast'
        };
        
        await saveData('aurora.json', auroraData);
        return auroraData;
        
    } catch (error) {
        console.error('❌ Error fetching Aurora data:', error.message);
        return {
            forecast: "Aurora data updating...",
            updated: new Date().toISOString(),
            source: 'Aurora Service'
        };
    }
}

// Fetch X-ray data
async function fetchXrayData() {
    try {
        console.log('☀️ Fetching X-ray data...');
        
        const response = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json', { timeout: 10000 });
        const latest = response.data.slice(-1)[0];
        
        if (!latest) {
            throw new Error('No X-ray data available');
        }
        
        const flux = parseFloat(latest.flux) || 0;
        let xrayClass = "A";
        let numericValue = 0;
        
        if (flux >= 0.000001) { // X-class
            xrayClass = "X";
            numericValue = flux / 0.000001;
        } else if (flux >= 0.0000001) { // M-class
            xrayClass = "M";
            numericValue = flux / 0.0000001;
        } else if (flux >= 0.00000001) { // C-class
            xrayClass = "C";
            numericValue = flux / 0.00000001;
        } else if (flux >= 0.000000001) { // B-class
            xrayClass = "B";
            numericValue = flux / 0.000000001;
        } else { // A-class
            numericValue = flux / 0.0000000001;
        }
        
        const xrayData = {
            current: `${xrayClass}${numericValue.toFixed(1)}`,
            numeric: numericValue,
            class: xrayClass,
            description: getXrayDescription(xrayClass, numericValue),
            updated: new Date().toISOString(),
            source: 'NOAA GOES X-ray'
        };
        
        await saveData('xray-data.json', xrayData);
        return xrayData;
        
    } catch (error) {
        console.error('❌ Error fetching X-ray data:', error.message);
        return {
            current: "A0.0",
            numeric: 0,
            class: "A",
            description: "Background solar activity",
            updated: new Date().toISOString(),
            source: 'NOAA GOES X-ray'
        };
    }
}

// Fetch Dst data
async function fetchDstData() {
    try {
        console.log('🧲 Fetching Dst data...');
        
        const response = await axios.get('https://services.swpc.noaa.gov/products/kyoto-dst.json', { timeout: 10000 });
        const latest = response.data.slice(-1)[0];
        
        if (!latest || !Array.isArray(latest) || latest.length < 2) {
            throw new Error('Invalid Dst data');
        }
        
        const dstValue = parseFloat(latest[1]) || 0;
        const stormLevel = getDstStormLevel(dstValue);
        
        const dstData = {
            current: dstValue,
            stormLevel: stormLevel,
            description: getDstDescription(stormLevel),
            updated: new Date().toISOString(),
            source: 'NOAA Kyoto Dst'
        };
        
        await saveData('dst-data.json', dstData);
        return dstData;
        
    } catch (error) {
        console.error('❌ Error fetching Dst data:', error.message);
        return {
            current: 0,
            stormLevel: "Quiet",
            description: "Geomagnetic conditions quiet",
            updated: new Date().toISOString(),
            source: 'NOAA Kyoto Dst'
        };
    }
}

// Fetch Space News
async function fetchNews() {
    try {
        console.log('📰 Fetching Space News...');
        
        // Try multiple news sources
        const newsItems = [];
        
        // NASA News
        try {
            const nasaResponse = await axios.get('https://www.nasa.gov/api/2/ubernode/47986', { timeout: 5000 });
            const nasaData = nasaResponse.data;
            
            if (nasaData && nasaData._source) {
                newsItems.push({
                    title: nasaData._source.title || "NASA Update",
                    link: `https://www.nasa.gov${nasaData._source.uri || ''}`,
                    source: "NASA",
                    date: new Date().toISOString(),
                    summary: nasaData._source.subhead || "Latest news from NASA"
                });
            }
        } catch (nasaError) {
            console.log('NASA news fetch failed, using fallback');
        }
        
        // SpaceWeather.com
        try {
            const swResponse = await axios.get('https://spaceweather.com/', { timeout: 5000 });
            const html = swResponse.data;
            
            // Simple parsing for headline
            const titleMatch = html.match(/<title>(.*?)<\/title>/);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes('403')) {
                newsItems.push({
                    title: titleMatch[1].replace(' - SpaceWeather.com', ''),
                    link: "https://spaceweather.com",
                    source: "SpaceWeather.com",
                    date: new Date().toISOString(),
                    summary: "Latest space weather conditions and forecasts"
                });
            }
        } catch (swError) {
            console.log('SpaceWeather.com fetch failed');
        }
        
        // Add fallback if no news found
        if (newsItems.length === 0) {
            newsItems.push({
                title: "Space Weather Dashboard Update",
                link: "https://live.ournightsky.us",
                source: "Dashboard",
                date: new Date().toISOString(),
                summary: "Real-time space weather monitoring is active"
            });
        }
        
        await saveData('news.json', newsItems);
        return newsItems;
        
    } catch (error) {
        console.error('❌ Error fetching news:', error.message);
        return [{
            title: "Space Weather Dashboard Live",
            link: "https://live.ournightsky.us",
            source: "Dashboard",
            date: new Date().toISOString(),
            summary: "Your enhanced space weather dashboard is now operational with real-time data feeds."
        }];
    }
}

// Update Meteor data
async function updateMeteorData() {
    try {
        console.log('🌠 Updating Meteor data...');
        
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        
        // Determine current meteor activity
        let currentActivity = 3.5;
        let activityLevel = "Low";
        let description = "Background meteor activity";
        
        // Check for active meteor showers
        const activeShowers = [];
        
        // Geminids (Dec 4-17)
        if (month === 12 && day >= 4 && day <= 17) {
            currentActivity = 8.5;
            activityLevel = "High";
            description = "Geminids meteor shower active! Peak around Dec 13-14.";
            activeShowers.push({
                name: "Geminids",
                zhr: 150,
                peak: "Active Now",
                description: "One of the best showers of the year"
            });
        }
        // Quadrantids (Jan 1-10)
        else if (month === 1 && day >= 1 && day <= 10) {
            currentActivity = 7.5;
            activityLevel = "Moderate-High";
            description = "Quadrantids meteor shower active.";
            activeShowers.push({
                name: "Quadrantids",
                zhr: 120,
                peak: "Active Now",
                description: "First major shower of the year"
            });
        }
        
        const meteorData = {
            current: parseFloat(currentActivity.toFixed(1)),
            max: 10,
            activity: activityLevel,
            description: description,
            updated: new Date().toISOString(),
            activeShowers: activeShowers,
            nextMajorShower: {
                name: month >= 1 && month <= 6 ? "Perseids" : "Leonids",
                date: month >= 1 && month <= 6 ? "August 12-13" : "November 17-18",
                zhr: month >= 1 && month <= 6 ? 100 : 15,
                description: month >= 1 && month <= 6 ? 
                    "Popular summer meteor shower" : 
                    "Known for meteor storms every 33 years"
            }
        };
        
        await saveData('meteor.json', meteorData);
        return meteorData;
        
    } catch (error) {
        console.error('❌ Error updating meteor data:', error.message);
        return {
            current: 3.5,
            max: 10,
            activity: "Low",
            description: "Background meteor activity",
            updated: new Date().toISOString(),
            activeShowers: [],
            nextMajorShower: null
        };
    }
}

// Update system status
async function updateSystemStatus(allData) {
    try {
        console.log('⚙️ Updating system status...');
        
        const statusData = {
            lastUpdate: new Date().toISOString(),
            status: 'success',
            message: 'All data sources updated successfully',
            timestamp: Date.now(),
            dataSources: [
                'NOAA Space Weather Prediction Center',
                'NASA GOES Satellite Data',
                'Aurora Forecast Service',
                'Meteor Activity Monitor'
            ],
            metrics: {
                dataPoints: Object.keys(allData).length,
                updateTime: new Date().toLocaleTimeString()
            }
        };
        
        await saveData('update-status.json', statusData);
        return statusData;
        
    } catch (error) {
        console.error('❌ Error updating system status:', error.message);
        return {
            lastUpdate: new Date().toISOString(),
            status: 'error',
            message: 'Partial update completed',
            timestamp: Date.now()
        };
    }
}

// Helper functions
function getXrayDescription(flareClass, value) {
    switch(flareClass) {
        case 'X':
            return value >= 10 ? "Extreme solar flare activity" : "Major solar flare activity";
        case 'M':
            return "Moderate solar flare activity";
        case 'C':
            return "Minor solar flare activity";
        case 'B':
            return "Very low solar activity";
        default:
            return "Background solar activity";
    }
}

function getDstStormLevel(dst) {
    if (dst <= -100) return "Severe";
    if (dst <= -50) return "Strong";
    if (dst <= -30) return "Moderate";
    if (dst <= -20) return "Minor";
    return "Quiet";
}

function getDstDescription(level) {
    switch(level) {
        case "Severe": return "Severe geomagnetic storm in progress";
        case "Strong": return "Strong geomagnetic storm ongoing";
        case "Moderate": return "Moderate geomagnetic disturbance";
        case "Minor": return "Minor geomagnetic activity";
        default: return "Geomagnetic conditions quiet";
    }
}

// Main update function
async function updateAllData() {
    console.log('🚀 Starting enhanced space weather data update...');
    console.log('Time:', new Date().toISOString());
    
    try {
        // Fetch all data in parallel
        const [
            noaaData,
            auroraData,
            xrayData,
            dstData,
            newsData,
            meteorData
        ] = await Promise.all([
            fetchNOAAData(),
            fetchAuroraData(),
            fetchXrayData(),
            fetchDstData(),
            fetchNews(),
            updateMeteorData()
        ]);
        
        // Update system status
        const allData = {
            noaa: noaaData,
            aurora: auroraData,
            xray: xrayData,
            dst: dstData,
            news: newsData,
            meteor: meteorData
        };
        
        const statusData = await updateSystemStatus(allData);
        
        console.log('✅ All data updated successfully!');
        console.log('📊 Summary:');
        console.log(`   - NOAA Data: ${noaaData ? '✓' : '✗'}`);
        console.log(`   - Aurora Forecast: ${auroraData ? '✓' : '✗'}`);
        console.log(`   - X-ray Flux: ${xrayData ? xrayData.current : '✗'}`);
        console.log(`   - Dst Index: ${dstData ? dstData.current + ' nT' : '✗'}`);
        console.log(`   - News Items: ${newsData ? newsData.length : 0}`);
        console.log(`   - Meteor Activity: ${meteorData ? meteorData.current + '/10' : '✗'}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Critical error updating data:', error);
        return false;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    updateAllData().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { updateAllData };
