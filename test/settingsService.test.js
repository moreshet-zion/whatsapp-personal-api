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
    history_backend: 'base44'
  })
  
  assert.equal(updated.history_backend, 'base44')
  
  // Verify persistence by creating a new instance
  const settings2 = new SettingsService(tempDir)
  const loadedSettings = settings2.getSettings()
  
  assert.equal(loadedSettings.history_backend, 'base44')
  
  // Clean up
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
})

test('SettingsService accepts base44 configuration without validation', async () => {
  const tempDir = path.join(process.cwd(), 'test-temp-settings-3')
  
  // Clean up any existing test files
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
  
  const settings = new SettingsService(tempDir)
  
  // Should now accept base44 without additional config since secrets are handled via env vars
  const updated = settings.updateSettings({
    history_backend: 'base44'
  })
  
  assert.equal(updated.history_backend, 'base44')
  
  // Clean up
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
})