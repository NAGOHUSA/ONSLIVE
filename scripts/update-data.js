const fs = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

async function fetchData() {
    console.log('🚀 Fetching space weather data...');
    
    try {
        // 1. Fetch NOAA data
        console.log('📡 Fetching NOAA data...');
        let solarFlares = [];
        let kpIndex = [];
        let solarWind = {};
        
        try {
            const flareResponse = await axios.get('https://services.swpc.noaa.gov/json/solar-flare.json', { timeout: 10000 });
            solarFlares = flareResponse.data.slice(0, 10);
            console.log(`✅ Found ${solarFlares.length} solar flares`);
        } catch (error) {
            console.log('⚠️ Could not fetch solar flares');
        }
        
        try {
            const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 10000 });
            kpIndex = kpResponse.data.slice(-24);
            console.log(`✅ Got ${kpIndex.length} Kp readings`);
        } catch (error) {
            console.log('⚠️ Could not fetch Kp index');
        }
        
        try {
            const windResponse = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', { timeout: 10000 });
            if (windResponse.data.length > 0) {
                solarWind = windResponse.data[windResponse.data.length - 1];
            }
            console.log('✅ Got solar wind data');
        } catch (error) {
            console.log('⚠️ Could not fetch solar wind');
        }
        
        // Save NOAA data
        fs.writeFileSync(
            path.join(dataDir, 'noaa-data.json'),
            JSON.stringify({
                solarFlares,
                kpIndex,
                solarWind,
                updated: new Date().toISOString(),
                source: 'NOAA SWPC'
            }, null, 2)
        );
        
        // 2. Fetch news (simplified)
        console.log('📰 Fetching news...');
        let newsItems = [];
        try {
            const rssResponse = await axios.get('https://www.nasa.gov/rss/dyn/breaking_news.rss', { timeout: 10000 });
            const rssText = rssResponse.data;
            
            // Very simple RSS parsing
            const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<description>(.*?)<\/description>/g;
            let match;
            while ((match = itemRegex.exec(rssText)) !== null && newsItems.length < 5) {
                newsItems.push({
                    title: match[1],
                    link: match[2],
                    date: match[3],
                    source: 'NASA',
                    summary: match[4].replace(/<[^>]*>/g, '').substring(0, 150) + '...'
                });
            }
            console.log(`✅ Got ${newsItems.length} news items`);
        } catch (error) {
            console.log('⚠️ Could not fetch news');
        }
        
        // Save news
        fs.writeFileSync(
            path.join(dataDir, 'news.json'),
            JSON.stringify(newsItems, null, 2)
        );
        
        // 3. Create aurora data
        const auroraData = {
            forecast: kpIndex.length > 0 
                ? `Current Kp index is ${kpIndex[kpIndex.length - 1].kp}. Aurora activity is ${kpIndex[kpIndex.length - 1].kp >= 5 ? 'elevated' : 'normal'}.`
                : "Aurora forecast data is currently updating.",
            updated: new Date().toISOString(),
            source: 'NOAA Space Weather'
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'aurora.json'),
            JSON.stringify(auroraData, null, 2)
        );
        
        // 4. Create status file
        const statusData = {
            lastUpdate: new Date().toISOString(),
            status: 'success',
            message: 'All data updated successfully',
            timestamp: Date.now(),
            dataSources: ['NOAA SWPC', 'NASA']
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'update-status.json'),
            JSON.stringify(statusData, null, 2)
        );
        
        console.log('✅ All data files created successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
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
    }
}

fetchData();
