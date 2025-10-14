// Brivo API Test Script
// This script tests your API key by making a simple API call
import * as dotenv from 'dotenv';

dotenv.config();

// Your credentials from the email
const API_KEY = process.env.BRIVO_API_KEY || '';
const BASE_URL = 'https://api.brivo.com';

// Test function to verify API key works
async function testBrivoAPI() {
  console.log('Testing Brivo API connection...\n');
  
  try {
    // First, let's try the accounts listing endpoint (simplest read-only endpoint)
    const accountsUrl = `${BASE_URL}/v1/api/accounts`;
    
    console.log(`Making request to: ${accountsUrl}`);
    console.log(`Using API Key: ${API_KEY.substring(0, 10)}...`);
    console.log('Note: You still need an OAuth access token!\n');
    
    const response = await fetch(accountsUrl, {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json'
        // Note: 'Authorization': 'bearer ACCESS_TOKEN' is also required
        // but we're testing if the API key at least connects
      }
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    
    if (response.status === 401) {
      console.log('\n✓ Good news! The API key is accepted by the server.');
      console.log('✗ However, you need an OAuth access token to make actual requests.');
      console.log('\nNext steps:');
      console.log('1. You need to complete OAuth authentication to get an access token');
      console.log('2. Check if set up the OAuth callback correctly');
      console.log('3. Use the access token in the Authorization header');
    } else if (response.status === 403) {
      console.log('\n✗ API key was rejected or you need additional authentication.');
      console.log('Response:', responseText);
    } else if (response.status === 200) {
      console.log('\n✓ Success! API key works and you have access.');
      console.log('Response:', responseText);
    } else {
      console.log('\nResponse body:', responseText);
    }
    
  } catch (error) {
    console.error('Error making API request:', error);
  }
}

// Alternative: Test with access-points endpoint (might give better info)
async function testAccessPoints() {
  console.log('\n--- Testing Access Points Endpoint ---\n');
  
  try {
    const accessPointsUrl = `${BASE_URL}/v1/api/access-points`;
    
    const response = await fetch(accessPointsUrl, {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log('Response:', responseText);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the tests
console.log('='.repeat(60));
console.log('BRIVO API KEY VERIFICATION TEST');
console.log('='.repeat(60) + '\n');

testBrivoAPI().then(() => {
  return testAccessPoints();
}).then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTANT NOTES:');
  console.log('='.repeat(60));
  console.log('1. The API key alone is NOT enough to access resources');
  console.log('2. You MUST have an OAuth access token');
  console.log('3. To get an access token, you need:');
  console.log('   - Client ID');
  console.log('   - Client Secret');
  console.log('   - Complete the OAuth flow');
  console.log('\nCheck the dashboard at:');
  console.log('https://BrivoLabs.admin.mashery.com/control-center/applications/419bdeb0-3d6b-48be-a5d2-4b6eeec54d12/edit');
  console.log('\nLook for "Application Details" to find your Client ID and Secret');
});