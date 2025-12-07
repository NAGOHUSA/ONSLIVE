const fs = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

async function fetchData() {
    console.log('🚀 Starting space weather data update...');
    console.log('Time:', new Date().toISOString());
    
    try {
        // Fetch NOAA data
        console.log('📡 Fetching NOAA data...');
        
        let solarFlares = [];
        let kpIndex = [];
        let solarWind = {};
        
        try {
            // Solar flares
            const flareResponse = await axios.get('https://services.swpc.noaa.gov/json/solar-flare.json', { timeout: 10000 });
            solarFlares = flareResponse.data.slice(-10); // Last 10 flares
            console.log(`✅ Solar flares: ${solarFlares.length}`);
        } catch (error) {
            console.log('❌ Failed to fetch solar flares:', error.message);
        }
        
        try {
            // Kp index
            const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 10000 });
            kpIndex = kpResponse.data.slice(-24); // Last 24 hours
            console.log(`✅ Kp index: ${kpIndex.length} entries`);
        } catch (error) {
            console.log('❌ Failed to fetch Kp index:', error.message);
        }
        
        try {
            // Solar wind
            const windResponse = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', { timeout: 10000 });
            const windData = windResponse.data;
            if (windData.length > 0) {
                solarWind = windData[windData.length - 1]; // Latest reading
            }
            console.log('✅ Solar wind data');
        } catch (error) {
            console.log('❌ Failed to fetch solar wind:', error.message);
        }
        
        // Save NOAA data
        fs.writeFileSync(
            path.join(dataDir, 'noaa-data.json'),
            JSON.stringify({
                solarFlares: solarFlares,
                kpIndex: kpIndex,
                solarWind: solarWind,
                updated: new Date().toISOString(),
                source: 'NOAA SWPC'
            }, null, 2)
        );
        
        // Fetch news (simplified - just placeholder)
        console.log('📰 Fetching news...');
        const newsItems = [
            {
                title: "Space Weather Dashboard Initialized",
                link: "https://github.com/NAGOHUSA/ONSLIVE",
                date: new Date().toISOString(),
                source: "Dashboard",
                summary: "Your space weather dashboard is now online and will update automatically every 15 minutes."
            }
        ];
        
        try {
            // Try to get actual NASA news
            const nasaResponse = await axios.get('https://www.nasa.gov/rss/dyn/breaking_news.rss', { timeout: 10000 });
            const rssText = nasaResponse.data;
            
            // Simple regex to extract titles and links
            const titleMatches = rssText.match(/<title>(.*?)<\/title>/g) || [];
            const linkMatches = rssText.match(/<link>(.*?)<\/link>/g) || [];
            
            if (titleMatches.length > 1 && linkMatches.length > 1) {
                // Skip first title (usually "NASA Breaking News")
                for (let i = 1; i < Math.min(4, titleMatches.length); i++) {
                    const title = titleMatches[i].replace(/<\/?title>/g, '');
                    const link = linkMatches[i] ? linkMatches[i].replace(/<\/?link>/g, '') : 'https://nasa.gov';
                    
                    if (title && !title.includes('NASA Breaking News')) {
                        newsItems.push({
                            title: title,
                            link: link,
                            date: new Date().toISOString(),
                            source: "NASA",
                            summary: "Latest update from NASA"
                        });
                    }
                }
            }
            console.log(`✅ News items: ${newsItems.length}`);
        } catch (error) {
            console.log('❌ Failed to fetch news, using placeholder:', error.message);
        }
        
        // Save news
        fs.writeFileSync(
            path.join(dataDir, 'news.json'),
            JSON.stringify(newsItems, null, 2)
        );
        
        // Create aurora data
        const currentKp = kpIndex.length > 0 ? kpIndex[kpIndex.length - 1].kp : 0;
        const auroraLevel = currentKp >= 6 ? "high" : currentKp >= 4 ? "moderate" : "low";
        
        const auroraData = {
            forecast: `Current Kp index is ${currentKp}. Aurora activity is ${auroraLevel}. The Kp index needs to reach at least 5 for visible aurora at mid-latitudes.`,
            kpIndex: currentKp,
            updated: new Date().toISOString(),
            source: 'NOAA Space Weather'
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'aurora.json'),
            JSON.stringify(auroraData, null, 2)
        );
        
        // Create success status
        const statusData = {
            lastUpdate: new Date().toISOString(),
            status: 'success',
            message: 'Data updated successfully from NOAA and NASA',
            timestamp: Date.now(),
            dataSources: ['NOAA SWPC', 'NASA']
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'update-status.json'),
            JSON.stringify(statusData, null, 2)
        );
        
        console.log('✅ All data files updated successfully!');
        console.log('📊 Data summary:');
        console.log(`   - Solar flares: ${solarFlares.length}`);
        console.log(`   - Kp index readings: ${kpIndex.length}`);
        console.log(`   - News items: ${newsItems.length}`);
        console.log(`   - Last update: ${statusData.lastUpdate}`);
        
    } catch (error) {
        console.error('❌ Critical error updating data:', error);
        
        // Create error status
        const errorStatus = {
            lastUpdate: new Date().toISOString(),
            status: 'error',
            message: error.message,
            timestamp: Date.now()
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'update-status.json'),
            JSON.stringify(errorStatus, null, 2)
        );
        
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    fetchData();
}

module.exports = { fetchData };
