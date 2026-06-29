#!/usr/bin/env python3
"""Delete fake invoices from the database, keep only real company invoices."""
import os
import sys

# Add the vercel-app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# We'll use the API to delete fake invoices
import urllib.request
import json

BASE_URL = "https://vercel-app-sigma-teal.vercel.app"

# Fake customer patterns to delete
FAKE_PATTERNS = [
    "Prospective Customer",
    "Jane Smith",
    "John Doe", 
    "Test User",
    "Pending Customer",
    "Test Customer",
]

def get_invoices():
    req = urllib.request.Request(f"{BASE_URL}/api/invoices")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def is_fake(customer):
    for pattern in FAKE_PATTERNS:
        if pattern.lower() in customer.lower():
            return True
    return False

def delete_invoice(invoice_id):
    # Use the PUT endpoint to mark as cancelled
    data = json.dumps({"status": "cancelled"}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/invoices/{invoice_id}",
        data=data,
        method="PUT",
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return True
    except Exception as e:
        print(f"  Error deleting {invoice_id}: {e}")
        return False

def main():
    print("Fetching invoices...")
    data = get_invoices()
    invoices = data.get("invoices", [])
    
    print(f"Total invoices: {len(invoices)}")
    
    fake_count = 0
    real_count = 0
    
    for inv in invoices:
        customer = inv.get("customer", "")
        if is_fake(customer):
            fake_count += 1
            print(f"  FAKE: {inv['id']} - {customer} - {inv['product']}")
        else:
            real_count += 1
            print(f"  REAL: {inv['id']} - {customer} - {inv['product']}")
    
    print(f"\nFake invoices to cancel: {fake_count}")
    print(f"Real invoices to keep: {real_count}")
    
    # Cancel fake invoices
    cancelled = 0
    for inv in invoices:
        customer = inv.get("customer", "")
        if is_fake(customer):
            if delete_invoice(inv["id"]):
                cancelled += 1
                print(f"  Cancelled: {inv['id']} - {customer}")
    
    print(f"\nDone! Cancelled {cancelled} fake invoices.")

if __name__ == "__main__":
    main()
