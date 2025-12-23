# Supabase Connection Fix for Render

## Problem

You're getting `ENETUNREACH` error when connecting to Supabase from Render. This is because:
1. Supabase resolves to IPv6, but Render's network may not support IPv6
2. Direct connection (port 5432) may be blocked or have network issues

## Solution: Use Supabase Connection Pooler

Supabase provides a **connection pooler** specifically for serverless/cloud platforms like Render.

### Steps:

1. **Get Pooler Connection Details**:
   - Go to Supabase Dashboard → Your Project → Settings → Database
   - Find **Connection Pooling** section
   - Copy the **Connection string** (uses port **6543** instead of 5432)

2. **Update Environment Variables in Render**:
   
   Instead of:
   ```
   DB_HOST=db.hgccevozihmirfvwarau.supabase.co
   DB_PORT=5432
   ```
   
   Use the pooler:
   ```
   DB_HOST=db.hgccevozihmirfvwarau.supabase.co
   DB_PORT=6543
   ```
   
   Or use the full connection string format (if your code supports it):
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.hgccevozihmirfvwarau.supabase.co:6543/postgres?sslmode=require
   ```

3. **Keep SSL enabled**:
   ```
   DB_SSL=true
   ```

## Alternative: Direct Connection with IPv4

If you must use direct connection (port 5432):

1. Check Supabase **Network Restrictions**:
   - Go to Supabase Dashboard → Settings → Database
   - Check if your Render IP is whitelisted
   - Supabase may require IP whitelisting for direct connections

2. Try using the **Transaction Pooler** (port 6543) - this is the recommended approach

## Quick Fix

**Update your Render environment variables:**

```
DB_HOST=db.hgccevozihmirfvwarau.supabase.co
DB_PORT=6543          # Changed from 5432 to 6543 (pooler)
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=abhaymishra
DB_SSL=true
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

The pooler (port 6543) is designed for cloud/serverless platforms and should resolve the network connectivity issues.
