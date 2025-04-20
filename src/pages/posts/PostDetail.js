import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Button, 
  Card, 
  CardMedia, 
  CardContent,
  Divider,
  Avatar,
  Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../../services/api';

const PostDetail = () => {
  // ... existing code ...

  useEffect(() => {
    const fetchPostDetails = async () => {
      try {
        setLoading(true);
        
        // Add debugging to check token before making the request
        console.log('Debug - Fetching post details for ID:', id);
        console.log('Debug - Token from localStorage:', localStorage.getItem('token'));
        
        const response = await api.get(`/api/posts/${id}`);
        
        setPost(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching post details:', err);
        // Add more detailed error logging
        if (err.response) {
          console.error('Error response:', {
            status: err.response.status,
            data: err.response.data,
            headers: err.response.headers
          });
        }
        setError(err.message || 'Failed to fetch post details');
        setLoading(false);
      }
    };

    fetchPostDetails();
  }, [id]);

  // ... existing code ...
} 