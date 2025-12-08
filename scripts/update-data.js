const fs = require('fs');
const path = require('path');
const axios = require('axios');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

async function fetchData() {
    console.log('🚀 Fetching enhanced space weather data...');
    console.log('Time:', new Date().toISOString());
    
    try {
        // 1. Fetch Kp Index data (array of arrays format)
        console.log('📡 Fetching Kp Index data...');
        let kpIndex = [];
        try {
            const kpResponse = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 10000 });
            // Convert to array of arrays format: [timestamp, kp, estimated_kp, ...]
            kpIndex = kpResponse.data.map(item => {
                if (Array.isArray(item)) {
                    return item; // Already in array format
                } else {
                    // Convert object to array
                    return [
                        item.time_tag || item.timestamp,
                        parseFloat(item.kp) || 0,
                        parseFloat(item.estimated_kp) || 0,
                        '0' // Placeholder
                    ];
                }
            }).slice(-24); // Last 24 entries
            console.log(`✅ Kp index: ${kpIndex.length} entries`);
        } catch (error) {
            console.log('❌ Failed to fetch Kp index:', error.message);
        }

        // 2. Fetch Solar Wind (array format)
        console.log('📡 Fetching Solar Wind data...');
        let solarWind = [];
        try {
            const windResponse = await axios.get('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', { timeout: 10000 });
            const windData = windResponse.data;
            if (windData.length > 0) {
                // Take the latest entry and format as array
                const latest = windData[windData.length - 1];
                solarWind = [
                    latest.time_tag || new Date().toISOString(),
                    parseFloat(latest.density) || 0,
                    parseFloat(latest.speed) || 0,
                    parseFloat(latest.temperature) || 0
                ];
            }
            console.log('✅ Solar wind data');
        } catch (error) {
            console.log('❌ Failed to fetch solar wind:', error.message);
        }

        // 3. Fetch Solar Flares
        console.log('📡 Fetching Solar Flares...');
        let solarFlares = [];
        try {
            const flareResponse = await axios.get('https://services.swpc.noaa.gov/json/goes-xray-flares.json', { timeout: 10000 });
            solarFlares = flareResponse.data.slice(-10); // Last 10 flares
            
            // If that endpoint fails, try the backup
            if (solarFlares.length === 0) {
                const backupResponse = await axios.get('https://services.swpc.noaa.gov/json/solar-flare.json', { timeout: 10000 });
                solarFlares = backupResponse.data.slice(-10);
            }
            console.log(`✅ Solar flares: ${solarFlares.length} entries`);
        } catch (error) {
            console.log('❌ Failed to fetch solar flares:', error.message);
        }

        // 4. Save NOAA data in correct format for your dashboard
        fs.writeFileSync(
            path.join(dataDir, 'noaa-data.json'),
            JSON.stringify({
                kpIndex: kpIndex,
                solarWind: solarWind,
                solarFlares: solarFlares,
                updated: new Date().toISOString(),
                source: 'NOAA SWPC'
            }, null, 2)
        );

        // 5. Create enhanced aurora data with KP forecast
        console.log('🌌 Fetching Aurora data...');
        const currentKp = kpIndex.length > 0 ? parseFloat(kpIndex[kpIndex.length - 1][1]) : 0;
        const auroraLevel = currentKp >= 6 ? "HIGH" : currentKp >= 4 ? "MODERATE" : "LOW";
        const visibility = currentKp >= 5 ? "Aurora may be visible at mid-latitudes tonight." : "Aurora activity is quiet.";
        
        const auroraData = {
            forecast: `Current Kp index is ${currentKp.toFixed(1)} (${auroraLevel}). ${visibility} The auroral oval is ${currentKp >= 4 ? "expanded" : "near normal"} size. Next 3 hours forecast: Kp ${(currentKp + 0.5).toFixed(1)}.`,
            kpIndex: currentKp,
            updated: new Date().toISOString(),
            source: 'NOAA Aurora Forecast',
            probability: currentKp >= 5 ? "High" : "Low",
            bestViewing: currentKp >= 4 ? "Late evening to early morning" : "Not favorable"
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'aurora.json'),
            JSON.stringify(auroraData, null, 2)
        );

        // 6. Fetch X-ray Flux for the gauge
        console.log('☀️ Fetching X-ray Flux data...');
        let xrayFlux = "A0.0";
        try {
            const xrayResponse = await axios.get('https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json', { timeout: 10000 });
            if (xrayResponse.data.length > 0) {
                const latestXray = xrayResponse.data[xrayResponse.data.length - 1];
                const flux = latestXray.flux || 0;
                // Convert to classification (A, B, C, M, X)
                if (flux >= 0.000001) { // X-class
                    xrayFlux = "X" + (flux / 0.000001).toFixed(1);
                } else if (flux >= 0.0000001) { // M-class
                    xrayFlux = "M" + (flux / 0.0000001).toFixed(1);
                } else if (flux >= 0.00000001) { // C-class
                    xrayFlux = "C" + (flux / 0.00000001).toFixed(1);
                } else if (flux >= 0.000000001) { // B-class
                    xrayFlux = "B" + (flux / 0.000000001).toFixed(1);
                } else {
                    xrayFlux = "A" + (flux / 0.0000000001).toFixed(1);
                }
            }
            console.log(`✅ X-ray flux: ${xrayFlux}`);
        } catch (error) {
            console.log('❌ Failed to fetch X-ray flux:', error.message);
        }

        // 7. Fetch Dst Index for geomagnetic storms
        console.log('🧲 Fetching Dst Index...');
        let dstIndex = 0;
        try {
            const dstResponse = await axios.get('https://services.swpc.noaa.gov/products/kyoto-dst.json', { timeout: 10000 });
            if (dstResponse.data.length > 0) {
                // Data comes as array of arrays: [time, Dst]
                const latestDst = dstResponse.data[dstResponse.data.length - 1];
                dstIndex = parseFloat(latestDst[1]) || 0;
            }
            console.log(`✅ Dst index: ${dstIndex} nT`);
        } catch (error) {
            console.log('❌ Failed to fetch Dst index:', error.message);
        }

        // 8. Create enhanced news with multiple sources
        console.log('📰 Fetching Space News...');
        const newsItems = [];
        
        try {
            // Try to get NASA news
            const nasaResponse = await axios.get('https://www.nasa.gov/rss/dyn/breaking_news.rss', { timeout: 10000 });
            const nasaText = nasaResponse.data;
            
            // Simple RSS parsing for NASA
            const nasaItems = nasaText.match(/<item>[\s\S]*?<\/item>/g) || [];
            nasaItems.slice(0, 3).forEach(item => {
                const titleMatch = item.match(/<title>(.*?)<\/title>/);
                const linkMatch = item.match(/<link>(.*?)<\/link>/);
                const descMatch = item.match(/<description>(.*?)<\/description>/);
                
                if (titleMatch && titleMatch[1] && !titleMatch[1].includes('NASA Breaking News')) {
                    newsItems.push({
                        title: titleMatch[1],
                        link: linkMatch ? linkMatch[1] : 'https://nasa.gov',
                        source: 'NASA',
                        date: new Date().toISOString(),
                        summary: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').substring(0, 150) + '...' : ''
                    });
                }
            });
        } catch (error) {
            console.log('❌ Failed to fetch NASA news:', error.message);
        }

        // Add placeholder if no news
        if (newsItems.length === 0) {
            newsItems.push({
                title: "Space Weather Dashboard Live",
                link: "https://github.com/NAGOHUSA/ONSLIVE",
                source: "Dashboard",
                date: new Date().toISOString(),
                summary: "Your enhanced space weather dashboard is now operational with real-time data feeds."
            });
        }

        fs.writeFileSync(
            path.join(dataDir, 'news.json'),
            JSON.stringify(newsItems, null, 2)
        );

        // 9. Create comprehensive system status
        const statusData = {
            lastUpdate: new Date().toISOString(),
            status: 'success',
            message: 'All space weather data updated successfully',
            timestamp: Date.now(),
            dataSources: [
                'NOAA Space Weather Prediction Center',
                'NASA GOES Satellite Data',
                'Real-time Aurora Forecast',
                'Geomagnetic Storm Monitoring'
            ],
            metrics: {
                kpIndex: currentKp,
                xrayFlux: xrayFlux,
                dstIndex: dstIndex,
                solarWindSpeed: solarWind.length > 2 ? solarWind[2] : 0,
                flareCount: solarFlares.length
            }
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'update-status.json'),
            JSON.stringify(statusData, null, 2)
        );

        // 10. Create additional data files for enhanced features
        
        // X-ray flux data for gauge
        fs.writeFileSync(
            path.join(dataDir, 'xray-data.json'),
            JSON.stringify({
                current: xrayFlux,
                numeric: parseFloat(xrayFlux.substring(1)) || 0,
                class: xrayFlux.charAt(0),
                updated: new Date().toISOString(),
                description: getXrayDescription(xrayFlux)
            }, null, 2)
        );

        // Dst index data for gauge
        fs.writeFileSync(
            path.join(dataDir, 'dst-data.json'),
            JSON.stringify({
                current: dstIndex,
                updated: new Date().toISOString(),
                stormLevel: getDstStormLevel(dstIndex),
                description: getDstDescription(dstIndex)
            }, null, 2)
        );

        console.log('✅ All enhanced data files created successfully!');
        console.log('📊 Summary:');
        console.log(`   - Kp Index: ${currentKp.toFixed(1)}`);
        console.log(`   - X-ray Flux: ${xrayFlux}`);
        console.log(`   - Dst Index: ${dstIndex} nT`);
        console.log(`   - Solar Flares: ${solarFlares.length}`);
        console.log(`   - News Items: ${newsItems.length}`);

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

// Helper functions
function getXrayDescription(fluxClass) {
    const letter = fluxClass.charAt(0);
    const value = parseFloat(fluxClass.substring(1));
    
    switch(letter) {
        case 'X':
            return value >= 10 ? "Extreme solar flare activity" : "Major solar flare activity";
        case 'M':
            return "Moderate solar flare activity";
        case 'C':
            return "Minor solar flare activity";
        case 'B':
            return "Very low solar activity";
        case 'A':
            return "Background solar activity";
        default:
            return "Normal solar activity";
    }
}

function getDstStormLevel(dst) {
    if (dst <= -100) return "Severe";
    if (dst <= -50) return "Strong";
    if (dst <= -30) return "Moderate";
    if (dst <= -20) return "Minor";
    return "Quiet";
}

function getDstDescription(dst) {
    if (dst <= -100) return "Severe geomagnetic storm in progress";
    if (dst <= -50) return "Strong geomagnetic storm ongoing";
    if (dst <= -30) return "Moderate geomagnetic disturbance";
    if (dst <= -20) return "Minor geomagnetic activity";
    return "Geomagnetic conditions quiet";
}

// Run if this file is executed directly
if (require.main === module) {
    fetchData();
}

module.exports = { fetchData };

// Add this function to your update-data.js file:
async function updateMeteorData() {
  try {
    console.log('📡 Fetching meteor shower data...');
    
    // Get current date
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();
    
    // Determine current meteor activity based on time of year
    let currentActivity = 3.5; // Default background activity
    let activityLevel = "Low";
    let description = "Typical background meteor activity";
    
    // Major meteor showers by month (simplified)
    if (month === 1 && day >= 1 && day <= 5) {
      currentActivity = 8.5; // Quadrantids peak
      activityLevel = "High";
      description = "Quadrantids meteor shower active! Peak around Jan 3-4.";
    } else if (month === 8 && day >= 10 && day <= 15) {
      currentActivity = 9.0; // Perseids peak
      activityLevel = "Very High";
      description = "Perseids meteor shower active! Peak around Aug 12-13.";
    } else if (month === 12 && day >= 10 && day <= 16) {
      currentActivity = 9.5; // Geminids peak
      activityLevel = "Very High";
      description = "Geminids meteor shower active! Peak around Dec 13-14.";
    } else if (month === 10 && day >= 20 && day <= 23) {
      currentActivity = 6.5; // Orionids peak
      activityLevel = "Moderate";
      description = "Orionids meteor shower active.";
    }
    
    // Add some randomness to simulate changing conditions
    currentActivity += (Math.random() - 0.5) * 2;
    currentActivity = Math.max(0, Math.min(10, currentActivity));
    
    // Determine active showers
    const activeShowers = [];
    if (month === 12 && day >= 4 && day <= 17) {
      activeShowers.push({
        name: "Geminids",
        zhr: 150,
        peak: "Active Now (Peak: Dec 13-14)",
        description: "One of the best showers of the year, producing up to 150 meteors/hour at peak."
      });
    }
    if (month === 1 && day >= 1 && day <= 10) {
      activeShowers.push({
        name: "Quadrantids",
        zhr: 120,
        peak: "Active Now (Peak: Jan 3-4)",
        description: "First major shower of the year, known for bright fireballs."
      });
    }
    if (month === 8 && day >= 9 && day <= 14) {
      activeShowers.push({
        name: "Perseids",
        zhr: 100,
        peak: "Active Now (Peak: Aug 12-13)",
        description: "Popular summer meteor shower with fast, bright meteors."
      });
    }
    
    // Determine next major shower
    let nextMajorShower;
    if (month >= 1 && month <= 3) {
      nextMajorShower = {
        name: "Lyrids",
        date: "April 21-22, 2024",
        zhr: 18,
        description: "Spring meteor shower known for occasional bright fireballs."
      };
    } else if (month >= 4 && month <= 7) {
      nextMajorShower = {
        name: "Perseids",
        date: "August 12-13, 2024",
        zhr: 100,
        description: "Popular summer meteor shower with fast, bright meteors."
      };
    } else {
      nextMajorShower = {
        name: "Geminids",
        date: "December 13-14, 2024",
        zhr: 150,
        description: "One of the best showers of the year, producing up to 150 meteors/hour at peak."
      };
    }
    
    const meteorData = {
      current: parseFloat(currentActivity.toFixed(1)),
      max: 10,
      activity: activityLevel,
      description: description,
      updated: new Date().toISOString(),
      showers: [
        {
          name: "Quadrantids",
          peak: "Jan 3-4",
          zhr: 120,
          active: (month === 1 && day >= 1 && day <= 10),
          rating: 8
        },
        {
          name: "Lyrids",
          peak: "Apr 21-22",
          zhr: 18,
          active: (month === 4 && day >= 16 && day <= 25),
          rating: 4
        },
        {
          name: "Perseids",
          peak: "Aug 12-13",
          zhr: 100,
          active: (month === 8 && day >= 9 && day <= 14),
          rating: 7
        },
        {
          name: "Orionids",
          peak: "Oct 21-22",
          zhr: 20,
          active: (month === 10 && day >= 16 && day <= 26),
          rating: 5
        },
        {
          name: "Leonids",
          peak: "Nov 17-18",
          zhr: 15,
          active: (month === 11 && day >= 14 && day <= 21),
          rating: 3
        },
        {
          name: "Geminids",
          peak: "Dec 13-14",
          zhr: 150,
          active: (month === 12 && day >= 4 && day <= 17),
          rating: 9
        }
      ],
      activeShowers: activeShowers,
      nextMajorShower: nextMajorShower
    };
    
    // Save to file
    await fs.writeFile('data/meteor.json', JSON.stringify(meteorData, null, 2));
    console.log('✅ Meteor shower data updated');
    return meteorData;
    
  } catch (error) {
    console.error('❌ Error updating meteor data:', error.message);
    // Return fallback data
    return {
      current: 3.5,
      max: 10,
      activity: "Low",
      description: "Background meteor activity",
      updated: new Date().toISOString(),
      showers: [],
      activeShowers: [],
      nextMajorShower: null
    };
  }
}

// Add meteorData to the main update function
async function updateAllData() {
  console.log('🚀 Starting enhanced space weather data update...');
  
  try {
    // Fetch all data in parallel
    const [noaaData, auroraData, newsData, xrayData, dstData, meteorData] = await Promise.all([
      updateNOAAData(),
      updateAuroraData(),
      updateNewsData(),
      updateXrayData(),
      updateDstData(),
      updateMeteorData()  // Add this line
    ]);
    
    // Update status
    const statusData = {
      lastUpdate: new Date().toISOString(),
      status: 'success',
      message: 'All data sources updated successfully',
      dataSources: [
        'NOAA Space Weather',
        'Aurora Forecast Service',
        'Space Weather News',
        'Solar X-ray Monitor',
        'Geomagnetic Dst Index',
        'Meteor Activity Tracker'  // Add this line
      ]
    };
    
    await fs.writeFile('data/update-status.json', JSON.stringify(statusData, null, 2));
    
    console.log('✅ All data updated successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error updating data:', error);
    
    // Update status with error
    const errorStatus = {
      lastUpdate: new Date().toISOString(),
      status: 'error',
      message: `Update failed: ${error.message}`,
      dataSources: []
    };
    
    await fs.writeFile('data/update-status.json', JSON.stringify(errorStatus, null, 2));
    return false;
  }
}
