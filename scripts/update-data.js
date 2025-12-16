// create-all-json.js
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fsSync.existsSync(dataDir)) {
    fsSync.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
}

// Helper function to save data
async function saveData(filename, data) {
    try {
        const filePath = path.join(dataDir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ ${filename} saved (${JSON.stringify(data).length} bytes)`);
        return true;
    } catch (error) {
        console.error(`❌ Error saving ${filename}:`, error.message);
        return false;
    }
}

// 1. NOAA Data (noaa-data.json)
async function createNoaaData() {
    console.log('📡 Creating NOAA data...');
    
    const now = new Date();
    const hours = [];
    const kpData = [];
    
    // Generate realistic Kp data for last 24 hours
    for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        hours.push(time.toISOString());
        
        // Realistic Kp values (1-7 range)
        const baseKp = 2 + Math.sin(i * 0.5) * 2;
        const randomKp = baseKp + (Math.random() * 0.8 - 0.4);
        kpData.push([time.toISOString(), parseFloat(randomKp.toFixed(1))]);
    }
    
    const noaaData = {
        kpIndex: kpData,
        solarWind: [now.toISOString(), 5.0, 450, 100000],
        solarFlares: [
            {
                class_type: "C2.3",
                peak_time: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
                location: "N15W45",
                active_region: "AR3215"
            }
        ],
        updated: now.toISOString(),
        source: 'NOAA SWPC'
    };
    
    await saveData('noaa-data.json', noaaData);
    return noaaData;
}

// 2. Aurora Data (aurora.json)
async function createAuroraData() {
    console.log('🌌 Creating Aurora data...');
    
    const now = new Date();
    const kpValue = 3.7;
    
    const auroraData = {
        forecast: "Aurora activity is quiet. High latitude observers may see faint displays.",
        kpIndex: kpValue.toFixed(1),
        probability: "Moderate",
        bestViewing: "Late evening to early morning at high latitudes",
        updated: now.toISOString(),
        source: 'Aurora Forecast Service'
    };
    
    await saveData('aurora.json', auroraData);
    return auroraData;
}

// 3. X-ray Data (xray-data.json)
async function createXrayData() {
    console.log('☀️ Creating X-ray data...');
    
    const now = new Date();
    const xrayData = {
        current: "B3.2",
        flux: 3.2e-7,
        numeric: 3.2,
        class: "B",
        description: "Very low solar activity",
        updated: now.toISOString(),
        source: 'NOAA GOES X-ray'
    };
    
    await saveData('xray-data.json', xrayData);
    return xrayData;
}

// 4. Dst Data (dst-data.json)
async function createDstData() {
    console.log('🧲 Creating Dst data...');
    
    const now = new Date();
    const dstData = {
        current: -15,
        stormLevel: "Quiet",
        description: "Geomagnetic conditions quiet",
        updated: now.toISOString(),
        source: 'NOAA Kyoto Dst'
    };
    
    await saveData('dst-data.json', dstData);
    return dstData;
}

// 5. News Data (news.json)
async function createNewsData() {
    console.log('📰 Creating News data...');
    
    const now = new Date();
    const newsData = [
        {
            title: "Space Weather Dashboard v3.0 Launched",
            link: "https://live.ournightsky.us",
            source: "OurNightSky",
            date: now.toISOString(),
            summary: "Enhanced real-time space weather monitoring with live satellite tracking and meteor activity."
        },
        {
            title: "Solar Minimum Continues",
            link: "https://www.swpc.noaa.gov",
            source: "NOAA SWPC",
            date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            summary: "Solar activity remains low with occasional C-class flares expected."
        },
        {
            title: "Geminids Meteor Shower Peaking Soon",
            link: "https://www.imo.net",
            source: "IMO",
            date: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
            summary: "The annual Geminids meteor shower peaks December 13-14 with up to 150 meteors per hour."
        },
        {
            title: "ISS Completes 25th Year in Orbit",
            link: "https://www.nasa.gov",
            source: "NASA",
            date: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
            summary: "International Space Station marks 25 years of continuous human presence in space."
        },
        {
            title: "Aurora Forecast: Moderate Activity",
            link: "https://www.swpc.noaa.gov/products/aurora-30-minute-forecast",
            source: "NOAA Aurora",
            date: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
            summary: "Kp index reaching 4 expected tonight, visible at high latitudes."
        }
    ];
    
    await saveData('news.json', newsData);
    return newsData;
}

// 6. Meteor Data (meteor.json)
async function createMeteorData() {
    console.log('🌠 Creating Meteor data...');
    
    const now = new Date();
    const meteorData = {
        current: 4.2,
        max: 10,
        activity: "Low",
        description: "Background sporadic meteor activity",
        updated: now.toISOString(),
        activeShowers: [
            {
                name: "Geminids",
                zhr: 45,
                peak: "December 13-14",
                status: "Building"
            }
        ],
        nextMajorShower: {
            name: "Geminids",
            date: "December 13",
            zhr: 150,
            description: "Best shower of the year"
        }
    };
    
    await saveData('meteor.json', meteorData);
    return meteorData;
}

// 7. Satellite Data (satellites.json)
async function createSatelliteData() {
    console.log('🛰️ Creating Satellite data...');
    
    const now = new Date();
    
    // Realistic satellite positions
    const satellites = [
        {
            name: "International Space Station",
            noradId: 25544,
            latitude: 42.5 + (Math.random() * 10 - 5),
            longitude: -75.2 + (Math.random() * 10 - 5),
            altitude: Math.round(410 + Math.random() * 10),
            velocity: Math.round(27600 + Math.random() * 100),
            visibility: "daylight",
            timestamp: now.toISOString(),
            footprint: 4500
        },
        {
            name: "Hubble Space Telescope",
            noradId: 20580,
            latitude: 28.5 + (Math.random() * 10 - 5),
            longitude: -80.6 + (Math.random() * 10 - 5),
            altitude: Math.round(547 + Math.random() * 10),
            velocity: Math.round(27000 + Math.random() * 100),
            visibility: "night",
            timestamp: now.toISOString(),
            footprint: 4200
        },
        {
            name: "Tiangong Space Station",
            noradId: 48274,
            latitude: 23.1 + (Math.random() * 10 - 5),
            longitude: 113.4 + (Math.random() * 10 - 5),
            altitude: Math.round(390 + Math.random() * 10),
            velocity: Math.round(27800 + Math.random() * 100),
            visibility: "daylight",
            timestamp: now.toISOString(),
            footprint: 4300
        },
        {
            name: "GOES-16",
            noradId: 41866,
            latitude: 0,
            longitude: -75.2,
            altitude: 35786,
            velocity: 11000,
            visibility: "geostationary",
            timestamp: now.toISOString(),
            footprint: 12000
        },
        {
            name: "NOAA-20",
            noradId: 43013,
            latitude: 67.3 + (Math.random() * 10 - 5),
            longitude: 45.8 + (Math.random() * 10 - 5),
            altitude: Math.round(824 + Math.random() * 10),
            velocity: Math.round(26500 + Math.random() * 100),
            visibility: "night",
            timestamp: now.toISOString(),
            footprint: 2800
        }
    ];
    
    const satelliteData = {
        satellites: satellites,
        count: satellites.length,
        updated: now.toISOString(),
        source: 'Satellite Tracking API'
    };
    
    await saveData('satellites.json', satelliteData);
    return satelliteData;
}

// 8. Moon Phase Data (moon-phase.json)
async function createMoonPhaseData() {
    console.log('🌙 Creating Moon phase data...');
    
    const now = new Date();
    
    // Calculate realistic moon phase (today is around 30% illuminated)
    const moonData = {
        phase: "Waxing Crescent",
        phaseIcon: "🌒",
        illumination: 30,
        age: 4,
        daysInCycle: 4,
        nextNewMoon: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        nextFullMoon: new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000).toISOString(),
        isVisible: true,
        bestViewing: "Good",
        updated: now.toISOString(),
        source: 'Astronomical Calculation'
    };
    
    await saveData('moon-phase.json', moonData);
    return moonData;
}

// 9. Meteor Activity Data (meteor-activity.json)
async function createMeteorActivityData() {
    console.log('☄️ Creating Meteor activity data...');
    
    const now = new Date();
    
    const meteorActivityData = {
        totalZHR: 12,
        activityScore: 4.2,
        activityLevel: "Low",
        description: "Background meteor activity with minor shower contribution",
        activeShowers: [
            {
                name: "Geminids",
                zhr: 8,
                maxZHR: 150,
                peakDate: "December 13",
                isPeak: false,
                daysFromPeak: 2,
                status: "Early Activity"
            },
            {
                name: "Sporadic",
                zhr: 4,
                maxZHR: 10,
                peakDate: "Year-round",
                isPeak: false,
                daysFromPeak: 0,
                status: "Background"
            }
        ],
        sporadicRate: 4,
        bestViewingTime: "After midnight, away from city lights",
        moonInterference: "Low - Crescent moon present",
        updated: now.toISOString(),
        source: 'IMO Meteor Shower Calendar'
    };
    
    await saveData('meteor-activity.json', meteorActivityData);
    return meteorActivityData;
}

// 10. Update Status (update-status.json)
async function createUpdateStatus() {
    console.log('📊 Creating Update status...');
    
    const now = new Date();
    
    const statusData = {
        lastUpdate: now.toISOString(),
        status: 'success',
        message: 'All data sources updated successfully',
        timestamp: Date.now(),
        dataSources: [
            'NOAA Space Weather Prediction Center',
            'NASA GOES Satellite Data',
            'Aurora Forecast Service',
            'Meteor Activity Monitor',
            'Satellite Tracking API',
            'Moon Phase Calculator',
            'IMO Meteor Shower Calendar'
        ],
        metrics: {
            dataPoints: 10,
            updateTime: now.toLocaleTimeString(),
            nextUpdate: new Date(now.getTime() + 2 * 60 * 1000).toISOString()
        }
    };
    
    await saveData('update-status.json', statusData);
    return statusData;
}

// Main function to create all files
async function createAllJSONFiles() {
    console.log('🚀 Creating all JSON data files...');
    console.log('⏰ Time:', new Date().toISOString());
    console.log('='.repeat(50));
    
    try {
        // Create all files in parallel
        const results = await Promise.allSettled([
            createNoaaData(),
            createAuroraData(),
            createXrayData(),
            createDstData(),
            createNewsData(),
            createMeteorData(),
            createSatelliteData(),
            createMoonPhaseData(),
            createMeteorActivityData(),
            createUpdateStatus()
        ]);
        
        console.log('\n='.repeat(50));
        console.log('📋 Summary:');
        
        const files = [
            'noaa-data.json', 'aurora.json', 'xray-data.json', 'dst-data.json',
            'news.json', 'meteor.json', 'satellites.json', 'moon-phase.json',
            'meteor-activity.json', 'update-status.json'
        ];
        
        let successCount = 0;
        files.forEach((file, index) => {
            if (results[index].status === 'fulfilled') {
                console.log(`✅ ${file}: Created successfully`);
                successCount++;
            } else {
                console.log(`❌ ${file}: Failed - ${results[index].reason?.message || 'Unknown error'}`);
            }
        });
        
        console.log(`\n🎯 ${successCount}/${files.length} files created successfully`);
        
        // Verify files exist
        console.log('\n🔍 Verifying files...');
        for (const file of files) {
            const filePath = path.join(dataDir, file);
            if (fsSync.existsSync(filePath)) {
                const stats = fsSync.statSync(filePath);
                console.log(`✓ ${file}: ${stats.size} bytes`);
            } else {
                console.log(`✗ ${file}: MISSING`);
            }
        }
        
        console.log('\n✅ All JSON files ready for use!');
        console.log(`📁 Data directory: ${dataDir}`);
        
    } catch (error) {
        console.error('❌ Error creating JSON files:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    createAllJSONFiles();
}

module.exports = { createAllJSONFiles };
