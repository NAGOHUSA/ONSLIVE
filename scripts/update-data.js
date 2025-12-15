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
        
        const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 10000 });
        const kpData = kpResponse.data.slice(-24);
        
        const windResponse = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', { timeout: 10000 });
        const windData = windResponse.data.slice(-1)[0] || [];
        
        const flareResponse = await axios.get('https://services.swpc.noaa.gov/json/goes-xray-flares.json', { timeout: 10000 });
        const flareData = flareResponse.data.slice(-5);
        
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
        return null;
    }
}

// [Include all your other fetch functions here: 
// fetchAuroraData, fetchXrayData, fetchDstData, 
// fetchNews, updateMeteorData, etc.]
// Make sure to copy ALL your original JavaScript functions

// Main update function
async function updateAllData() {
    console.log('🚀 Starting enhanced space weather data update...');
    console.log('Time:', new Date().toISOString());
    
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
        
        // Update system status
        const allData = {
            noaa: noaaData.value,
            aurora: auroraData.value,
            xray: xrayData.value,
            dst: dstData.value,
            news: newsData.value,
            meteor: meteorData.value
        };
        
        const statusData = {
            lastUpdate: new Date().toISOString(),
            status: 'success',
            message: 'All data sources updated successfully',
            timestamp: Date.now()
        };
        
        await saveData('update-status.json', statusData);
        
        console.log('✅ All data updated successfully!');
        console.log('📊 Summary:');
        console.log(`   - NOAA Data: ${noaaData.status === 'fulfilled' ? '✓' : '✗'}`);
        console.log(`   - Aurora Forecast: ${auroraData.status === 'fulfilled' ? '✓' : '✗'}`);
        
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
