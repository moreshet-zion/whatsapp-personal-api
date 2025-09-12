const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Function to find Chrome executable
function findChromeExecutable() {
    const possiblePaths = [
        // macOS paths
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        // Windows paths
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        // Linux paths
        '/opt/google/chrome/chrome',
        '/snap/bin/chromium'
    ];

    for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
            return chromePath;
        }
    }
    return null;
}

// Check if Puppeteer can launch
async function checkPuppeteer() {
    try {
        console.log('Checking Puppeteer configuration...');
        
        const executablePath = findChromeExecutable();
        if (executablePath) {
            console.log(`Found Chrome at: ${executablePath}`);
        }

        const browser = await puppeteer.launch({
            headless: true,
            timeout: 30000,
            executablePath: executablePath || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        console.log('✅ Puppeteer can launch successfully!');
        await browser.close();
        return true;
    } catch (error) {
        console.error('❌ Puppeteer launch failed:', error.message);
        return false;
    }
}

module.exports = { findChromeExecutable, checkPuppeteer };

// Run check if called directly
if (require.main === module) {
    checkPuppeteer().then(success => {
        process.exit(success ? 0 : 1);
    });
}
