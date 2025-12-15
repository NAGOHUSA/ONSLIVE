const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, 'data');

// Proper synchronous directory creation
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

// Fetch functions with correct endpoints and processing to match dashboard expectations

async function fetchNOAAData() {
    try {
        // Fetch planetary K-index (current)
        const kpRes = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        const kpIndex = kpRes.data.slice(1); // Remove header, array of [time, kp, ...]

        // Fetch solar wind plasma
        const windRes = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json');
        const solarWind = windRes.data[windRes.data.length - 1]; // Last entry: [time, density, speed, temp]

        // Fetch solar flares
        const flaresRes = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json');
        const solarFlares = flaresRes.data.map(flare => ({
            ...flare,
            class_type: flare.flare_class // Alias for dashboard compatibility
        }));

        return { kpIndex, solarWind, solarFlares };
    } catch (error) {
        throw error;
    }
}

async function fetchAuroraData() {
    try {
        // Fetch ovation for raw data
        const ovationRes = await axios.get('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
        const coordinates = ovationRes.data.coordinates || [];

        // Estimate max probability (aurora value is 0-100 probability)
        const maxAurora = coordinates.reduce((max, coord) => Math.max(max, coord[2]), 0);

        // Fetch forecasted Kp
        const forecastRes = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
        const forecastData = forecastRes.data.slice(1); // Remove header
        const forecastKp = parseFloat(forecastData[0][1]) || 0; // First forecast

        // Derive probability and bestViewing based on forecastKp and maxAurora
        let probability = 'Low';
        if (maxAurora > 70 || forecastKp > 6) probability = 'High';
        else if (maxAurora > 30 || forecastKp > 4) probability = 'Medium';

        let bestViewing = 'Not favorable';
        if (forecastKp > 6) bestViewing = 'Visible at mid-latitudes';
        else if (forecastKp > 4) bestViewing = 'Visible at high latitudes';
        else bestViewing = 'Limited visibility';

        return {
            forecast: `Current forecast Kp: ${forecastKp.toFixed(1)}. Aurora probability: ${probability}.`,
            kpIndex: forecastKp,
            updated: new Date().toISOString(),
            source: 'NOAA Aurora Forecast',
            probability,
            bestViewing
        };
    } catch (error) {
        throw error;
    }
}

async function fetchXrayData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json');
        const data = res.data;
        // Filter for long wavelength (0.1-0.8 nm)
        const longWaveEntries = data.filter(d => d.energy === '0.1-0.8 nm');
        if (longWaveEntries.length === 0) throw new Error('No long wave data');
        const last = longWaveEntries[longWaveEntries.length - 1];
        const flux = last.flux;
        let flareClass = 'A';
        let magnitude = (flux * 1e8).toFixed(1); // For A class, but adjust
        if (flux >= 1e-7) { flareClass = 'B'; magnitude = (flux * 1e7).toFixed(1); }
        if (flux >= 1e-6) { flareClass = 'C'; magnitude = (flux * 1e6).toFixed(1); }
        if (flux >= 1e-5) { flareClass = 'M'; magnitude = (flux * 1e5).toFixed(1); }
        if (flux >= 1e-4) { flareClass = 'X'; magnitude = (flux * 1e4).toFixed(1); }
        const current = `${flareClass}${magnitude}`;
        return { current, class: flareClass, numeric: parseFloat(magnitude) };
    } catch (error) {
        throw error;
    }
}

async function fetchDstData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/products/kyoto-dst.json');
        const data = res.data.slice(1); // Remove header
        if (data.length === 0) throw new Error('No Dst data');
        const last = data[data.length - 1];
        const current = parseInt(last[1], 10);
        // Derive stormLevel
        const absDst = Math.abs(current);
        let stormLevel = 'Quiet';
        if (absDst > 100) stormLevel = 'Extreme Storm';
        else if (absDst > 50) stormLevel = 'Strong Storm';
        else if (absDst > 30) stormLevel = 'Moderate Storm';
        return { current, stormLevel };
    } catch (error) {
        throw error;
    }
}

async function fetchNews() {
    try {
        const res = await axios.get('https://api.spaceflightnewsapi.net/v4/articles/?limit=5');
        return res.data.results.map(item => ({
            title: item.title,
            link: item.url,
            source: item.news_site,
            date: item.published_at
        }));
    } catch (error) {
        throw error;
    }
}

async function updateMeteorData() {
    try {
        const currentDate = new Date();
        let current = 2; // Default low
        let activity = 'Low';
        let description = 'Sporadic meteors only';
        let activeShowers = [];

        // Geminids: Dec 4-17
        if (currentDate.getMonth() === 11 && currentDate.getDate() >= 4 && currentDate.getDate() <= 17) {
            current = 8;
            activity = 'High';
            description = 'Geminids shower active';
            activeShowers.push({ name: 'Geminids', zhr: 150, peak: 'Dec 13-14' });
        }

        // Add more showers as needed, e.g., Quadrantids Jan 1-5, Perseids Aug 9-14, etc.

        return { 
            current,
            activity,
            description,
            updated: currentDate.toISOString(),
            activeShowers
        };
    } catch (error) {
        throw error;
    }
}

async function updateSystemStatus(allData) {
    try {
        const status = {
            xray: allData.xray ? allData.xray.current : 'unknown',
            dst: allData.dst ? allData.dst.current : 'unknown',
            status: 'Online', // Can add logic for errors
            lastUpdate: new Date().toISOString()
        };
        await saveData('status.json', status);
        return status;
    } catch (error) {
        throw error;
    }
}

// Main update function
async function updateAllData() {
    console.log('🚀 Starting enhanced space weather data update...');
    console.log('Time:', new Date().toISOString());
    
    try {
        // Fetch all data in parallel
        const [
            noaaResult,
            auroraResult,
            xrayResult,
            dstResult,
            newsResult,
            meteorResult
        ] = await Promise.allSettled([
            fetchNOAAData(),
            fetchAuroraData(),
            fetchXrayData(),
            fetchDstData(),
            fetchNews(),
            updateMeteorData()
        ]);
        
        // Extract values from Promise results
        const allData = {
            noaa: noaaResult.status === 'fulfilled' ? noaaResult.value : null,
            aurora: auroraResult.status === 'fulfilled' ? auroraResult.value : null,
            xray: xrayResult.status === 'fulfilled' ? xrayResult.value : null,
            dst: dstResult.status === 'fulfilled' ? dstResult.value : null,
            news: newsResult.status === 'fulfilled' ? newsResult.value : null,
            meteor: meteorResult.status === 'fulfilled' ? meteorResult.value : null
        };
        
        // Save individual data files
        if (allData.noaa) await saveData('noaa.json', allData.noaa);
        if (allData.aurora) await saveData('aurora.json', allData.aurora);
        if (allData.xray) await saveData('xray.json', allData.xray);
        if (allData.dst) await saveData('dst.json', allData.dst);
        if (allData.news) await saveData('news.json', allData.news);
        if (allData.meteor) await saveData('meteor.json', allData.meteor);
        
        const statusData = await updateSystemStatus(allData);
        
        console.log('📊 Update Summary:');
        console.log(`   - NOAA Data: ${noaaResult.status === 'fulfilled' ? '✓' : '✗'}`);
        console.log(`   - Aurora Forecast: ${auroraResult.status === 'fulfilled' ? '✓' : '✗'}`);
        console.log(`   - X-ray Flux: ${xrayResult.status === 'fulfilled' ? xrayResult.value.current : '✗'}`);
        console.log(`   - Dst Index: ${dstResult.status === 'fulfilled' ? dstResult.value.current + ' nT' : '✗'}`);
        console.log(`   - News Items: ${newsResult.status === 'fulfilled' ? newsResult.value.length : 0}`);
        console.log(`   - Meteor Activity: ${meteorResult.status === 'fulfilled' ? meteorResult.value.current + '/10' : '✗'}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Critical error updating data:', error);
        return false;
    }
}

if (require.main === module) {
    updateAllData().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { updateAllData };
