const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fsSync.existsSync(dataDir)) {
    fsSync.mkdirSync(dataDir, { recursive: true });
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
        
        // Fetch Kp Index - with better error handling
        let kpData = [];
        try {
            const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { 
                timeout: 10000,
                headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
            });
            
            // Validate response
            if (Array.isArray(kpResponse.data) && kpResponse.data.length > 1) {
                // Skip header row, get last 24 entries
                kpData = kpResponse.data.slice(-25).slice(1);
                console.log(`   ✓ Got ${kpData.length} Kp entries`);
            }
        } catch (kpError) {
            console.warn('   ⚠️ Kp fetch failed:', kpError.message);
        }
        
        // Fetch Solar Wind - with validation
        let windData = [];
        try {
            const windResponse = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', { 
                timeout: 10000,
                headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
            });
            
            if (Array.isArray(windResponse.data) && windResponse.data.length > 1) {
                // Skip header, get latest
                const latest = windResponse.data[windResponse.data.length - 1];
                if (Array.isArray(latest) && latest.length >= 3) {
                    windData = latest;
                    console.log(`   ✓ Wind speed: ${latest[2]} km/s`);
                }
            }
        } catch (windError) {
            console.warn('   ⚠️ Solar wind fetch failed:', windError.message);
        }
        
        // Fetch Solar Flares - with validation
        let flareData = [];
        try {
            const flareResponse = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json', { 
                timeout: 10000,
                headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
            });
            
            if (Array.isArray(flareResponse.data)) {
                flareData = flareResponse.data.slice(-5);
                console.log(`   ✓ Got ${flareData.length} recent flares`);
            }
        } catch (flareError) {
            console.warn('   ⚠️ Flare fetch failed:', flareError.message);
        }
        
        const noaaData = {
            kpIndex: kpData,
            solarWind: windData,
            solarFlares: flareData,
            updated: new Date().toISOString(),
            source: 'NOAA SWPC'
        };
        
        await saveData('noaa-data.json', noaaData);
        return noaaData;
        
    } catch (error) {
        console.error('❌ Error fetching NOAA data:', error.message);
        // Return minimal valid structure
        return {
            kpIndex: [],
            solarWind: [],
            solarFlares: [],
            updated: new Date().toISOString(),
            source: 'NOAA SWPC (Error)'
        };
    }
}

// Fetch Aurora data
async function fetchAuroraData() {
    try {
        console.log('🌌 Fetching Aurora data...');
        
        // Get current Kp from NOAA
        const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { 
            timeout: 5000,
            headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
        });
        
        let kpValue = 3.0; // Default
        
        if (Array.isArray(kpResponse.data) && kpResponse.data.length > 1) {
            const latestKp = kpResponse.data[kpResponse.data.length - 1];
            
            // Handle both array and object formats
            if (Array.isArray(latestKp) && latestKp.length >= 2) {
                kpValue = parseFloat(latestKp[1]) || 3.0;
            } else if (typeof latestKp === 'object' && latestKp.kp_index) {
                kpValue = parseFloat(latestKp.kp_index) || 3.0;
            }
        }
        
        console.log(`   ✓ Current Kp: ${kpValue.toFixed(1)}`);
        
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
            kpIndex: "3.0",
            probability: "Low",
            bestViewing: "Not available",
            updated: new Date().toISOString(),
            source: 'Aurora Service (Error)'
        };
    }
}

// Fetch X-ray data
async function fetchXrayData() {
    try {
        console.log('☀️ Fetching X-ray data...');
        
        const response = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json', { 
            timeout: 10000,
            headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
        });
        
        if (!Array.isArray(response.data) || response.data.length === 0) {
            throw new Error('No X-ray data available');
        }
        
        const latest = response.data[response.data.length - 1];
        
        if (!latest || !latest.flux) {
            throw new Error('Invalid X-ray data format');
        }
        
        const flux = parseFloat(latest.flux) || 0;
        let xrayClass = "A";
        let numericValue = 0;
        
        // Corrected flux thresholds
        if (flux >= 1e-4) { // X-class: >= 10^-4
            xrayClass = "X";
            numericValue = flux / 1e-4;
        } else if (flux >= 1e-5) { // M-class: >= 10^-5
            xrayClass = "M";
            numericValue = flux / 1e-5;
        } else if (flux >= 1e-6) { // C-class: >= 10^-6
            xrayClass = "C";
            numericValue = flux / 1e-6;
        } else if (flux >= 1e-7) { // B-class: >= 10^-7
            xrayClass = "B";
            numericValue = flux / 1e-7;
        } else { // A-class: < 10^-7
            xrayClass = "A";
            numericValue = flux / 1e-8;
        }
        
        const current = `${xrayClass}${numericValue.toFixed(1)}`;
        console.log(`   ✓ X-ray flux: ${current} (${flux.toExponential(2)})`);
        
        const xrayData = {
            current: current,
            flux: flux,
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
            flux: 0,
            numeric: 0,
            class: "A",
            description: "Background solar activity",
            updated: new Date().toISOString(),
            source: 'NOAA GOES X-ray (Error)'
        };
    }
}

// Fetch Dst data
async function fetchDstData() {
    try {
        console.log('🧲 Fetching Dst data...');
        
        const response = await axios.get('https://services.swpc.noaa.gov/products/kyoto-dst.json', { 
            timeout: 10000,
            headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
        });
        
        if (!Array.isArray(response.data) || response.data.length < 2) {
            throw new Error('Invalid Dst data');
        }
        
        // Skip header row, get latest
        const latest = response.data[response.data.length - 1];
        
        if (!Array.isArray(latest) || latest.length < 2) {
            throw new Error('Invalid Dst data format');
        }
        
        const dstValue = parseFloat(latest[1]) || 0;
        const stormLevel = getDstStormLevel(dstValue);
        
        console.log(`   ✓ Dst: ${dstValue} nT (${stormLevel})`);
        
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
            source: 'NOAA Kyoto Dst (Error)'
        };
    }
}

// Fetch Space News
async function fetchNews() {
    try {
        console.log('📰 Fetching Space News...');
        
        const newsItems = [];
        
        // Try SpaceWeather.com RSS/API
        try {
            const swResponse = await axios.get('https://spaceweather.com/', { 
                timeout: 5000,
                headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
            });
            const html = swResponse.data;
            
            const titleMatch = html.match(/<title>(.*?)<\/title>/);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes('403')) {
                newsItems.push({
                    title: titleMatch[1].replace(' - SpaceWeather.com', '').trim(),
                    link: "https://spaceweather.com",
                    source: "SpaceWeather.com",
                    date: new Date().toISOString(),
                    summary: "Latest space weather conditions and forecasts"
                });
            }
        } catch (swError) {
            console.warn('   ⚠️ SpaceWeather.com fetch failed:', swError.message);
        }
        
        // Try NOAA Space Weather Alerts
        try {
            const alertResponse = await axios.get('https://services.swpc.noaa.gov/products/alerts.json', {
                timeout: 5000,
                headers: { 'User-Agent': 'SpaceWeatherDashboard/2.0' }
            });
            
            if (Array.isArray(alertResponse.data) && alertResponse.data.length > 0) {
                // Get most recent alert
                const alert = alertResponse.data[0];
                if (alert.message) {
                    const lines = alert.message.split('\n').filter(l => l.trim());
                    newsItems.push({
                        title: lines[0] || "NOAA Space Weather Alert",
                        link: "https://www.swpc.noaa.gov/",
                        source: "NOAA SWPC",
                        date: alert.issue_datetime || new Date().toISOString(),
                        summary: lines.slice(1, 3).join(' ').substring(0, 150) + '...'
                    });
                }
            }
        } catch (alertError) {
            console.warn('   ⚠️ NOAA alerts fetch failed:', alertError.message);
        }
        
        // Add fallback if no news found
        if (newsItems.length === 0) {
            newsItems.push({
                title: "Space Weather Monitoring Active",
                link: "https://www.swpc.noaa.gov/",
                source: "NOAA SWPC",
                date: new Date().toISOString(),
                summary: "Real-time space weather monitoring from NOAA Space Weather Prediction Center"
            });
        }
        
        console.log(`   ✓ Got ${newsItems.length} news items`);
        
        await saveData('news.json', newsItems);
        return newsItems;
        
    } catch (error) {
        console.error('❌ Error fetching news:', error.message);
        return [{
            title: "Space Weather Dashboard Active",
            link: "https://www.swpc.noaa.gov/",
            source: "Dashboard",
            date: new Date().toISOString(),
            summary: "Your space weather dashboard is operational with real-time data feeds."
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
        
        let currentActivity = 3.5;
        let activityLevel = "Low";
        let description = "Background meteor activity";
        const activeShowers = [];
        
        // Geminids (Dec 4-17, peak Dec 13-14)
        if (month === 12 && day >= 4 && day <= 17) {
            currentActivity = 8.5;
            activityLevel = "High";
            description = "Geminids meteor shower active! Peak around Dec 13-14.";
            activeShowers.push({
                name: "Geminids",
                zhr: 150,
                peak: day >= 13 && day <= 14 ? "Peak Tonight!" : "Active Now",
                description: "One of the best showers of the year"
            });
        }
        // Quadrantids (Jan 1-10, peak Jan 3-4)
        else if (month === 1 && day >= 1 && day <= 10) {
            currentActivity = 7.5;
            activityLevel = "Moderate-High";
            description = "Quadrantids meteor shower active.";
            activeShowers.push({
                name: "Quadrantids",
                zhr: 120,
                peak: day >= 3 && day <= 4 ? "Peak Tonight!" : "Active Now",
                description: "First major shower of the year"
            });
        }
        // Lyrids (Apr 16-25, peak Apr 22)
        else if (month === 4 && day >= 16 && day <= 25) {
            currentActivity = 5.0;
            activityLevel = "Moderate";
            description = "Lyrids meteor shower active.";
            activeShowers.push({
                name: "Lyrids",
                zhr: 18,
                peak: day === 22 ? "Peak Tonight!" : "Active Now",
                description: "Spring meteor shower"
            });
        }
        // Perseids (Jul 17 - Aug 24, peak Aug 12-13)
        else if ((month === 7 && day >= 17) || (month === 8 && day <= 24)) {
            currentActivity = 8.0;
            activityLevel = "High";
            description = "Perseids meteor shower active!";
            activeShowers.push({
                name: "Perseids",
                zhr: 100,
                peak: (month === 8 && day >= 12 && day <= 13) ? "Peak Tonight!" : "Active Now",
                description: "Popular summer meteor shower"
            });
        }
        
        console.log(`   ✓ Activity: ${currentActivity}/10 (${activityLevel})`);
        
        const meteorData = {
            current: parseFloat(currentActivity.toFixed(1)),
            max: 10,
            activity: activityLevel,
            description: description,
            updated: new Date().toISOString(),
            activeShowers: activeShowers,
            nextMajorShower: getNextMajorShower(month, day)
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

// Helper: Get next major meteor shower
function getNextMajorShower(month, day) {
    const showers = [
        { name: "Quadrantids", month: 1, day: 3, zhr: 120, desc: "First major shower of the year" },
        { name: "Lyrids", month: 4, day: 22, zhr: 18, desc: "Spring meteor shower" },
        { name: "Perseids", month: 8, day: 12, zhr: 100, desc: "Popular summer shower" },
        { name: "Geminids", month: 12, day: 13, zhr: 150, desc: "Best shower of the year" }
    ];
    
    const currentDate = month * 100 + day;
    
    for (const shower of showers) {
        const showerDate = shower.month * 100 + shower.day;
        if (showerDate > currentDate) {
            return {
                name: shower.name,
                date: `${getMonthName(shower.month)} ${shower.day}`,
                zhr: shower.zhr,
                description: shower.desc
            };
        }
    }
    
    // If no shower found (we're past December), return next year's Quadrantids
    return {
        name: "Quadrantids",
        date: "January 3",
        zhr: 120,
        description: "First major shower of the year"
    };
}

function getMonthName(month) {
    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
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
    console.log('🚀 Starting space weather data update...');
    console.log('⏰ Time:', new Date().toISOString());
    console.log('');
    
    try {
        const [
            noaaData,
            auroraData,
            xrayData,
            dstData,
            newsData,
            meteorData
        ] = await Promise.allSettled([
            fetchNOAAData(),
            fetchAuroraData(),
            fetchXrayData(),
            fetchDstData(),
            fetchNews(),
            updateMeteorData()
        ]);
        
        const allData = {
            noaa: noaaData.status === 'fulfilled' ? noaaData.value : null,
            aurora: auroraData.status === 'fulfilled' ? auroraData.value : null,
            xray: xrayData.status === 'fulfilled' ? xrayData.value : null,
            dst: dstData.status === 'fulfilled' ? dstData.value : null,
            news: newsData.status === 'fulfilled' ? newsData.value : null,
            meteor: meteorData.status === 'fulfilled' ? meteorData.value : null
        };
        
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
                dataPoints: Object.values(allData).filter(d => d !== null).length,
                updateTime: new Date().toLocaleTimeString()
            }
        };
        
        await saveData('update-status.json', statusData);
        
        console.log('');
        console.log('✅ All data updated successfully!');
        console.log('📊 Summary:');
        console.log(`   - NOAA Data: ${noaaData.status === 'fulfilled' ? '✓' : '✗'}`);
        console.log(`   - Aurora Forecast: ${auroraData.status === 'fulfilled' ? '✓' : '✗'}`);
        console.log(`   - X-ray Flux: ${xrayData.status === 'fulfilled' ? xrayData.value.current : '✗'}`);
        console.log(`   - Dst Index: ${dstData.status === 'fulfilled' ? dstData.value.current + ' nT' : '✗'}`);
        console.log(`   - News Items: ${newsData.status === 'fulfilled' ? newsData.value.length : 0}`);
        console.log(`   - Meteor Activity: ${meteorData.status === 'fulfilled' ? meteorData.value.current + '/10' : '✗'}`);
        console.log('');
        
        return true;
        
    } catch (error) {
        console.error('❌ Critical error updating data:', error);
        return false;
    }
}

// Run if executed directly
if (require.main === module) {
    updateAllData().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { updateAllData };
