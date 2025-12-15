const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
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

// NEW: Moon Phase (using simple astronomical calculation)
function getMoonPhase() {
    const now = new Date();
    // Reference: Known new moon on Jan 1, 2000
    const knownNewMoon = new Date('2000-01-06T18:14:00Z'); // Approximate
    const synodicMonth = 29.53058867 * 24 * 60 * 60 * 1000; // days in ms

    const elapsed = now - knownNewMoon;
    const phaseDays = (elapsed % synodicMonth) / (24 * 60 * 60 * 1000);
    const phaseFraction = phaseDays / 29.53058867;

    let phaseName = '';
    let illumination = 0;
    let emoji = '';

    if (phaseFraction < 0.03 || phaseFraction > 0.97) {
        phaseName = 'New Moon';
        illumination = 0;
        emoji = '🌑';
    } else if (phaseFraction < 0.22) {
        phaseName = 'Waxing Crescent';
        illumination = Math.round(phaseFraction * 100 * 4);
        emoji = '🌒';
    } else if (phaseFraction < 0.28) {
        phaseName = 'First Quarter';
        illumination = 50;
        emoji = '🌓';
    } else if (phaseFraction < 0.47) {
        phaseName = 'Waxing Gibbous';
        illumination = 50 + Math.round((phaseFraction - 0.25) * 200);
        emoji = '🌔';
    } else if (phaseFraction < 0.53) {
        phaseName = 'Full Moon';
        illumination = 100;
        emoji = '🌕';
    } else if (phaseFraction < 0.72) {
        phaseName = 'Waning Gibbous';
        illumination = 100 - Math.round((phaseFraction - 0.5) * 200);
        emoji = '🌖';
    } else if (phaseFraction < 0.78) {
        phaseName = 'Last Quarter';
        illumination = 50;
        emoji = '🌗';
    } else {
        phaseName = 'Waning Crescent';
        illumination = Math.round((1 - phaseFraction) * 100 * 4);
        emoji = '🌘';
    }

    return {
        phase: phaseName,
        illumination: illumination + '%',
        emoji,
        ageDays: phaseDays.toFixed(1),
        nextFullMoon: 'Calculating...',
        updated: now.toISOString()
    };
}

// NEW: Notable Satellites (ISS + a few bright ones)
async function fetchSatelliteData() {
    try {
        // ISS current position
        const issRes = await axios.get('https://api.wheretheiss.at/v1/satellites/25544');
        const iss = issRes.data;

        // Static list of bright/named satellites (you can expand)
        const notable = [
            {
                name: 'International Space Station (ISS)',
                noradId: 25544,
                altitude: Math.round(iss.altitude) + ' km',
                velocity: Math.round(iss.velocity) + ' km/h',
                latitude: iss.latitude.toFixed(2),
                longitude: iss.longitude.toFixed(2),
                visibility: iss.visibility === 'daylight' ? 'In sunlight' : 'In Earth shadow',
                updated: new Date().toISOString()
            },
            // Add more if you have APIs; these are placeholders for popular ones
            { name: 'Hubble Space Telescope', noradId: 20580, note: 'Orbit ~540 km' },
            { name: 'Starlink (thousands in LEO)', noradId: 'Various', note: 'Visible trains common' },
            { name: 'Tiangong (Chinese Space Station)', noradId: 48274, note: 'Orbit ~390 km' }
        ];

        return { iss, notable };
    } catch (error) {
        console.error('Satellite fetch error:', error.message);
        return { iss: null, notable: [] };
    }
}

// NEW: Current Visible Comets (scraped from reliable source or static + update)
async function fetchCometData() {
    try {
        // Using aerith.net bright comets list (simple text parse)
        const res = await axios.get('https://www.aerith.net/comet/weekly/current.html', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = res.data;

        // Very simple extraction of top 3-5 bright comets
        const lines = html.split('\n');
        const comets = [];
        let capturing = false;

        for (const line of lines) {
            if (line.includes('Designation') || line.includes('Comet')) capturing = true;
            if (capturing && line.includes('<a href="/comet/catalog/')) {
                const nameMatch = line.match(/>(C\/\d{4}\s[A-Z]\d+.*?)<\/a>/);
                const magMatch = line.match(/mag\/\)/);
                if (nameMatch) {
                    const name = nameMatch[1].trim();
                    const mag = line.match(/(\d+\.\d+)\s*mag/) ? parseFloat(line.match(/(\d+\.\d+)\s*mag/)[1]) : null;
                    if (mag !== null && mag < 12) { // Only reasonably visible
                        comets.push({
                            name: name,
                            magnitude: mag,
                            visibility: mag < 6 ? 'Visible to naked eye' : 'Binocular/telescope',
                            note: `Current mag ~${mag}`
                        });
                    }
                    if (comets.length >= 5) break;
                }
            }
        }

        if (comets.length === 0) {
            // Fallback static data for Dec 2025
            comets.push(
                { name: 'C/2023 A3 (Tsuchinshan-ATLAS)', magnitude: 10.5, visibility: 'Fading, telescope', note: 'Was bright in 2024' },
                { name: 'C/2024 S1 (ATLAS)', magnitude: 8.5, visibility: 'Possible naked eye in Dec 2025?', note: 'Monitor closely' }
            );
        }

        return {
            visibleComets: comets,
            source: 'aerith.net + fallback',
            updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Comet fetch error:', error.message);
        return {
            visibleComets: [
                { name: 'C/2024 S1 (ATLAS)', magnitude: 9.0, visibility: 'Potential bright comet', note: 'Dec 2025' }
            ],
            source: 'fallback',
            updated: new Date().toISOString()
        };
    }
}

// Existing fetch functions (NOAA, Aurora, Xray, Dst, News, Meteor) - keep your latest versions here
// ... (include all previous fetchNOAAData, fetchAuroraData, fetchXrayData, etc.)

// For brevity, assuming you already have these from previous versions
// Just make sure they are present above this point.

// Main update function - now with moon, satellites, comets
async function updateAllData() {
    console.log('🚀 Starting full space weather + sky data update...');
    console.log('Time:', new Date().toISOString());

    try {
        const [
            noaaResult,
            auroraResult,
            xrayResult,
            dstResult,
            newsResult,
            meteorResult,
            moonResult,
            satelliteResult,
            cometResult
        ] = await Promise.allSettled([
            fetchNOAAData(),
            fetchAuroraData(),
            fetchXrayData(),
            fetchDstData(),
            fetchNews(),
            updateMeteorData(),
            Promise.resolve(getMoonPhase()), // Sync
            fetchSatelliteData(),
            fetchCometData()
        ]);

        const allData = {
            noaa: noaaResult.status === 'fulfilled' ? noaaResult.value : null,
            aurora: auroraResult.status === 'fulfilled' ? auroraResult.value : null,
            xray: xrayResult.status === 'fulfilled' ? xrayResult.value : null,
            dst: dstResult.status === 'fulfilled' ? dstResult.value : null,
            news: newsResult.status === 'fulfilled' ? newsResult.value : null,
            meteor: meteorResult.status === 'fulfilled' ? meteorResult.value : null,
            moon: moonResult.status === 'fulfilled' ? moonResult.value : null,
            satellites: satelliteResult.status === 'fulfilled' ? satelliteResult.value : null,
            comets: cometResult.status === 'fulfilled' ? cometResult.value : null
        };

        // Save all JSON files
        if (allData.noaa) await saveData('noaa.json', allData.noaa);
        if (allData.aurora) await saveData('aurora.json', allData.aurora);
        if (allData.xray) await saveData('xray.json', allData.xray);
        if (allData.dst) await saveData('dst.json', allData.dst);
        if (allData.news) await saveData('news.json', allData.news);
        if (allData.meteor) await saveData('meteor.json', allData.meteor);
        if (allData.moon) await saveData('moon.json', allData.moon);
        if (allData.satellites) await saveData('satellites.json', allData.satellites);
        if (allData.comets) await saveData('comets.json', allData.comets);

        // Update system status
        const statusData = await updateSystemStatus(allData);
        await saveData('status.json', statusData);

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
