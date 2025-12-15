const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, '..', 'data'); // Note: ../ because script is in /scripts

// Ensure data directory exists (sync for startup)
if (!fsSync.existsSync(dataDir)) {
    fsSync.mkdirSync(dataDir, { recursive: true });
}

// Helper to save JSON files
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

// ==== NOAA / Space Weather Data ====
async function fetchNOAAData() {
    try {
        const kpRes = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        const kpIndex = kpRes.data.slice(1);

        const windRes = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json');
        const solarWind = windRes.data[windRes.data.length - 1];

        const flaresRes = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json');
        const solarFlares = flaresRes.data.map(flare => ({
            ...flare,
            class_type: flare.flare_class
        }));

        return { kpIndex, solarWind, solarFlares };
    } catch (error) {
        console.error('NOAA fetch error:', error.message);
        return null;
    }
}

async function fetchAuroraData() {
    try {
        const ovationRes = await axios.get('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
        const coordinates = ovationRes.data.coordinates || [];
        const maxAurora = coordinates.reduce((max, coord) => Math.max(max, coord[2]), 0);

        const forecastRes = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
        const forecastData = forecastRes.data.slice(1);
        const forecastKp = parseFloat(forecastData[0][1]) || 0;

        let probability = 'Low';
        if (maxAurora > 70 || forecastKp > 6) probability = 'High';
        else if (maxAurora > 30 || forecastKp > 4) probability = 'Medium';

        let bestViewing = forecastKp > 6 ? 'Mid-latitudes' : forecastKp > 4 ? 'High latitudes' : 'Polar regions';

        return {
            forecastKp,
            probability,
            bestViewing,
            updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Aurora fetch error:', error.message);
        return null;
    }
}

async function fetchXrayData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json');
        const data = res.data;
        const longWave = data.filter(d => d.energy === '0.1-0.8 nm');
        if (longWave.length === 0) return null;
        const last = longWave[longWave.length - 1];
        const flux = last.flux;

        let flareClass = 'A';
        let magnitude = (flux * 1e8).toFixed(1);
        if (flux >= 1e-7) { flareClass = 'B'; magnitude = (flux * 1e7).toFixed(1); }
        if (flux >= 1e-6) { flareClass = 'C'; magnitude = (flux * 1e6).toFixed(1); }
        if (flux >= 1e-5) { flareClass = 'M'; magnitude = (flux * 1e5).toFixed(1); }
        if (flux >= 1e-4) { flareClass = 'X'; magnitude = (flux * 1e4).toFixed(1); }

        const current = `${flareClass}${magnitude}`;
        return { current, class: flareClass, numeric: parseFloat(magnitude) };
    } catch (error) {
        console.error('Xray fetch error:', error.message);
        return null;
    }
}

async function fetchDstData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/products/kyoto-dst.json');
        const data = res.data.slice(1);
        if (data.length === 0) return null;
        const current = parseInt(data[data.length - 1][1], 10);
        const absDst = Math.abs(current);
        let stormLevel = absDst > 100 ? 'Extreme' : absDst > 50 ? 'Strong' : absDst > 30 ? 'Moderate' : 'Quiet';
        return { current, stormLevel };
    } catch (error) {
        console.error('Dst fetch error:', error.message);
        return null;
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
        console.error('News fetch error:', error.message);
        return [];
    }
}

// ==== Meteor Showers (with minor showers) ====
async function updateMeteorData() {
    // ... (use the latest full version with minor showers from previous message)
    // Paste the entire function here exactly as provided earlier
}

// ==== Moon Phase ====
function getMoonPhase() {
    // ... (use the full getMoonPhase function from the previous full file)
}

// ==== Satellites ====
async function fetchSatelliteData() {
    // ... (use the full fetchSatelliteData function)
}

// ==== Comets ====
async function fetchCometData() {
    // ... (use the full fetchCometData function)
}

// ==== System Status ====
async function updateSystemStatus(allData) {
    const status = {
        xray: allData.xray?.current || 'unknown',
        dst: allData.dst?.current || 'unknown',
        lastUpdate: new Date().toISOString(),
        status: 'Online'
    };
    await saveData('status.json', status);
    return status;
}

// ==== Main Update ====
async function updateAllData() {
    console.log('🚀 Starting full space weather + sky data update...');
    console.log('Time:', new Date().toISOString());

    try {
        const results = await Promise.allSettled([
            fetchNOAAData(),
            fetchAuroraData(),
            fetchXrayData(),
            fetchDstData(),
            fetchNews(),
            updateMeteorData(),
            Promise.resolve(getMoonPhase()),
            fetchSatelliteData(),
            fetchCometData()
        ]);

        const allData = {
            noaa: results[0].status === 'fulfilled' ? results[0].value : null,
            aurora: results[1].status === 'fulfilled' ? results[1].value : null,
            xray: results[2].status === 'fulfilled' ? results[2].value : null,
            dst: results[3].status === 'fulfilled' ? results[3].value : null,
            news: results[4].status === 'fulfilled' ? results[4].value : null,
            meteor: results[5].status === 'fulfilled' ? results[5].value : null,
            moon: results[6].value,
            satellites: results[7].status === 'fulfilled' ? results[7].value : null,
            comets: results[8].status === 'fulfilled' ? results[8].value : null
        };

        await Promise.all([
            allData.noaa && saveData('noaa.json', allData.noaa),
            allData.aurora && saveData('aurora.json', allData.aurora),
            allData.xray && saveData('xray.json', allData.xray),
            allData.dst && saveData('dst.json', allData.dst),
            saveData('news.json', allData.news || []),
            saveData('meteor.json', allData.meteor || {}),
            saveData('moon.json', allData.moon),
            saveData('satellites.json', allData.satellites || {}),
            saveData('comets.json', allData.comets || {})
        ]);

        await updateSystemStatus(allData);

        console.log('📊 All data updated successfully');
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
