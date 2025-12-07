const fs = require('fs');
const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser();

async function fetchNOAAData() {
    try {
        // Fetch solar flare data
        const flareResponse = await axios.get('https://services.swpc.noaa.gov/json/solar-flare.json');
        fs.writeFileSync('data/solar-flares.json', JSON.stringify(flareResponse.data));
        
        // Fetch Kp index
        const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        fs.writeFileSync('data/kp-index.json', JSON.stringify(kpResponse.data));
        
        // Fetch solar wind
        const windResponse = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json');
        fs.writeFileSync('data/solar-wind.json', JSON.stringify(windResponse.data));
        
    } catch (error) {
        console.error('Error fetching NOAA data:', error);
    }
}

async function fetchNews() {
    try {
        const nasaFeed = await parser.parseURL('https://www.nasa.gov/rss/dyn/breaking_news.rss');
        const spaceWeatherFeed = await parser.parseURL('https://www.spaceweather.com/rss.php');
        
        const newsItems = [
            ...nasaFeed.items.slice(0, 5),
            ...spaceWeatherFeed.items.slice(0, 5)
        ].map(item => ({
            title: item.title,
            link: item.link,
            date: item.pubDate || item.isoDate,
            source: item.feed.name || 'NASA'
        }));
        
        fs.writeFileSync('data/news.json', JSON.stringify(newsItems));
    } catch (error) {
        console.error('Error fetching news:', error);
    }
}

async function fetchAuroraData() {
    try {
        const response = await axios.get('https://auroraservice.live/api/aurora-forecast');
        fs.writeFileSync('data/aurora-forecast.json', JSON.stringify(response.data));
    } catch (error) {
        console.error('Error fetching aurora data:', error);
    }
}

async function updateAllData() {
    console.log('Updating space weather data...');
    await Promise.all([
        fetchNOAAData(),
        fetchNews(),
        fetchAuroraData()
    ]);
    console.log('Data update complete!');
}

updateAllData();
