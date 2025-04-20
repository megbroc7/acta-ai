#!/usr/bin/env python3
"""
Diagnostic script to analyze the API response format for schedule objects
"""

import sys
import json
import requests
from datetime import datetime, timezone
import pprint
import traceback

def test_local_api():
    """Test direct API calls to the local server"""
    print("===== Testing Direct API Calls =====")
    
    base_url = "http://localhost:8000"
    endpoints = [
        "/api/health",
        "/api/schedules/",
        "/api/schedules/9"  # Assuming schedule ID 9 exists
    ]
    
    for endpoint in endpoints:
        url = f"{base_url}{endpoint}"
        print(f"\nTesting endpoint: {url}")
        try:
            response = requests.get(url)
            print(f"Status code: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    # For schedule-specific endpoint, analyze date fields
                    if endpoint.startswith("/api/schedules/") and len(endpoint) > 14:
                        print("\nAnalyzing date fields in schedule response:")
                        date_fields = ["created_at", "updated_at", "next_run", "next_run_at"]
                        for field in date_fields:
                            if field in data:
                                print(f"  {field}: {data[field]} (Type in JSON: {type(data[field]).__name__})")
                            else:
                                print(f"  {field}: NOT PRESENT")
                        
                        # Examine the specific format of next_run and next_run_at
                        if "next_run" in data:
                            try:
                                js_date = f"new Date('{data['next_run']}')"
                                print(f"\nJavaScript would parse next_run as: {js_date}")
                            except Exception as e:
                                print(f"Error analyzing next_run: {str(e)}")
                                
                        if "next_run_at" in data:
                            try:
                                js_date = f"new Date('{data['next_run_at']}')"
                                print(f"JavaScript would parse next_run_at as: {js_date}")
                            except Exception as e:
                                print(f"Error analyzing next_run_at: {str(e)}")
                    else:
                        # For list endpoints, just count items
                        if isinstance(data, list):
                            print(f"Response contains {len(data)} items")
                            if len(data) > 0:
                                print("First item key fields:")
                                first_item = data[0]
                                for key in ["id", "name", "active", "next_run", "next_run_at"]:
                                    if key in first_item:
                                        print(f"  {key}: {first_item[key]}")
                        else:
                            print("Response summary (first 500 chars):")
                            print(json.dumps(data)[:500])
                except ValueError:
                    print("Response is not valid JSON")
                    print(f"Raw response: {response.text[:200]}...")
            else:
                print(f"Error response: {response.text[:200]}...")
        except requests.RequestException as e:
            print(f"Request failed: {str(e)}")

def test_manual_serialization():
    """Test manually serializing datetime objects"""
    print("\n===== Testing Manual Serialization =====")
    
    # Create a sample datetime
    now = datetime.now(timezone.utc)
    
    # Test different serialization methods
    serialization_methods = {
        "str()": str(now),
        "isoformat()": now.isoformat(),
        "strftime('%Y-%m-%dT%H:%M:%S.%fZ')": now.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
        "strftime('%Y-%m-%d %H:%M:%S%z')": now.strftime('%Y-%m-%d %H:%M:%S%z'),
    }
    
    print("Python datetime serialization formats:")
    for method_name, result in serialization_methods.items():
        print(f"  {method_name}: {result}")
    
    # Test JSON serialization
    try:
        # This will fail with default json encoder
        direct_json = json.dumps({"datetime": now})
        print(f"\nDirect JSON serialization: {direct_json}")
    except TypeError:
        print("\nDirect JSON serialization failed (as expected)")
        # Custom encoder approach
        class DateTimeEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                return super().default(obj)
        
        custom_json = json.dumps({"datetime": now}, cls=DateTimeEncoder)
        print(f"JSON with custom encoder: {custom_json}")

if __name__ == "__main__":
    try:
        test_local_api()
        test_manual_serialization()
    except Exception as e:
        print(f"\n===== DIAGNOSTIC FAILED =====")
        print(f"Error: {type(e).__name__}: {str(e)}")
        print("\nTraceback:")
        traceback.print_exc() 