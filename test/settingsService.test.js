import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { SettingsService } from '../dist/services/settingsService.js'

test('SettingsService loads default settings', async () => {
  const tempDir = path.join(process.cwd(), 'test-temp-settings')
  
  // Clean up any existing test files
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
  
  const settings = new SettingsService(tempDir)
  const loadedSettings = settings.getSettings()
  
  assert.equal(loadedSettings.history_backend, 'redis')
  assert.equal(loadedSettings.base44, undefined)
  
  // Clean up
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
})

test('SettingsService updates and persists settings', async () => {
  const tempDir = path.join(process.cwd(), 'test-temp-settings-2')
  
  // Clean up any existing test files
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
  
  const settings = new SettingsService(tempDir)
  
  const updated = settings.updateSettings({
    history_backend: 'base44',
    base44: {
      url: 'https://test.example.com',
      apiKey: 'test-api-key'
    }
  })
  
  assert.equal(updated.history_backend, 'base44')
  assert.equal(updated.base44?.url, 'https://test.example.com')
  assert.equal(updated.base44?.apiKey, 'test-api-key')
  
  // Verify persistence by creating a new instance
  const settings2 = new SettingsService(tempDir)
  const loadedSettings = settings2.getSettings()
  
  assert.equal(loadedSettings.history_backend, 'base44')
  assert.equal(loadedSettings.base44?.url, 'https://test.example.com')
  assert.equal(loadedSettings.base44?.apiKey, 'test-api-key')
  
  // Clean up
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
})

test('SettingsService validates base44 configuration', async () => {
  const tempDir = path.join(process.cwd(), 'test-temp-settings-3')
  
  // Clean up any existing test files
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
  
  const settings = new SettingsService(tempDir)
  
  try {
    settings.updateSettings({
      history_backend: 'base44'
      // Missing base44 config - should fail
    })
    assert.fail('Should have thrown validation error')
  } catch (err) {
    assert(err.message.includes('Base44 backend requires'))
  }
  
  // Clean up
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
})