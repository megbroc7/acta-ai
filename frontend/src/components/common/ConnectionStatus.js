import React, { useState, useEffect } from 'react';
import { Box, Chip, Tooltip, Button } from '@mui/material';
import {
  WifiOff as WifiOffIcon,
  Wifi as WifiIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { testBackendConnectivity } from '../../utils/apiErrorHandler';
import api from '../../services/api';

/**
 * Component that monitors and displays backend connectivity status
 */
const ConnectionStatus = ({ onConnectionChange = () => {} }) => {
  const [connected, setConnected] = useState(true);
  const [checking, setChecking] = useState(false);
  
  // Check connection status
  const checkConnection = async () => {
    setChecking(true);
    try {
      const isConnected = await testBackendConnectivity(api);
      setConnected(isConnected);
      onConnectionChange(isConnected);
    } catch (error) {
      setConnected(false);
      onConnectionChange(false);
    } finally {
      setChecking(false);
    }
  };
  
  // Check connection on mount and periodically
  useEffect(() => {
    let interval;
    
    const init = async () => {
      // Initial check
      await checkConnection();
      
      // Set up interval for periodic checks
      interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    };
    
    init();
    
    // Clean up on unmount
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);
  
  if (connected) {
    return (
      <Tooltip title="Backend connected">
        <Chip
          icon={<WifiIcon />}
          label="Connected"
          size="small"
          color="success"
          variant="outlined"
        />
      </Tooltip>
    );
  }
  
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Tooltip title="Backend connection issue">
        <Chip
          icon={<WifiOffIcon />}
          label="Connection Issue"
          size="small"
          color="error"
          variant="outlined"
        />
      </Tooltip>
      <Button
        startIcon={<RefreshIcon />}
        size="small"
        onClick={checkConnection}
        disabled={checking}
        sx={{ minWidth: 'auto', p: '0 8px' }}
      >
        {checking ? 'Checking...' : 'Retry'}
      </Button>
    </Box>
  );
};

export default ConnectionStatus; 