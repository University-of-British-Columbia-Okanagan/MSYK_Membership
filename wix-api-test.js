const WIX_APP_ID = '';
const WIX_APP_SECRET = '';
const WIX_SITE_ID = '';

class WixCorrectAuthFlow {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.authCode = null;
  }

  // Step 1: Generate the installation URL
  generateInstallationURL() {
    console.log('🔗 Step 1: Generate Installation URL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // You need to get a token first from the "Generate Link" process
    // For now, we'll show what the URL should look like
    const redirectUrl = 'https://example.com'; // You can change this to your callback URL
    
    console.log('📋 To get started, you need to:');
    console.log('1. Go to your Wix app dashboard (dev.wix.com)');
    console.log('2. Go to "Team Members" section');
    console.log('3. Click "Generate Link"');
    console.log('4. Copy the token from that generated URL');
    console.log('5. Use it in the installation URL below');
    
    console.log('\n🔗 Installation URL format:');
    console.log(`https://www.wix.com/installer/install?token=&appId=${WIX_APP_ID}&redirectUrl=${redirectUrl}`);
    
    console.log('\n📝 After visiting the installation URL:');
    console.log('1. You\'ll be prompted to add the app to your site');
    console.log('2. After installation, you\'ll be redirected to your redirect URL');
    console.log('3. The redirect URL will contain an authorization code as a query parameter');
    console.log('4. Copy that authorization code and use it in the next step');
    
    return {
      appId: WIX_APP_ID,
      redirectUrl: redirectUrl,
      installationUrlTemplate: `https://www.wix.com/installer/install?token=&appId=${WIX_APP_ID}&redirectUrl=${redirectUrl}`
    };
  }

  // Step 2: Use authorization code to get access token
  async getAccessTokenWithAuthCode(authorizationCode) {
    try {
      console.log('\n🔑 Step 2: Get Access Token with Authorization Code');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.log('Using authorization code:', authorizationCode.substring(0, 20) + '...');
      
      const requestBody = {
        "grant_type": "authorization_code",
        "client_id": WIX_APP_ID,
        "client_secret": WIX_APP_SECRET,
        "code": authorizationCode
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://www.wix.com/oauth/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response body:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        
        console.log('✅ Success! Got access and refresh tokens');
        console.log('Access token:', this.accessToken.substring(0, 30) + '...');
        console.log('Refresh token:', this.refreshToken.substring(0, 30) + '...');
        
        return {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken
        };
      } else {
        console.log('❌ Failed to get access token');
        return null;
      }
    } catch (error) {
      console.log('❌ Error getting access token:', error.message);
      return null;
    }
  }

  // Step 3: Refresh access token when needed
  async refreshAccessToken(refreshToken) {
    try {
      console.log('\n🔄 Step 3: Refresh Access Token');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const requestBody = {
        "grant_type": "refresh_token",
        "client_id": WIX_APP_ID,
        "client_secret": WIX_APP_SECRET,
        "refresh_token": refreshToken
      };

      const response = await fetch('https://www.wix.com/oauth/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('Refresh response:', response.status, responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        
        console.log('✅ Access token refreshed successfully');
        return {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken
        };
      } else {
        console.log('❌ Failed to refresh access token');
        return null;
      }
    } catch (error) {
      console.log('❌ Error refreshing access token:', error.message);
      return null;
    }
  }

  // Step 4: Test the Bookings API with the access token
  async testBookingsAPI() {
    if (!this.accessToken) {
      console.log('❌ No access token available');
      return;
    }

    try {
      console.log('\n📋 Step 4: Test Bookings API');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const response = await fetch('https://www.wixapis.com/bookings/v2/services/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'wix-site-id': WIX_SITE_ID,
        },
        body: JSON.stringify({
          query: {
            paging: { limit: 10 }
          }
        })
      });

      const responseText = await response.text();
      console.log('Bookings API Response:', response.status);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log('✅ Bookings API Success!');
        
        if (data.services && data.services.length > 0) {
          console.log(`\n🎉 Found ${data.services.length} booking services:`);
          data.services.forEach((service, i) => {
            console.log(`\n${i + 1}. ${service.name}`);
            console.log(`   ID: ${service.id}`);
            console.log(`   Type: ${service.type || 'Not specified'}`);
            console.log(`   Duration: ${service.schedule?.duration || 'Not specified'} minutes`);
            console.log(`   Price: ${service.payment?.price?.value || 'Free'} ${service.payment?.price?.currency || ''}`);
          });
          
          return data.services;
        } else {
          console.log('📝 API works but no services found');
          console.log('This could mean:');
          console.log('- Services exist but aren\'t published');
          console.log('- Different API permissions needed');
          console.log('- Services are in draft mode');
        }
      } else {
        console.log('❌ Bookings API failed:', responseText);
      }
    } catch (error) {
      console.log('❌ Bookings API error:', error.message);
    }
  }

  // Complete workflow demonstration
  demonstrateCompleteFlow() {
    console.log('🚀 Wix API Authentication - Complete Correct Flow');
    console.log('═══════════════════════════════════════════════════════════════════');
    
    // Step 1: Show how to generate installation URL
    const installInfo = this.generateInstallationURL();
    
    console.log('\n💡 IMPORTANT: This is a multi-step process that requires manual steps:');
    console.log('1. Get a token from "Generate Link" in your Wix app dashboard');
    console.log('2. Use that token in the installation URL');
    console.log('3. Visit the installation URL to install the app');
    console.log('4. Get the authorization code from the redirect URL');
    console.log('5. Use the authorization code to get access tokens');
    
    console.log('\n📞 Once you have the authorization code, call:');
    console.log('wixFlow.getAccessTokenWithAuthCode("YOUR_AUTH_CODE_HERE")');
    
    return installInfo;
  }

  // Helper method to test with a provided auth code
  async testWithAuthCode(authCode) {
    console.log('\n🧪 Testing with provided authorization code...');
    
    const tokens = await this.getAccessTokenWithAuthCode(authCode);
    if (tokens) {
      await this.testBookingsAPI();
      
      console.log('\n🔄 Testing token refresh...');
      await this.refreshAccessToken(this.refreshToken);
    }
  }
}

// Usage example
const wixFlow = new WixCorrectAuthFlow();

// Show the complete flow
wixFlow.demonstrateCompleteFlow();

console.log('\n' + '═'.repeat(70));
console.log('🎯 NEXT STEPS FOR YOU:');
console.log('1. Go to dev.wix.com → Your App → Team Members → Generate Link');
console.log('2. Copy the token from the generated URL');
console.log('3. Replace <TOKEN> in the installation URL with your token');
console.log('4. Visit the installation URL and complete the installation');
console.log('5. Copy the authorization code from the redirect URL');
console.log('6. Run: wixFlow.testWithAuthCode("YOUR_AUTH_CODE")');
console.log('═'.repeat(70));

// Export for manual testing
global.wixFlow = wixFlow;