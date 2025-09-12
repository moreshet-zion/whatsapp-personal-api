const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { findChromeExecutable } = require('./chrome-check');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Global variables
let client;
let qrCodeData = null;
let isReady = false;
let scheduledMessages = [];
let activeCronJobs = new Map();

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const SCHEDULED_MESSAGES_FILE = path.join(DATA_DIR, 'scheduled_messages.json');

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

// Load scheduled messages from file
async function loadScheduledMessages() {
    try {
        if (await fs.pathExists(SCHEDULED_MESSAGES_FILE)) {
            scheduledMessages = await fs.readJson(SCHEDULED_MESSAGES_FILE);
            console.log(`Loaded ${scheduledMessages.length} scheduled messages`);
        }
    } catch (error) {
        console.error('Error loading scheduled messages:', error);
        scheduledMessages = [];
    }
}

// Save scheduled messages to file
async function saveScheduledMessages() {
    try {
        await fs.writeJson(SCHEDULED_MESSAGES_FILE, scheduledMessages, { spaces: 2 });
    } catch (error) {
        console.error('Error saving scheduled messages:', error);
    }
}

// Initialize WhatsApp client
function initializeClient() {
    console.log('Initializing WhatsApp client...');
    console.log('Using Puppeteer bundled Chromium for better compatibility');

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, 'whatsapp_session')
        }),
        puppeteer: {
            headless: true,
            timeout: 60000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
            // Let Puppeteer use its bundled Chromium for better compatibility
            // executablePath is intentionally omitted
        }
    });

    client.on('qr', (qr) => {
        console.log('QR Code received');
        qrCodeData = qr;
        qrcode.toDataURL(qr, (err, url) => {
            if (!err) {
                console.log('QR Code generated successfully');
            }
        });
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        isReady = true;
        qrCodeData = null;
        
        // Start scheduled messages
        startScheduledMessages();
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Client authenticated');
        qrCodeData = null;
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp authentication failed:', msg);
        qrCodeData = null;
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp Client disconnected:', reason);
        isReady = false;
        stopAllCronJobs();
    });

    client.on('loading_screen', (percent, message) => {
        console.log('Loading screen:', percent, message);
    });

    // Add error handling for initialization
    client.initialize().catch(error => {
        console.error('Failed to initialize WhatsApp client:', error);
        console.error('This might be due to Puppeteer/Chromium initialization issues.');
        console.error('Check if all required dependencies are installed.');
    });
}

// Cron job management
function createCronJob(scheduledMessage) {
    if (!cron.validate(scheduledMessage.schedule)) {
        throw new Error('Invalid cron schedule');
    }

    const task = cron.schedule(scheduledMessage.schedule, async () => {
        if (!isReady) {
            console.log(`Cannot send scheduled message ${scheduledMessage.id}: WhatsApp not ready`);
            return;
        }

        try {
            const chatId = `${scheduledMessage.number}@c.us`;
            await client.sendMessage(chatId, scheduledMessage.message);
            console.log(`Scheduled message sent to ${scheduledMessage.number}: ${scheduledMessage.message}`);

            // If it's a one-time message, deactivate it
            if (scheduledMessage.oneTime) {
                scheduledMessage.active = false;
                await saveScheduledMessages();
                stopCronJob(scheduledMessage.id);
                console.log(`One-time message ${scheduledMessage.id} completed and deactivated`);
            }
        } catch (error) {
            console.error(`Error sending scheduled message ${scheduledMessage.id}:`, error);
        }
    }, {
        scheduled: scheduledMessage.active
    });

    activeCronJobs.set(scheduledMessage.id, task);
    return task;
}

function stopCronJob(messageId) {
    const task = activeCronJobs.get(messageId);
    if (task) {
        task.stop();
        activeCronJobs.delete(messageId);
    }
}

function stopAllCronJobs() {
    activeCronJobs.forEach((task, id) => {
        task.stop();
    });
    activeCronJobs.clear();
}

function startScheduledMessages() {
    console.log('Starting scheduled messages...');
    scheduledMessages.forEach(message => {
        if (message.active) {
            try {
                createCronJob(message);
                console.log(`Started cron job for message: ${message.id}`);
            } catch (error) {
                console.error(`Error starting cron job for message ${message.id}:`, error);
            }
        }
    });
}

// API Routes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: isReady ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        scheduledMessages: scheduledMessages.length,
        activeJobs: activeCronJobs.size
    });
});

// Get QR code
app.get('/qr', async (req, res) => {
    if (isReady) {
        return res.json({
            success: false,
            message: 'Already authenticated'
        });
    }

    if (!qrCodeData) {
        return res.json({
            success: false,
            message: 'QR code not available yet, please wait...'
        });
    }

    try {
        const qrImage = await qrcode.toDataURL(qrCodeData);
        res.json({
            success: true,
            qr: qrCodeData,
            qrImage: qrImage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate QR code image'
        });
    }
});

// Send immediate message
app.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({
            success: false,
            error: 'Number and message are required'
        });
    }

    if (!isReady) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp not connected'
        });
    }

    try {
        const chatId = `${number}@c.us`;
        await client.sendMessage(chatId, message);
        
        res.json({
            success: true,
            message: 'Message sent successfully'
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// Get all scheduled messages
app.get('/scheduled', (req, res) => {
    res.json({
        success: true,
        scheduledMessages: scheduledMessages
    });
});

// Create scheduled message
app.post('/scheduled', async (req, res) => {
    const { number, message, schedule, description, oneTime = false } = req.body;

    if (!number || !message || !schedule) {
        return res.status(400).json({
            success: false,
            error: 'Number, message, and schedule are required'
        });
    }

    if (!cron.validate(schedule)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid cron schedule format'
        });
    }

    const scheduledMessage = {
        id: uuidv4(),
        number,
        message,
        schedule,
        description: description || '',
        oneTime,
        active: true,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    };

    scheduledMessages.push(scheduledMessage);
    await saveScheduledMessages();

    // Start the cron job if WhatsApp is ready
    if (isReady) {
        try {
            createCronJob(scheduledMessage);
        } catch (error) {
            console.error('Error creating cron job:', error);
        }
    }

    res.json({
        success: true,
        message: 'Scheduled message created',
        scheduledMessage
    });
});

// Update scheduled message
app.put('/scheduled/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const messageIndex = scheduledMessages.findIndex(msg => msg.id === id);
    if (messageIndex === -1) {
        return res.status(404).json({
            success: false,
            error: 'Scheduled message not found'
        });
    }

    // Validate schedule if provided
    if (updates.schedule && !cron.validate(updates.schedule)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid cron schedule format'
        });
    }

    // Stop existing cron job
    stopCronJob(id);

    // Update the message
    const updatedMessage = {
        ...scheduledMessages[messageIndex],
        ...updates,
        updated: new Date().toISOString()
    };
    scheduledMessages[messageIndex] = updatedMessage;
    await saveScheduledMessages();

    // Restart cron job if active and WhatsApp is ready
    if (updatedMessage.active && isReady) {
        try {
            createCronJob(updatedMessage);
        } catch (error) {
            console.error('Error recreating cron job:', error);
        }
    }

    res.json({
        success: true,
        message: 'Scheduled message updated',
        scheduledMessage: updatedMessage
    });
});

// Delete scheduled message
app.delete('/scheduled/:id', async (req, res) => {
    const { id } = req.params;

    const messageIndex = scheduledMessages.findIndex(msg => msg.id === id);
    if (messageIndex === -1) {
        return res.status(404).json({
            success: false,
            error: 'Scheduled message not found'
        });
    }

    // Stop cron job
    stopCronJob(id);

    // Remove from array
    scheduledMessages.splice(messageIndex, 1);
    await saveScheduledMessages();

    res.json({
        success: true,
        message: 'Scheduled message deleted'
    });
});

// Toggle scheduled message active status
app.post('/scheduled/:id/toggle', async (req, res) => {
    const { id } = req.params;

    const message = scheduledMessages.find(msg => msg.id === id);
    if (!message) {
        return res.status(404).json({
            success: false,
            error: 'Scheduled message not found'
        });
    }

    // Toggle active status
    message.active = !message.active;
    message.updated = new Date().toISOString();
    await saveScheduledMessages();

    // Start or stop cron job based on new status
    if (message.active && isReady) {
        try {
            createCronJob(message);
        } catch (error) {
            console.error('Error starting cron job:', error);
        }
    } else {
        stopCronJob(id);
    }

    res.json({
        success: true,
        message: `Scheduled message ${message.active ? 'activated' : 'deactivated'}`,
        scheduledMessage: message
    });
});

// Restart WhatsApp session
app.post('/restart', async (req, res) => {
    try {
        console.log('Restarting WhatsApp session...');
        
        // Stop all cron jobs
        stopAllCronJobs();
        
        // Destroy current client
        if (client) {
            await client.destroy();
        }
        
        // Reset state
        isReady = false;
        qrCodeData = null;
        
        // Initialize new client
        setTimeout(() => {
            initializeClient();
        }, 1000);
        
        res.json({
            success: true,
            message: 'WhatsApp session restart initiated'
        });
    } catch (error) {
        console.error('Error restarting session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restart session'
        });
    }
});

// Get schedule examples
app.get('/schedule-examples', (req, res) => {
    res.json({
        success: true,
        examples: {
            "Every day at 9 AM": "0 9 * * *",
            "Every Monday at 10 AM": "0 10 * * 1",
            "Every Friday at 5 PM": "0 17 * * 5",
            "Every weekday at 8 AM": "0 8 * * 1-5",
            "Every hour": "0 * * * *",
            "Every 30 minutes": "*/30 * * * *",
            "First day of every month at noon": "0 12 1 * *",
            "Every Sunday at 7 PM": "0 19 * * 0",
            "Christmas Day at 9 AM": "0 9 25 12 *",
            "New Year's Day at midnight": "0 0 1 1 *"
        },
        format: "minute hour day month dayOfWeek",
        note: "Use https://crontab.guru to validate your cron expressions"
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Initialize application
async function initialize() {
    try {
        await loadScheduledMessages();
        initializeClient();
        
        app.listen(PORT, () => {
            console.log(`WhatsApp Personal API server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`QR Code: http://localhost:${PORT}/qr`);
        });
    } catch (error) {
        console.error('Failed to initialize application:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    
    stopAllCronJobs();
    
    if (client) {
        await client.destroy();
    }
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    
    stopAllCronJobs();
    
    if (client) {
        await client.destroy();
    }
    
    process.exit(0);
});

// Start the application
initialize();
