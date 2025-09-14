#!/usr/bin/env node

/**
 * Stocky API Test Suite
 * Comprehensive testing of all endpoints and edge cases
 */

import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_KEY = 'test-api-key'; // Optional in development

// Test data
const TEST_USER_ID = uuidv4();
const TEST_STOCK_SYMBOL = 'RELIANCE';
const TEST_QUANTITY = 2.5;
const TEST_TIMESTAMP = new Date().toISOString();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;
const testResults: Array<{name: string, passed: boolean, error?: string}> = [];

// Helper functions
function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string, passed: boolean, error?: string) {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  const color = passed ? colors.green : colors.red;
  log(`${status} ${name}`, color);
  
  if (error) {
    log(`  Error: ${error}`, colors.red);
  }
  
  testResults.push({ name, passed, error });
  if (passed) testsPassed++; else testsFailed++;
}

async function makeRequest(method: string, endpoint: string, data?: any): Promise<AxiosResponse> {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    data
  };
  
  return axios(config);
}

// Test functions
async function testHealthCheck() {
  try {
    const response = await makeRequest('GET', '/health');
    const passed = response.status === 200 && response.data.status === 'healthy';
    logTest('Health Check', passed, passed ? undefined : 'Health check failed');
  } catch (error: any) {
    logTest('Health Check', false, error.message);
  }
}

async function testCreateReward() {
  try {
    const rewardData = {
      userId: TEST_USER_ID,
      stockSymbol: TEST_STOCK_SYMBOL,
      quantity: TEST_QUANTITY,
      timestamp: TEST_TIMESTAMP,
      eventRef: `test-reward-${Date.now()}`
    };
    
    const response = await makeRequest('POST', '/reward', rewardData);
    const passed = response.status === 201 && response.data.status === 'success';
    logTest('Create Reward', passed, passed ? undefined : 'Reward creation failed');
  } catch (error: any) {
    logTest('Create Reward', false, error.response?.data?.error?.message || error.message);
  }
}

async function testCreateRewardValidation() {
  const testCases = [
    {
      name: 'Invalid UUID',
      data: { userId: 'invalid-uuid', stockSymbol: 'RELIANCE', quantity: 1, timestamp: TEST_TIMESTAMP, eventRef: 'test-1' },
      expectedStatus: 400
    },
    {
      name: 'Invalid Stock Symbol',
      data: { userId: TEST_USER_ID, stockSymbol: 'INVALID', quantity: 1, timestamp: TEST_TIMESTAMP, eventRef: 'test-2' },
      expectedStatus: 404
    },
    {
      name: 'Negative Quantity',
      data: { userId: TEST_USER_ID, stockSymbol: 'RELIANCE', quantity: -1, timestamp: TEST_TIMESTAMP, eventRef: 'test-3' },
      expectedStatus: 400
    },
    {
      name: 'Future Timestamp',
      data: { userId: TEST_USER_ID, stockSymbol: 'RELIANCE', quantity: 1, timestamp: '2025-01-01T00:00:00.000Z', eventRef: 'test-4' },
      expectedStatus: 400
    },
    {
      name: 'Empty Event Ref',
      data: { userId: TEST_USER_ID, stockSymbol: 'RELIANCE', quantity: 1, timestamp: TEST_TIMESTAMP, eventRef: '' },
      expectedStatus: 400
    }
  ];
  
  for (const testCase of testCases) {
    try {
      const response = await makeRequest('POST', '/reward', testCase.data);
      const passed = response.status === testCase.expectedStatus;
      logTest(`Validation: ${testCase.name}`, passed, passed ? undefined : `Expected ${testCase.expectedStatus}, got ${response.status}`);
    } catch (error: any) {
      const actualStatus = error.response?.status || 500;
      const passed = actualStatus === testCase.expectedStatus;
      logTest(`Validation: ${testCase.name}`, passed, passed ? undefined : `Expected ${testCase.expectedStatus}, got ${actualStatus}`);
    }
  }
}

async function testIdempotency() {
  try {
    const eventRef = `idempotency-test-${Date.now()}`;
    const rewardData = {
      userId: TEST_USER_ID,
      stockSymbol: 'TCS',
      quantity: 1.0,
      timestamp: TEST_TIMESTAMP,
      eventRef
    };
    
    // First request should succeed
    const response1 = await makeRequest('POST', '/reward', rewardData);
    const firstSuccess = response1.status === 201;
    
    // Second request should fail with conflict
    const response2 = await makeRequest('POST', '/reward', rewardData);
    const secondConflict = response2.status === 409;
    
    const passed = firstSuccess && secondConflict;
    logTest('Idempotency Test', passed, passed ? undefined : 'Idempotency not working correctly');
  } catch (error: any) {
    logTest('Idempotency Test', false, error.message);
  }
}

async function testGetTodayStocks() {
  try {
    const response = await makeRequest('GET', `/today-stocks/${TEST_USER_ID}`);
    const passed = response.status === 200 && 
                  response.data.userId === TEST_USER_ID && 
                  Array.isArray(response.data.rewards);
    logTest('Get Today Stocks', passed, passed ? undefined : 'Today stocks endpoint failed');
  } catch (error: any) {
    logTest('Get Today Stocks', false, error.response?.data?.error?.message || error.message);
  }
}

async function testGetTodayStocksValidation() {
  try {
    const response = await makeRequest('GET', '/today-stocks/invalid-uuid');
    const passed = response.status === 400;
    logTest('Today Stocks Validation', passed, passed ? undefined : 'UUID validation not working');
  } catch (error: any) {
    const actualStatus = error.response?.status || 500;
    const passed = actualStatus === 400;
    logTest('Today Stocks Validation', passed, passed ? undefined : `Expected 400, got ${actualStatus}`);
  }
}

async function testGetHistoricalInr() {
  try {
    const response = await makeRequest('GET', `/historical-inr/${TEST_USER_ID}`);
    const passed = response.status === 200 && 
                  response.data.userId === TEST_USER_ID && 
                  Array.isArray(response.data.history);
    logTest('Get Historical INR', passed, passed ? undefined : 'Historical INR endpoint failed');
  } catch (error: any) {
    logTest('Get Historical INR', false, error.response?.data?.error?.message || error.message);
  }
}

async function testGetStats() {
  try {
    const response = await makeRequest('GET', `/stats/${TEST_USER_ID}`);
    const passed = response.status === 200 && 
                  Array.isArray(response.data.todayTotals) &&
                  typeof response.data.portfolioValueINR === 'number';
    logTest('Get Stats', passed, passed ? undefined : 'Stats endpoint failed');
  } catch (error: any) {
    logTest('Get Stats', false, error.response?.data?.error?.message || error.message);
  }
}

async function testGetPortfolio() {
  try {
    const response = await makeRequest('GET', `/portfolio/${TEST_USER_ID}`);
    const passed = response.status === 200 && 
                  Array.isArray(response.data.portfolio);
    logTest('Get Portfolio', passed, passed ? undefined : 'Portfolio endpoint failed');
  } catch (error: any) {
    logTest('Get Portfolio', false, error.response?.data?.error?.message || error.message);
  }
}

async function testRateLimiting() {
  try {
    log('Testing rate limiting (this may take a moment)...', colors.yellow);
    
    const promises = [];
    for (let i = 0; i < 12; i++) {
      const rewardData = {
        userId: TEST_USER_ID,
        stockSymbol: 'INFY',
        quantity: 0.1,
        timestamp: TEST_TIMESTAMP,
        eventRef: `rate-limit-test-${i}-${Date.now()}`
      };
      
      promises.push(makeRequest('POST', '/reward', rewardData));
    }
    
    const responses = await Promise.allSettled(promises);
    const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201).length;
    const rateLimitedCount = responses.filter(r => r.status === 'fulfilled' && r.value.status === 429).length;
    
    // Should have some successes and some rate limited
    const passed = successCount > 0 && rateLimitedCount > 0;
    logTest('Rate Limiting', passed, passed ? undefined : `Expected some rate limiting, got ${successCount} successes, ${rateLimitedCount} rate limited`);
  } catch (error: any) {
    logTest('Rate Limiting', false, error.message);
  }
}

async function testPrecisionHandling() {
  try {
    const rewardData = {
      userId: TEST_USER_ID,
      stockSymbol: 'WIPRO',
      quantity: 0.123456, // 6 decimal places
      timestamp: TEST_TIMESTAMP,
      eventRef: `precision-test-${Date.now()}`
    };
    
    const response = await makeRequest('POST', '/reward', rewardData);
    const passed = response.status === 201;
    logTest('Precision Handling (6 decimals)', passed, passed ? undefined : 'Precision handling failed');
  } catch (error: any) {
    logTest('Precision Handling (6 decimals)', false, error.response?.data?.error?.message || error.message);
  }
}

async function testPrecisionValidation() {
  try {
    const rewardData = {
      userId: TEST_USER_ID,
      stockSymbol: 'TITAN',
      quantity: 0.1234567, // 7 decimal places (should fail)
      timestamp: TEST_TIMESTAMP,
      eventRef: `precision-validation-test-${Date.now()}`
    };
    
    const response = await makeRequest('POST', '/reward', rewardData);
    const passed = response.status === 400;
    logTest('Precision Validation (7 decimals)', passed, passed ? undefined : 'Precision validation not working');
  } catch (error: any) {
    const actualStatus = error.response?.status || 500;
    const passed = actualStatus === 400;
    logTest('Precision Validation (7 decimals)', passed, passed ? undefined : `Expected 400, got ${actualStatus}`);
  }
}

async function testStockPriceService() {
  try {
    // Wait a bit for stock prices to be fetched
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await makeRequest('GET', `/stats/${TEST_USER_ID}`);
    const passed = response.status === 200 && response.data.portfolioValueINR > 0;
    logTest('Stock Price Service', passed, passed ? undefined : 'Stock price service not working');
  } catch (error: any) {
    logTest('Stock Price Service', false, error.message);
  }
}

async function testErrorHandling() {
  try {
    // Test 404 for non-existent user
    const response = await makeRequest('GET', `/today-stocks/${uuidv4()}`);
    const passed = response.status === 200; // Should return empty array, not 404
    logTest('Error Handling (Non-existent User)', passed, passed ? undefined : 'Error handling incorrect');
  } catch (error: any) {
    logTest('Error Handling (Non-existent User)', false, error.message);
  }
}

// Main test runner
async function runTests() {
  log(`${colors.bold}${colors.blue}Stocky API Test Suite${colors.reset}\n`);
  log(`Testing against: ${BASE_URL}\n`);
  
  const startTime = Date.now();
  
  // Run all tests
  await testHealthCheck();
  await testCreateReward();
  await testCreateRewardValidation();
  await testIdempotency();
  await testGetTodayStocks();
  await testGetTodayStocksValidation();
  await testGetHistoricalInr();
  await testGetStats();
  await testGetPortfolio();
  await testPrecisionHandling();
  await testPrecisionValidation();
  await testStockPriceService();
  await testErrorHandling();
  await testRateLimiting();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Summary
  log(`\n${colors.bold}Test Summary:${colors.reset}`);
  log(`Total Tests: ${testsPassed + testsFailed}`);
  log(`Passed: ${colors.green}${testsPassed}${colors.reset}`);
  log(`Failed: ${colors.red}${testsFailed}${colors.reset}`);
  log(`Duration: ${duration}ms`);
  
  if (testsFailed > 0) {
    log(`\n${colors.red}Failed Tests:${colors.reset}`);
    testResults.filter(t => !t.passed).forEach(test => {
      log(`- ${test.name}: ${test.error}`, colors.red);
    });
  }
  
  const successRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
  log(`\nSuccess Rate: ${successRate}%`);
  
  if (testsFailed === 0) {
    log(`\n${colors.green}${colors.bold}🎉 All tests passed!${colors.reset}`);
  } else {
    log(`\n${colors.red}${colors.bold}❌ Some tests failed. Please check the issues above.${colors.reset}`);
  }
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (reason) => {
  log(`Unhandled rejection: ${reason}`, colors.red);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, colors.red);
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  log(`Test runner failed: ${error.message}`, colors.red);
  process.exit(1);
});
