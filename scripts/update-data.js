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

        return { 
            kpIndex, 
            solarWind, 
            solarFlares,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('NOAA fetch error:', error.message);
        return null;
    }
}

// ==== Aurora Data ====
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

// ==== X-ray Data (matches xray-data.json format) ====
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
        return { 
            current, 
            class: flareClass, 
            numeric: parseFloat(magnitude),
            updated: new Date().toISOString() 
        };
    } catch (error) {
        console.error('Xray fetch error:', error.message);
        return null;
    }
}

// ==== DST Data (matches dst.json format) ====
async function fetchDstData() {
    try {
        const res = await axios.get('https://services.swpc.noaa.gov/products/kyoto-dst.json');
        const data = res.data.slice(1);
        if (data.length === 0) return null;
        const current = parseInt(data[data.length - 1][1], 10);
        const absDst = Math.abs(current);
        let stormLevel = absDst > 100 ? 'Extreme' : absDst > 50 ? 'Strong' : absDst > 30 ? 'Moderate' : 'Quiet';
        return { 
            current, 
            stormLevel,
            updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Dst fetch error:', error.message);
        return null;
    }
}

// ==== News Data (matches news.json format) ====
async function fetchNews() {
    try {
        const res = await axios.get('https://api.spaceflightnewsapi.net/v4/articles/?limit=5');
        const articles = res.data.results.map(item => ({
            title: item.title,
            link: item.url,
            source: item.news_site,
            date: item.published_at,
            summary: item.summary || ''
        }));
        
        return {
            articles,
            updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('News fetch error:', error.message);
        return { articles: [], updated: new Date().toISOString() };
    }
}

// ==== Meteor Showers ====
async function updateMeteorData() {
    try {
        // Current date for calculations
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Major meteor showers data (simplified)
        const meteorShowers = [
            {
                name: "Quadrantids",
                peakDate: `${currentYear}-01-03`,
                zhr: "120",
                activePeriod: "Dec 28 - Jan 12",
                constellation: "Boötes",
                description: "Known for bright fireballs"
            },
            {
                name: "Lyrids",
                peakDate: `${currentYear}-04-22`,
                zhr: "18",
                activePeriod: "Apr 16 - Apr 25",
                constellation: "Lyra",
                description: "Medium brightness, fast meteors"
            },
            {
                name: "Eta Aquariids",
                peakDate: `${currentYear}-05-06`,
                zhr: "50",
                activePeriod: "Apr 19 - May 28",
                constellation: "Aquarius",
                description: "Fast and bright, from Halley's Comet"
            },
            {
                name: "Perseids",
                peakDate: `${currentYear}-08-12`,
                zhr: "100",
                activePeriod: "Jul 17 - Aug 24",
                constellation: "Perseus",
                description: "Most popular shower, bright and numerous"
            },
            {
                name: "Orionids",
                peakDate: `${currentYear}-10-21`,
                zhr: "20",
                activePeriod: "Oct 2 - Nov 7",
                constellation: "Orion",
                description: "Fast meteors from Halley's Comet"
            },
            {
                name: "Leonids",
                peakDate: `${currentYear}-11-17`,
                zhr: "15",
                activePeriod: "Nov 6 - Nov 30",
                constellation: "Leo",
                description: "Known for meteor storms every 33 years"
            },
            {
                name: "Geminids",
                peakDate: `${currentYear}-12-14`,
                zhr: "150",
                activePeriod: "Dec 4 - Dec 17",
                constellation: "Gemini",
                description: "Most reliable and active shower"
            },
            {
                name: "Ursids",
                peakDate: `${currentYear}-12-22`,
                zhr: "10",
                activePeriod: "Dec 17 - Dec 26",
                constellation: "Ursa Minor",
                description: "Minor shower, sometimes produces outbursts"
            }
        ];

        // Find upcoming showers
        const upcoming = meteorShowers
            .filter(shower => new Date(shower.peakDate) >= now)
            .slice(0, 3);

        return {
            majorShowers: meteorShowers,
            upcoming,
            updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Meteor data error:', error.message);
        return {
            majorShowers: [],
            upcoming: [],
            updated: new Date().toISOString()
        };
    }
}

// ==== Moon Phase ====
function getMoonPhase() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    // Simplified moon phase calculation
    const phases = [
        "New Moon",
        "Waxing Crescent", 
        "First Quarter",
        "Waxing Gibbous",
        "Full Moon",
        "Waning Gibbous",
        "Last Quarter",
        "Waning Crescent"
    ];
    
    // Calculate approximate phase index (0-7)
    // This is a simplified calculation
    const dayInCycle = (year * 12 + month + day) % 29.53;
    const phaseIndex = Math.floor((dayInCycle / 29.53) * 8);
    
    return {
        phase: phases[phaseIndex % 8],
        illumination: Math.round((Math.sin((dayInCycle / 29.53) * Math.PI) + 1) * 50),
        age: Math.round(dayInCycle),
        updated: new Date().toISOString()
    };
}

// ==== Satellite Data ====
async function fetchSatelliteData() {
    try {
        // Using CelesTrak for satellite data
        const res = await axios.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json');
        const satellites = res.data.slice(0, 10).map(sat => ({
            name: sat.OBJECT_NAME,
            id: sat.OBJECT_ID,
            epoch: sat.EPOCH,
            meanMotion: sat.MEAN_MOTION,
            inclination: sat.INCLINATION
        }));

        // Get ISS location
        const issRes = await axios.get('https://api.wheretheiss.at/v1/satellites/25544');
        const issData = issRes.data;

        return {
            starlink: satellites,
            iss: {
                latitude: issData.latitude,
                longitude: issData.longitude,
                altitude: issData.altitude,
                velocity: issData.velocity,
                visibility: issData.visibility
            },
            updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Satellite fetch error:', error.message);
        return {
            starlink: [],
            iss: {},
            updated: new Date().toISOString()
        };
    }
}

// ==== Comet Data ====
async function fetchCometData() {
    try {
        // Using Minor Planet Center data (simplified for example)
        // In production, you might use a different API
        const comets = [
            {
                name: "12P/Pons-Brooks",
                period: "71 years",
                nextPerihelion: "2024-04-21",
                magnitude: "4.5",
                constellation: "Andromeda",
                description: "Periodic comet known for outbursts"
            },
            {
                name: "C/2023 A3 (Tsuchinshan-ATLAS)",
                period: "~80,000 years",
                nextPerihelion: "2024-09-27",
                magnitude: "0.5",
                constellation: "Leo",
                description: "Potentially bright comet in 2024"
            },
            {
                name: "144P/Kushida",
                period: "7.6 years",
                nextPerihelion: "2024-01-25",
                magnitude: "8.5",
                constellation: "Taurus",
                description: "Periodic comet visible in telescopes"
            }
        ];

        return {
            comets,
            updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Comet fetch error:', error.message);
        return {
            comets: [],
            updated: new Date().toISOString()
        };
    }
}

// ==== Update Status ====
async function updateStatusFile(allData) {
    const status = {
        lastUpdate: new Date().toISOString(),
        dataStatus: {
            noaa: allData.noaa ? 'OK' : 'FAILED',
            aurora: allData.aurora ? 'OK' : 'FAILED',
            xray: allData.xray ? 'OK' : 'FAILED',
            dst: allData.dst ? 'OK' : 'FAILED',
            news: allData.news ? 'OK' : 'FAILED',
            meteor: allData.meteor ? 'OK' : 'FAILED',
            moon: 'OK',
            satellites: allData.satellites ? 'OK' : 'FAILED',
            comets: allData.comets ? 'OK' : 'FAILED'
        },
        systemStatus: 'Online'
    };

    await saveData('update-status.json', status);
    return status;
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

// ==== Main Update Function ====
async function updateAllData() {
    console.log('🚀 Starting full space weather + sky data update...');
    console.log('Time:', new Date().toISOString());

    try {
        // Fetch all data in parallel
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

        // Extract results
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

        // Save all data files
        await Promise.all([
            allData.noaa && saveData('noaa.json', allData.noaa),
            saveData('aurora.json', allData.aurora || {}),
            saveData('xray-data.json', allData.xray || {}), // Note: xray-data.json not xray.json
            saveData('dst.json', allData.dst || {}),
            saveData('news.json', allData.news || { articles: [] }),
            saveData('meteor.json', allData.meteor || {}),
            saveData('moon.json', allData.moon),
            saveData('satellites.json', allData.satellites || {}),
            saveData('comets.json', allData.comets || {})
        ]);

        // Update status files
        await updateSystemStatus(allData);
        await updateStatusFile(allData);

        console.log('📊 All data updated successfully');
        return true;
    } catch (error) {
        console.error('❌ Critical error updating data:', error);
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    updateAllData().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { updateAllData };
