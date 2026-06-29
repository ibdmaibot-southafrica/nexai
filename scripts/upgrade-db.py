#!/usr/bin/env python3
"""Upgrade database schema and clean fake data"""
import os

# Read current db.js
with open('lib/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the ensureTables function and add leads table
old_leads = """      INSERT INTO strategy (content) VALUES ('Build AI products for solo founders.') ON CONFLICT DO NOTHING;
    `);"""

new_leads = """      INSERT INTO strategy (content) VALUES ('Build AI products for solo founders.') ON CONFLICT DO NOTHING;
      
      -- Create leads table for real sales tracking
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL,
        website TEXT,
        location TEXT,
        industry TEXT,
        contact_email TEXT,
        contact_name TEXT,
        status TEXT DEFAULT 'researching',
        score INTEGER DEFAULT 0,
        outreach_subject TEXT,
        outreach_body TEXT,
        invoice_id TEXT,
        notes TEXT,
        source TEXT DEFAULT 'agent_research',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        contacted_at TIMESTAMPTZ,
        responded_at TIMESTAMPTZ
      );
      
      -- Create products table for actual built products
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'planned',
        api_endpoint TEXT,
        docs_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        launched_at TIMESTAMPTZ
      );
    `);"""

content = content.replace(old_leads, new_leads)

# Write updated db.js
with open('lib/db.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Database schema upgraded with leads and products tables')
