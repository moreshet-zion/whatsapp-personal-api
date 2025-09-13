# WhatsApp Personal API - Setup Guide

## First Time Setup (Local Authentication)

Before using the API in production, you need to authenticate your WhatsApp account locally once.

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Setup Mode
```bash
npm run setup
```

This will:
- Start the WhatsApp client in setup mode
- Display a QR code in your terminal
- Wait for you to scan it with WhatsApp

### 3. Scan QR Code with WhatsApp
1. Open WhatsApp on your phone
2. Go to **Settings** → **Linked Devices**
3. Tap **"Link a Device"**
4. Scan the QR code displayed in your terminal

### 4. Setup Complete
Once scanned successfully, you'll see:
```
✅ SUCCESS! WhatsApp has been linked successfully!
🔐 Session has been saved to whatsapp_session/ directory
🚀 You can now run the API in headless mode using: npm start
```

The setup will automatically exit after saving your session.

## Running the API (After Setup)

### Local Development
```bash
npm start
# or for development with auto-restart
npm run dev
```

### Production (Headless)
The API will now run headless using the saved session:
- No QR code scanning required
- All API endpoints available
- Scheduled messages work automatically

## API Endpoints
- **Health Check**: `GET /health`
- **Send Message**: `POST /send`
- **Scheduled Messages**: `GET|POST /scheduled`
- **QR Code** (if needed): `GET /qr`

## Troubleshooting

### If you need to re-authenticate:
1. Delete the `whatsapp_session/` directory
2. Run `npm run setup` again

### If setup fails:
- Make sure you have a stable internet connection
- Try running `npm run check-chrome` to verify browser setup
- Check that no other WhatsApp Web sessions are active

## Session Management
- Session files are stored in `whatsapp_session/`
- Keep this directory secure and backed up
- The session will remain valid until you log out from WhatsApp
