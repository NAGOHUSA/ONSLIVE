const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, 'data');

// FIX: Proper synchronous directory creation
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

// Fetch functions
async function fetchNOAAData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/json/solar_probabilities.json');
        return res.data;
    } catch (error) {
        throw error;
    }
}

async function fetchAuroraData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
        return res.data;
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
        let magnitude = (flux / 1e-8).toFixed(1);
        if (flux >= 1e-7) { flareClass = 'B'; magnitude = (flux / 1e-7).toFixed(1); }
        if (flux >= 1e-6) { flareClass = 'C'; magnitude = (flux / 1e-6).toFixed(1); }
        if (flux >= 1e-5) { flareClass = 'M'; magnitude = (flux / 1e-5).toFixed(1); }
        if (flux >= 1e-4) { flareClass = 'X'; magnitude = (flux / 1e-4).toFixed(1); }
        const current = `${flareClass}${magnitude}`;
        return { current };
    } catch (error) {
        throw error;
    }
}

async function fetchDstData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/products/kyoto-dst.json');
        const data = res.data;
        if (data.length === 0) throw new Error('No Dst data');
        const last = data[data.length - 1];
        const current = parseInt(last[1], 10);
        return { current };
    } catch (error) {
        throw error;
    }
}

async function fetchNews() {
    try {
        const res = await axios.get('https://api.spaceflightnewsapi.net/v4/articles/?limit=5');
        return res.data.results;
    } catch (error) {
        throw error;
    }
}

async function updateMeteorData() {
    try {
        const currentDate = new Date();
        let current = 2; // Default low activity
        // Example: High during known showers like Geminids (Dec 4-17)
        if (currentDate.getMonth() === 11 && currentDate.getDate() >= 4 && currentDate.getDate() <= 17) {
            current = 8;
        }
        // Add more showers if needed (e.g., Perseids in Aug, etc.)
        return { current };
    } catch (error) {
        throw error;
    }
}

async function updateSystemStatus(allData) {
    try {
        const status = {
            xray: allData.xray ? allData.xray.current : 'unknown',
            dst: allData.dst ? allData.dst.current : 'unknown',
            // Add more aggregated status as needed
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
