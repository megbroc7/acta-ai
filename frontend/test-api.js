const axios = require('axios');

async function testApi() {
  try {
    console.log('Testing API connection...');
    
    // Test login
    console.log('Testing login...');
    const loginResponse = await axios.post(
      'http://127.0.0.1:8000/api/auth/token',
      new URLSearchParams({
        'username': 'test@example.com',
        'password': 'password123'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('Login response:', loginResponse.data);
    
    if (loginResponse.data.access_token) {
      // Test user info
      console.log('Testing user info...');
      const userResponse = await axios.get(
        'http://127.0.0.1:8000/api/auth/me',
        {
          headers: {
            'Authorization': `Bearer ${loginResponse.data.access_token}`
          }
        }
      );
      
      console.log('User info:', userResponse.data);
      
      // Test sites
      console.log('Testing sites...');
      const sitesResponse = await axios.get(
        'http://127.0.0.1:8000/api/sites',
        {
          headers: {
            'Authorization': `Bearer ${loginResponse.data.access_token}`
          }
        }
      );
      
      console.log('Sites response:', sitesResponse.data);
      
      console.log('API test completed successfully!');
    } else {
      console.error('No access token received');
    }
  } catch (error) {
    console.error('API test error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testApi(); 