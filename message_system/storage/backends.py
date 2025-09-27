"""
Storage Backend Implementations
Provides both local file storage and Redis-compatible interface
"""
import json
import os
import asyncio
from pathlib import Path
from typing import Optional, Any, List, Dict
from datetime import datetime, timedelta
import pickle
import glob as file_glob
import logging

from ..core.interfaces import IStorageBackend

logger = logging.getLogger(__name__)


class LocalFileStorage(IStorageBackend):
    """
    Local file-based storage implementation
    Stores data as JSON files with Redis-like interface
    """
    
    def __init__(self, base_path: str = "./storage"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self._ttl_registry: Dict[str, datetime] = {}
        self._lock = asyncio.Lock()
    
    def _get_file_path(self, key: str) -> Path:
        """Get file path for a key"""
        # Replace colons with underscores for filesystem compatibility
        safe_key = key.replace(":", "_")
        return self.base_path / f"{safe_key}.json"
    
    def _get_list_file_path(self, key: str) -> Path:
        """Get file path for list storage"""
        safe_key = key.replace(":", "_")
        return self.base_path / f"{safe_key}_list.json"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        # Check TTL
        if await self._is_expired(key):
            await self.delete(key)
            return None
        
        file_path = self._get_file_path(key)
        
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                data = json.loads(content)
                return data.get('value')
        except Exception as e:
            logger.error(f"Error reading key {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value with optional TTL (in seconds)"""
        file_path = self._get_file_path(key)
        
        data = {
            'value': value,
            'created_at': datetime.now().isoformat(),
            'ttl': ttl
        }
        
        try:
            with open(file_path, 'w') as f:
                f.write(json.dumps(data, indent=2))
            
            # Register TTL if provided
            if ttl:
                self._ttl_registry[key] = datetime.now() + timedelta(seconds=ttl)
            
            logger.debug(f"Set key {key}")
        except Exception as e:
            logger.error(f"Error setting key {key}: {e}")
            raise
    
    async def delete(self, key: str) -> None:
        """Delete value by key"""
        file_path = self._get_file_path(key)
        list_file_path = self._get_list_file_path(key)
        
        try:
            if file_path.exists():
                file_path.unlink()
            if list_file_path.exists():
                list_file_path.unlink()
            
            # Remove from TTL registry
            self._ttl_registry.pop(key, None)
            
            logger.debug(f"Deleted key {key}")
        except Exception as e:
            logger.error(f"Error deleting key {key}: {e}")
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if await self._is_expired(key):
            await self.delete(key)
            return False
        
        file_path = self._get_file_path(key)
        list_file_path = self._get_list_file_path(key)
        
        return file_path.exists() or list_file_path.exists()
    
    async def list_keys(self, pattern: str) -> List[str]:
        """List keys matching pattern (supports * wildcard)"""
        # Convert Redis-style pattern to glob pattern
        glob_pattern = pattern.replace(":", "_")
        
        matching_files = list(self.base_path.glob(f"{glob_pattern}.json"))
        matching_files.extend(list(self.base_path.glob(f"{glob_pattern}_list.json")))
        
        keys = []
        for file_path in matching_files:
            # Convert back to key format
            key = file_path.stem.replace("_list", "").replace("_", ":")
            if not await self._is_expired(key):
                keys.append(key)
        
        return keys
    
    async def append_to_list(self, key: str, value: Any) -> None:
        """Append value to a list"""
        async with self._lock:
            file_path = self._get_list_file_path(key)
            
            # Read existing list
            existing_list = []
            if file_path.exists():
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                        data = json.loads(content)
                        existing_list = data.get('values', [])
                except Exception as e:
                    logger.error(f"Error reading list {key}: {e}")
            
            # Append new value
            existing_list.append(value)
            
            # Write back
            data = {
                'values': existing_list,
                'updated_at': datetime.now().isoformat()
            }
            
            try:
                with open(file_path, 'w') as f:
                    f.write(json.dumps(data, indent=2))
                
                logger.debug(f"Appended to list {key}")
            except Exception as e:
                logger.error(f"Error appending to list {key}: {e}")
                raise
    
    async def get_list(self, key: str, start: int = 0, end: int = -1) -> List[Any]:
        """Get list values (supports Python slice notation)"""
        file_path = self._get_list_file_path(key)
        
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                data = json.loads(content)
                values = data.get('values', [])
                
                # Handle Python slice notation
                if end == -1:
                    return values[start:]
                else:
                    return values[start:end+1]
        except Exception as e:
            logger.error(f"Error reading list {key}: {e}")
            return []
    
    async def _is_expired(self, key: str) -> bool:
        """Check if key has expired"""
        if key in self._ttl_registry:
            return datetime.now() > self._ttl_registry[key]
        return False
    
    async def cleanup_expired(self) -> None:
        """Clean up expired keys"""
        expired_keys = [
            key for key, expiry in self._ttl_registry.items()
            if datetime.now() > expiry
        ]
        
        for key in expired_keys:
            await self.delete(key)
        
        logger.info(f"Cleaned up {len(expired_keys)} expired keys")


class RedisStorage(IStorageBackend):
    """
    Redis storage implementation
    Requires redis-py library: pip install redis[async]
    """
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        self.host = host
        self.port = port
        self.db = db
        self.client = None
    
    async def connect(self):
        """Connect to Redis"""
        try:
            import redis.asyncio as redis
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True
            )
            await self.client.ping()
            logger.info(f"Connected to Redis at {self.host}:{self.port}")
        except ImportError:
            logger.error("redis library not installed. Install with: pip install redis[async]")
            raise
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.client:
            await self.client.close()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        if not self.client:
            await self.connect()
        
        try:
            value = await self.client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Error getting key {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value with optional TTL"""
        if not self.client:
            await self.connect()
        
        try:
            json_value = json.dumps(value)
            if ttl:
                await self.client.setex(key, ttl, json_value)
            else:
                await self.client.set(key, json_value)
            
            logger.debug(f"Set key {key} in Redis")
        except Exception as e:
            logger.error(f"Error setting key {key}: {e}")
            raise
    
    async def delete(self, key: str) -> None:
        """Delete value by key"""
        if not self.client:
            await self.connect()
        
        try:
            await self.client.delete(key)
            logger.debug(f"Deleted key {key} from Redis")
        except Exception as e:
            logger.error(f"Error deleting key {key}: {e}")
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.client:
            await self.connect()
        
        try:
            return bool(await self.client.exists(key))
        except Exception as e:
            logger.error(f"Error checking key {key}: {e}")
            return False
    
    async def list_keys(self, pattern: str) -> List[str]:
        """List keys matching pattern"""
        if not self.client:
            await self.connect()
        
        try:
            keys = await self.client.keys(pattern)
            return [key for key in keys]
        except Exception as e:
            logger.error(f"Error listing keys with pattern {pattern}: {e}")
            return []
    
    async def append_to_list(self, key: str, value: Any) -> None:
        """Append value to a list"""
        if not self.client:
            await self.connect()
        
        try:
            json_value = json.dumps(value)
            await self.client.rpush(key, json_value)
            logger.debug(f"Appended to list {key} in Redis")
        except Exception as e:
            logger.error(f"Error appending to list {key}: {e}")
            raise
    
    async def get_list(self, key: str, start: int = 0, end: int = -1) -> List[Any]:
        """Get list values"""
        if not self.client:
            await self.connect()
        
        try:
            values = await self.client.lrange(key, start, end)
            return [json.loads(v) for v in values]
        except Exception as e:
            logger.error(f"Error getting list {key}: {e}")
            return []


class HybridStorage(IStorageBackend):
    """
    Hybrid storage that can switch between local and Redis
    Provides seamless migration path
    """
    
    def __init__(self, primary: IStorageBackend, secondary: Optional[IStorageBackend] = None):
        self.primary = primary
        self.secondary = secondary
        self.sync_enabled = False
    
    async def enable_sync(self):
        """Enable syncing between primary and secondary storage"""
        self.sync_enabled = True
        logger.info("Storage sync enabled")
    
    async def migrate_to_secondary(self):
        """Migrate all data from primary to secondary storage"""
        if not self.secondary:
            raise ValueError("No secondary storage configured")
        
        # Get all keys from primary
        keys = await self.primary.list_keys("*")
        
        for key in keys:
            # Check if it's a list
            list_values = await self.primary.get_list(key)
            if list_values:
                for value in list_values:
                    await self.secondary.append_to_list(key, value)
            else:
                # Regular key-value
                value = await self.primary.get(key)
                if value is not None:
                    await self.secondary.set(key, value)
        
        logger.info(f"Migrated {len(keys)} keys to secondary storage")
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from primary, fallback to secondary"""
        value = await self.primary.get(key)
        
        if value is None and self.secondary:
            value = await self.secondary.get(key)
            
            # Sync to primary if found in secondary
            if value is not None and self.sync_enabled:
                await self.primary.set(key, value)
        
        return value
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in primary and optionally in secondary"""
        await self.primary.set(key, value, ttl)
        
        if self.secondary and self.sync_enabled:
            await self.secondary.set(key, value, ttl)
    
    async def delete(self, key: str) -> None:
        """Delete from both storages"""
        await self.primary.delete(key)
        
        if self.secondary:
            await self.secondary.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check existence in both storages"""
        exists = await self.primary.exists(key)
        
        if not exists and self.secondary:
            exists = await self.secondary.exists(key)
        
        return exists
    
    async def list_keys(self, pattern: str) -> List[str]:
        """List keys from both storages"""
        keys = set(await self.primary.list_keys(pattern))
        
        if self.secondary:
            keys.update(await self.secondary.list_keys(pattern))
        
        return list(keys)
    
    async def append_to_list(self, key: str, value: Any) -> None:
        """Append to list in both storages"""
        await self.primary.append_to_list(key, value)
        
        if self.secondary and self.sync_enabled:
            await self.secondary.append_to_list(key, value)
    
    async def get_list(self, key: str, start: int = 0, end: int = -1) -> List[Any]:
        """Get list from primary, fallback to secondary"""
        values = await self.primary.get_list(key, start, end)
        
        if not values and self.secondary:
            values = await self.secondary.get_list(key, start, end)
        
        return values