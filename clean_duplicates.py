#!/usr/bin/env python3
"""
Script to clean up duplicate templates by calling the API endpoint.
"""

import requests
import sys
import getpass
import json

# Constants
API_URL = "http://localhost:8000"
LOGIN_ENDPOINT = f"{API_URL}/api/auth/login"
CLEANUP_ENDPOINT = f"{API_URL}/api/templates/cleanup-duplicates"

def main():
    print("=== Duplicate Template Cleanup Tool ===")
    
    # Get credentials
    email = input("Enter your email: ")
    password = getpass.getpass("Enter your password: ")
    
    # Login to get access token
    print("\nLogging in...")
    try:
        login_response = requests.post(
            LOGIN_ENDPOINT,
            json={"email": email, "password": password}
        )
        
        if login_response.status_code != 200:
            print(f"Login failed: {login_response.status_code}")
            print(login_response.text)
            return
        
        access_token = login_response.json().get("access_token")
        if not access_token:
            print("Failed to get access token")
            return
            
        print("Login successful!")
        
        # Call the cleanup endpoint
        print("\nCleaning up duplicate templates...")
        cleanup_response = requests.post(
            CLEANUP_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if cleanup_response.status_code != 200:
            print(f"Cleanup failed: {cleanup_response.status_code}")
            print(cleanup_response.text)
            return
        
        # Process successful response
        result = cleanup_response.json()
        print(f"\nSuccess: {result.get('message')}")
        if result.get('count', 0) > 0:
            print("Please refresh the Prompt Templates page to see the changes.")
        
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to the API at {API_URL}")
        print("Make sure the application is running.")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main() 