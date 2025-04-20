// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add debugging for post detail route
    if (config.url && config.url.includes('/api/posts/') && !config.url.endsWith('/posts/')) {
      console.log('Debug - Token in request:', localStorage.getItem('token'));
      console.log('Debug - Headers:', config.headers);
    }
    
    // Get token from local storage
    const token = localStorage.getItem('token');
    
    // If token exists, add to request headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
); 