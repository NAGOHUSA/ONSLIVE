const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Parser = require('rss-parser');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const parser = new Parser();

async function fetchWithTimeout(url, timeout = 10000) {
    const source = axios.CancelToken.source();
    const timeoutId = setTimeout(() => {
        source.cancel(`Timeout after ${timeout}ms`);
    }, timeout);

    try {
        const response = await axios.get(url, {
            cancelToken: source.token,
            headers: {
                'User-Agent': 'live.ournightsky.us Space Weather Dashboard'
            }
        });
        clearTimeout(timeoutId);
        return response.data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (axios.isCancel(error)) {
            throw new Error(`Request canceled: ${error.message}`);
        }
        throw error;
    }
}

async function fetchNOAAData() {
    console.log('📡 Fetching NOAA data...');
    
    const noaaData = {};
    
    try {
        // Fetch solar flare data (last 24 hours)
        const flareData = await fetchWithTimeout('https://services.swpc.noaa.gov/json/solar-flare.json');
        noaaData.solarFlares = flareData.filter(flare => {
            const flareTime = new Date(flare.begin_time);
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return flareTime > yesterday;
        }).slice(0, 10); // Last 10 flares
        
        console.log(`✓ Found ${noaaData.solarFlares.length} recent solar flares`);
    } catch (error) {
        console.warn('⚠️ Could not fetch solar flare data:', error.message);
        noaaData.solarFlares = [];
    }
    
    try {
        // Fetch Kp index (last 24 hours)
        const kpData = await fetchWithTimeout('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        noaaData.kpIndex = kpData.slice(-24); // Last 24 hours
        
        console.log(`✓ Kp index data: ${noaaData.kpIndex.length} entries`);
    } catch (error) {
        console.warn('⚠️ Could not fetch Kp index:', error.message);
        noaaData.kpIndex = [];
    }
    
    try {
        // Fetch solar wind (latest)
        const windData = await fetchWithTimeout('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json');
        noaaData.solarWind = windData.slice(-1)[0] || {};
        
        if (noaaData.solarWind.speed) {
            console.log(`✓ Solar wind speed: ${noaaData.solarWind.speed} km/s`);
        }
    } catch (error) {
        console.warn('⚠️ Could not fetch solar wind:', error.message);
        noaaData.solarWind = {};
    }
    
    // Save NOAA data
    fs.writeFileSync(
        path.join(dataDir, 'noaa-data.json'),
        JSON.stringify({
            ...noaaData,
            updated: new Date().toISOString(),
            source: 'NOAA SWPC'
        }, null, 2)
    );
    
    return noaaData;
}

async function fetchNews() {
    console.log('📰 Fetching space news...');
    
    const newsItems = [];
    
    // NASA news
    try {
        const nasaFeed = await parser.parseURL('https://www.nasa.gov/rss/dyn/breaking_news.rss');
        nasaFeed.items.slice(0, 3).forEach(item => {
            newsItems.push({
                title: item.title,
                link: item.link,
                date: item.pubDate || item.isoDate,
                source: 'NASA',
                summary: item.contentSnippet?.substring(0, 200) || ''
            });
        });
        console.log('✓ NASA news fetched');
    } catch (error) {
        console.warn('⚠️ Could not fetch NASA news:', error.message);
    }
    
    // SpaceWeather.com
    try {
        const swFeed = await parser.parseURL('https://www.spaceweather.com/rss.php');
        swFeed.items.slice(0, 3).forEach(item => {
            newsItems.push({
                title: item.title,
                link: item.link,
                date: item.pubDate || item.isoDate,
                source: 'SpaceWeather.com',
                summary: item.contentSnippet?.substring(0, 200) || ''
            });
        });
        console.log('✓ SpaceWeather.com news fetched');
    } catch (error) {
        console.warn('⚠️ Could not fetch SpaceWeather.com news:', error.message);
    }
    
    // Sort by date (newest first) and limit to 5 items
    newsItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const newsData = {
        items: newsItems.slice(0, 5),
        updated: new Date().toISOString(),
        total: newsItems.length
    };
    
    fs.writeFileSync(
        path.join(dataDir, 'news.json'),
        JSON.stringify(newsData, null, 2)
    );
    
    console.log(`✓ Total news items: ${newsItems.length}`);
    return newsData;
}

async function fetchAuroraData() {
    console.log('🌌 Fetching aurora data...');
    
    try {
        // Get aurora forecast from NOAA
        const forecastText = await fetchWithTimeout('https://services.swpc.noaa.gov/text/3-day-forecast.txt');
        
        const auroraData = {
            forecast: forecastText.substring(0, 1000),
            updated: new Date().toISOString(),
            source: 'NOAA 3-Day Forecast'
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'aurora.json'),
            JSON.stringify(auroraData, null, 2)
        );
        
        console.log('✓ Aurora forecast fetched');
        return auroraData;
    } catch (error) {
        console.warn('⚠️ Could not fetch aurora data:', error.message);
        
        // Fallback data
        const fallbackData = {
            forecast: "Aurora data currently unavailable. Please check back later.",
            updated: new Date().toISOString(),
            source: 'Dashboard'
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'aurora.json'),
            JSON.stringify(fallbackData, null, 2)
        );
        
        return fallbackData;
    }
}

async function updateAllData() {
    console.log('🚀 Starting space weather data update...');
    console.log(`📅 ${new Date().toUTCString()}`);
    
    try {
        await Promise.allSettled([
            fetchNOAAData(),
            fetchNews(),
            fetchAuroraData()
        ]);
        
        // Create a summary file
        const summary = {
            lastUpdate: new Date().toISOString(),
            status: 'success',
            message: 'Data updated successfully'
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'update-status.json'),
            JSON.stringify(summary, null, 2)
        );
        
        console.log('✅ All data updated successfully!');
        
    } catch (error) {
        console.error('❌ Error during data update:', error);
        
        // Create error status file
        const errorStatus = {
            lastUpdate: new Date().toISOString(),
            status: 'error',
            message: error.message
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'update-status.json'),
            JSON.stringify(errorStatus, null, 2)
        );
        
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    updateAllData();
}

module.exports = { updateAllData };
