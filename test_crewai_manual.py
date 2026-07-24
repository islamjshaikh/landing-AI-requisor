#!/usr/bin/env python3
"""
Manual CrewAI Test Script
Run this to test CrewAI functionality step by step
"""

import sys
import os
import requests
import json
from datetime import datetime

def log_test(message):
    """Log test message with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def test_crewai_basic():
    """Test basic CrewAI functionality"""
    log_test("🧪 STARTING MANUAL CREWAI TEST")
    log_test("=" * 50)
    
    # Test 1: Health check
    log_test("TEST 1: Health Check")
    try:
        response = requests.get('http://localhost:8001/health', timeout=10)
        log_test(f"  Status Code: {response.status_code}")
        log_test(f"  Response: {response.text}")
        
        if response.status_code == 200:
            log_test("  ✅ HEALTH CHECK PASSED")
        else:
            log_test("  ❌ HEALTH CHECK FAILED")
            return False
            
    except Exception as e:
        log_test(f"  ❌ HEALTH CHECK ERROR: {e}")
        return False
    
    # Test 2: Content generation
    log_test("\nTEST 2: Content Generation")
    try:
        test_data = {
            "topic": "AI technology trends",
            "platform": "linkedin", 
            "tone": "professional"
        }
        
        log_test(f"  Sending request: {test_data}")
        response = requests.post(
            'http://localhost:8001/generate',
            json=test_data,
            timeout=60  # Longer timeout for content generation
        )
        
        log_test(f"  Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            log_test("  ✅ CONTENT GENERATION PASSED")
            log_test(f"  Generated content preview: {str(result)[:200]}...")
            return True
        else:
            log_test(f"  ❌ CONTENT GENERATION FAILED: {response.text}")
            return False
            
    except Exception as e:
        log_test(f"  ❌ CONTENT GENERATION ERROR: {e}")
        return False

def test_environment():
    """Test environment variables"""
    log_test("\nTEST 3: Environment Check")
    
    openai_key = os.getenv('OPENAI_API_KEY')
    if openai_key:
        log_test(f"  ✅ OPENAI_API_KEY: Set (length: {len(openai_key)})")
    else:
        log_test("  ❌ OPENAI_API_KEY: Not set")
        return False
    
    return True

def main():
    log_test("🚀 MANUAL CREWAI TESTING STARTED")
    
    # Test environment
    if not test_environment():
        log_test("❌ ENVIRONMENT TEST FAILED")
        return
    
    # Test CrewAI
    if test_crewai_basic():
        log_test("\n🎉 ALL TESTS PASSED - CREWAI IS WORKING!")
    else:
        log_test("\n💥 TESTS FAILED - CREWAI IS NOT WORKING!")

if __name__ == "__main__":
    main()