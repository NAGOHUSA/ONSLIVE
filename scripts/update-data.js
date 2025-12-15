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

// [All your existing fetch functions remain exactly the same...]
// fetchNOAAData(), fetchAuroraData(), fetchXrayData(), 
// fetchDstData(), fetchNews(), updateMeteorData()...

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
            noaa: noaaData.value,
            aurora: auroraData.value,
            xray: xrayData.value,
            dst: dstData.value,
            news: newsData.value,
            meteor: meteorData.value
        };
        
        const statusData = await updateSystemStatus(allData);
        
        console.log('📊 Update Summary:');
        console.log(`   - NOAA Data: ${noaaData.status === 'fulfilled' ? '✓' : '✗'}`);
        console.log(`   - Aurora Forecast: ${auroraData.status === 'fulfilled' ? '✓' : '✗'}`);
        console.log(`   - X-ray Flux: ${xrayData.status === 'fulfilled' ? xrayData.value.current : '✗'}`);
        console.log(`   - Dst Index: ${dstData.status === 'fulfilled' ? dstData.value.current + ' nT' : '✗'}`);
        console.log(`   - News Items: ${newsData.status === 'fulfilled' ? newsData.value.length : 0}`);
        console.log(`   - Meteor Activity: ${meteorData.status === 'fulfilled' ? meteorData.value.current + '/10' : '✗'}`);
        
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
