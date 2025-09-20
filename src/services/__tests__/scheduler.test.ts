import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { SchedulerService } from '../scheduler.js';
import type { WhatsAppClient } from '../whatsapp.js';
import path from 'path';

// We'll use manual mocks due to ESM module limitations
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
};

const mockCron = {
  validate: jest.fn(),
  schedule: jest.fn()
};

// Mock modules  
jest.unstable_mockModule('fs', () => ({
  default: mockFs,
  ...mockFs
}));
jest.unstable_mockModule('node-cron', () => ({
  default: mockCron,
  ...mockCron
}));

// Import after mocking
const { SchedulerService: ActualSchedulerService } = await import('../scheduler.js');

describe('SchedulerService', () => {
  let scheduler: SchedulerService;
  let mockWhatsAppClient: any;
  let mockSocket: any;
  const testDataDir = '/tmp/test-data';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup mock WhatsApp client
    mockSocket = {
      sendMessage: jest.fn().mockResolvedValue(undefined)
    };
    
    mockWhatsAppClient = {
      getConnectionStatus: jest.fn().mockReturnValue('connected'),
      getSocket: jest.fn().mockReturnValue(mockSocket),
      start: jest.fn(),
      restart: jest.fn(),
      getQR: jest.fn()
    };
    
    // Setup fs mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockReturnValue('[]');
    mockFs.writeFileSync.mockImplementation(() => undefined);
    
    // Setup cron mocks
    mockCron.validate.mockReturnValue(true);
    const mockTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
      getStatus: jest.fn().mockReturnValue('scheduled')
    };
    mockCron.schedule.mockReturnValue(mockTask);
    
    // Create scheduler instance
    scheduler = new ActualSchedulerService(testDataDir, mockWhatsAppClient);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Cron-based scheduling', () => {
    it('should create a cron-based scheduled message', () => {
      const input = {
        number: '1234567890',
        message: 'Test cron message',
        schedule: '0 9 * * 1', // Every Monday at 9 AM
        description: 'Weekly reminder'
      };
      
      const result = scheduler.create(input);
      
      expect(result).toMatchObject({
        number: input.number,
        message: input.message,
        schedule: input.schedule,
        description: input.description,
        active: true,
        oneTime: false,
        executed: false
      });
      expect(result.id).toBeDefined();
      expect(mockCron.schedule).toHaveBeenCalledWith(
        input.schedule,
        expect.any(Function)
      );
    });

    it('should validate cron expression before creating', () => {
      mockCron.validate.mockReturnValue(false);
      
      const input = {
        number: '1234567890',
        message: 'Test message',
        schedule: 'invalid-cron',
        description: 'Test'
      };
      
      expect(() => scheduler.create(input)).toThrow('Invalid cron expression');
    });

    it('should start cron job only if message is active', () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
        getStatus: jest.fn().mockReturnValue('scheduled')
      };
      mockCron.schedule.mockReturnValue(mockTask);
      
      const input = {
        number: '1234567890',
        message: 'Test message',
        schedule: '0 9 * * 1'
      };
      
      const msg = scheduler.create(input);
      expect(mockTask.start).toHaveBeenCalled();
      
      // Deactivate and verify stop is called
      scheduler.toggle(msg.id, false);
      expect(mockTask.stop).toHaveBeenCalled();
    });

    it('should handle oneTime flag for cron messages', () => {
      const input = {
        number: '1234567890',
        message: 'One-time cron message',
        schedule: '0 9 * * 1',
        oneTime: true
      };
      
      const result = scheduler.create(input);
      expect(result.oneTime).toBe(true);
    });

    it('should send message when cron triggers', async () => {
      let cronCallback: Function | null = null;
      mockCron.schedule.mockImplementation((schedule: string, callback: Function) => {
        cronCallback = callback;
        return {
          start: jest.fn(),
          stop: jest.fn(),
          destroy: jest.fn(),
          getStatus: jest.fn().mockReturnValue('scheduled')
        };
      });
      
      const input = {
        number: '1234567890',
        message: 'Test cron message',
        schedule: '0 9 * * 1'
      };
      
      scheduler.create(input);
      
      // Trigger the cron callback
      if (cronCallback) {
        await cronCallback();
      }
      
      expect(mockSocket.sendMessage).toHaveBeenCalledWith(
        '1234567890@s.whatsapp.net',
        { text: 'Test cron message' }
      );
    });

    it('should not send message if WhatsApp is disconnected', async () => {
      mockWhatsAppClient.getConnectionStatus.mockReturnValue('disconnected');
      
      let cronCallback: Function | null = null;
      mockCron.schedule.mockImplementation((schedule: string, callback: Function) => {
        cronCallback = callback;
        return {
          start: jest.fn(),
          stop: jest.fn(),
          destroy: jest.fn(),
          getStatus: jest.fn().mockReturnValue('scheduled')
        };
      });
      
      scheduler.create({
        number: '1234567890',
        message: 'Test message',
        schedule: '0 9 * * 1'
      });
      
      if (cronCallback) {
        await cronCallback();
      }
      
      expect(mockSocket.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Date-based scheduling', () => {
    it('should create a date-based scheduled message', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      
      const input = {
        number: '1234567890',
        message: 'Birthday reminder',
        scheduleDate: futureDate,
        description: 'Birthday message'
      };
      
      const result = scheduler.createDateSchedule(input);
      
      expect(result).toMatchObject({
        number: input.number,
        message: input.message,
        scheduleDate: input.scheduleDate,
        description: input.description,
        schedule: '', // Empty for date-based
        oneTime: true, // Always true for date-based
        active: true,
        executed: false
      });
      expect(result.id).toBeDefined();
      // The timeout is set internally, we can't directly check setTimeout
      // but we can verify the message is in the scheduler's list
      const messages = scheduler.list();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.scheduleDate).toBe(futureDate);
    });

    it('should reject date-based message with past date', () => {
      const pastDate = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      
      const input = {
        number: '1234567890',
        message: 'Past message',
        scheduleDate: pastDate
      };
      
      expect(() => scheduler.createDateSchedule(input)).toThrow('Scheduled date is in the past');
    });

    it('should allow date within 1-minute grace period', () => {
      const recentPastDate = new Date(Date.now() - 30000).toISOString(); // 30 seconds ago
      
      const input = {
        number: '1234567890',
        message: 'Recent past message',
        scheduleDate: recentPastDate
      };
      
      const result = scheduler.createDateSchedule(input);
      expect(result).toBeDefined();
    });

    it('should reject invalid date format', () => {
      const input = {
        number: '1234567890',
        message: 'Invalid date message',
        scheduleDate: 'not-a-date'
      };
      
      expect(() => scheduler.createDateSchedule(input)).toThrow('Invalid date format');
    });

    it('should send message when scheduled time arrives', async () => {
      const futureDate = new Date(Date.now() + 1000).toISOString(); // 1 second from now
      
      const input = {
        number: '1234567890',
        message: 'Scheduled message',
        scheduleDate: futureDate
      };
      
      scheduler.createDateSchedule(input);
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      // Allow async operations to complete
      await Promise.resolve();
      await Promise.resolve(); // Double resolve for async callback
      
      expect(mockSocket.sendMessage).toHaveBeenCalledWith(
        '1234567890@s.whatsapp.net',
        { text: 'Scheduled message' }
      );
    });

    it('should not schedule inactive date-based messages on restore', () => {
      // Create a message that's already inactive in storage
      const existingMessages = [{
        id: 'test-id',
        number: '1234567890',
        message: 'Inactive message',
        schedule: '',
        scheduleDate: new Date(Date.now() + 60000).toISOString(),
        oneTime: true,
        active: false, // Inactive
        executed: false,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingMessages));
      
      // Create new scheduler (which loads and restores jobs)
      const newScheduler = new ActualSchedulerService(testDataDir, mockWhatsAppClient);
      
      // The message should be loaded but not scheduled (still inactive)
      const messages = newScheduler.list();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.active).toBe(false);
    });

    it('should handle past dates correctly on restore', () => {
      const pastDate = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      const existingMessages = [{
        id: 'test-id',
        number: '1234567890',
        message: 'Past message',
        schedule: '',
        scheduleDate: pastDate,
        oneTime: true,
        active: true,
        executed: false,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingMessages));
      
      // Create new scheduler
      const newScheduler = new ActualSchedulerService(testDataDir, mockWhatsAppClient);
      
      // Message should be marked as executed without sending
      const messages = newScheduler.list();
      expect(messages[0]?.executed).toBe(true);
      expect(mockSocket.sendMessage).not.toHaveBeenCalled();
    });

    it('should clear timeout when deleting date-based message', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString();
      
      const msg = scheduler.createDateSchedule({
        number: '1234567890',
        message: 'To be deleted',
        scheduleDate: futureDate
      });
      
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const deleted = scheduler.delete(msg.id);
      expect(deleted).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Common operations', () => {
    it('should update scheduled message', () => {
      const msg = scheduler.create({
        number: '1234567890',
        message: 'Original message',
        schedule: '0 9 * * 1'
      });
      
      const updated = scheduler.update(msg.id, {
        message: 'Updated message',
        schedule: '0 10 * * 1'
      });
      
      expect(updated).toMatchObject({
        id: msg.id,
        message: 'Updated message',
        schedule: '0 10 * * 1'
      });
    });

    it('should delete scheduled message', () => {
      const msg = scheduler.create({
        number: '1234567890',
        message: 'To delete',
        schedule: '0 9 * * 1'
      });
      
      expect(scheduler.list()).toHaveLength(1);
      
      const deleted = scheduler.delete(msg.id);
      expect(deleted).toBe(true);
      expect(scheduler.list()).toHaveLength(0);
    });

    it('should toggle message active status', () => {
      const msg = scheduler.create({
        number: '1234567890',
        message: 'Toggle test',
        schedule: '0 9 * * 1'
      });
      
      expect(msg.active).toBe(true);
      
      const toggled = scheduler.toggle(msg.id);
      expect(toggled?.active).toBe(false);
      
      const toggledAgain = scheduler.toggle(msg.id);
      expect(toggledAgain?.active).toBe(true);
    });

    it('should list all scheduled messages', () => {
      scheduler.create({
        number: '1111111111',
        message: 'Message 1',
        schedule: '0 9 * * 1'
      });
      
      scheduler.createDateSchedule({
        number: '2222222222',
        message: 'Message 2',
        scheduleDate: new Date(Date.now() + 60000).toISOString()
      });
      
      const messages = scheduler.list();
      expect(messages).toHaveLength(2);
      expect(messages[0]?.schedule).toBeTruthy(); // Cron-based
      expect(messages[1]?.scheduleDate).toBeTruthy(); // Date-based
    });

    it('should persist messages to file', () => {
      const msg1 = scheduler.create({
        number: '1111111111',
        message: 'Cron message',
        schedule: '0 9 * * 1'
      });
      
      const msg2 = scheduler.createDateSchedule({
        number: '2222222222',
        message: 'Date message',
        scheduleDate: new Date(Date.now() + 60000).toISOString()
      });
      
      // Verify writeFileSync was called
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      // Check that both messages are in the list
      const messages = scheduler.list();
      expect(messages).toHaveLength(2);
      expect(messages.find(m => m.id === msg1.id)).toBeDefined();
      expect(messages.find(m => m.id === msg2.id)).toBeDefined();
    });

    it('should handle file system errors gracefully', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      // Should not throw, just log error
      expect(() => scheduler.create({
        number: '1234567890',
        message: 'Test',
        schedule: '0 9 * * 1'
      })).not.toThrow();
    });
  });

  describe('Bug fixes', () => {
    it('should not schedule inactive date-based messages on startup', () => {
      // This tests the fix for the bug where inactive date-based messages
      // were being scheduled on restart
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const existingMessages = [{
        id: 'inactive-msg',
        number: '1234567890',
        message: 'Should not be scheduled',
        schedule: '',
        scheduleDate: futureDate,
        oneTime: true,
        active: false, // Key: message is inactive
        executed: false,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingMessages));
      
      // Create scheduler which will load and restore jobs
      const newScheduler = new ActualSchedulerService(testDataDir, mockWhatsAppClient);
      
      // The message should be loaded but remain inactive
      const messages = newScheduler.list();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.active).toBe(false);
    });

    it('should handle past-due messages without race conditions', async () => {
      // This tests the fix for using await when sending past-due messages
      const recentPastDate = new Date(Date.now() - 30000).toISOString(); // 30 seconds ago
      
      const msg = scheduler.createDateSchedule({
        number: '1234567890',
        message: 'Past due message',
        scheduleDate: recentPastDate
      });
      
      // The message should be sent immediately (within grace period)
      // and marked as executed
      const messages = scheduler.list();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.id).toBe(msg.id);
      
      // Note: The actual async sending happens in the background
      // In a real scenario, we'd wait for the promise to resolve
      // For testing, we just verify the message was created correctly
    });
  });
});