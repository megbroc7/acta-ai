import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack, Alert, MenuItem,
} from '@mui/material';
import { Save, ArrowBack, RocketLaunch, ContentPasteGo } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const PLATFORMS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'copy', label: 'Copy & Paste (Squarespace, Ghost, etc.)' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'wix', label: 'Wix (Coming Soon)' },
];

const COMING_SOON_PLATFORMS = ['wix'];
const SHOPIFY_API_VERSION = '2026-01';

function normalizeShopDomain(rawValue) {
  if (!rawValue) return '';
  try {
    const parsed = new URL(rawValue.includes('://') ? rawValue : `https://${rawValue}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return rawValue
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase();
  }
}

function deriveShopifyAdminApiUrl(rawValue) {
  const domain = normalizeShopDomain(rawValue);
  if (!domain || !domain.endsWith('.myshopify.com')) return '';
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}`;
}

export default function SiteForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    platform: 'wordpress',
    name: '', url: '', api_url: '',
    username: '', app_password: '',
    api_key: '',
    default_blog_id: '',
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [shopifyBlogs, setShopifyBlogs] = useState([]);
  const [loadingBlogs, setLoadingBlogs] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(null);

  const { data: site } = useQuery({
    queryKey: ['site', id],
    queryFn: () => api.get(`/sites/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (site) {
      setForm({
        platform: site.platform || 'wordpress',
        name: site.name, url: site.url,
        api_url: site.platform === 'copy' ? '' : (site.api_url || ''),
        username: site.username || '', app_password: '',
        api_key: '',
        default_blog_id: site.default_blog_id || '',
      });
      if (site.platform === 'shopify') {
        setShopifyConnected(true);
      }
    }
  }, [site]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('shopify_connected');
    const error = params.get('shopify_error');
    if (!connected && !error) return;

    if (connected === '1') {
      enqueueSnackbar('Shopify connected successfully', { variant: 'success' });
    }
    if (error) {
      enqueueSnackbar(error, { variant: 'error' });
    }
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate, enqueueSnackbar]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/sites/${id}`, data) : api.post('/sites/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      enqueueSnackbar(isEdit ? 'Site updated' : 'Site added', { variant: 'success' });
      navigate('/sites');
    },
    onError: (err) => enqueueSnackbar(err.response?.data?.detail || 'Failed to save', { variant: 'error' }),
  });

  const fetchShopifyBlogs = useCallback(async (showErrorToast = false) => {
    if (!isEdit || !id) return { connected: false, blogs: [] };
    setLoadingBlogs(true);
    try {
      const res = await api.get(`/shopify/sites/${id}/blogs`);
      const blogs = res.data?.blogs || [];
      const connected = Boolean(res.data?.connected);
      setShopifyBlogs(blogs);
      setShopifyConnected(connected);
      if (blogs.length > 0) {
        setForm((prev) => (
          prev.default_blog_id
            ? prev
            : { ...prev, default_blog_id: blogs[0].id }
        ));
      }
      return { connected, blogs };
    } catch (err) {
      if (showErrorToast) {
        enqueueSnackbar(err.response?.data?.detail || 'Failed to load Shopify blogs', { variant: 'error' });
      }
      setShopifyBlogs([]);
      setShopifyConnected(false);
      return { connected: false, blogs: [] };
    } finally {
      setLoadingBlogs(false);
    }
  }, [isEdit, id, enqueueSnackbar]);

  useEffect(() => {
    if (form.platform !== 'shopify') return;
    const derived = deriveShopifyAdminApiUrl(form.url);
    if (!derived) return;
    setForm((prev) => {
      if (prev.platform !== 'shopify') return prev;
      const previousDerived = deriveShopifyAdminApiUrl(prev.url);
      if (!prev.api_url || prev.api_url === previousDerived) {
        return { ...prev, api_url: derived };
      }
      return prev;
    });
  }, [form.platform, form.url]);

  useEffect(() => {
    if (!isEdit || form.platform !== 'shopify') return;
    fetchShopifyBlogs();
  }, [isEdit, form.platform, fetchShopifyBlogs]);

  useEffect(() => {
    if (form.platform !== 'shopify') {
      setShopifyConnected(null);
      setShopifyBlogs([]);
    }
  }, [form.platform]);

  const handleConnectShopify = async () => {
    try {
      let shopifySiteId = id;
      if (!isEdit || !id) {
        const createPayload = {
          platform: 'shopify',
          name: form.name?.trim(),
          url: form.url?.trim(),
          api_url: (form.api_url || deriveShopifyAdminApiUrl(form.url)).trim(),
          api_key: form.api_key?.trim() || null,
          default_blog_id: form.default_blog_id?.trim() || null,
        };
        if (!createPayload.name || !createPayload.url || !createPayload.api_url) {
          enqueueSnackbar('Enter Site Name, myshopify URL, and Admin API URL before connecting.', { variant: 'info' });
          return;
        }
        const createRes = await api.post('/sites/', createPayload);
        shopifySiteId = createRes.data?.id;
        if (!shopifySiteId) {
          enqueueSnackbar('Could not create Shopify site before connecting.', { variant: 'error' });
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['sites'] });
      }

      const res = await api.post('/shopify/install-url', {
        site_id: shopifySiteId,
        shop_domain: form.url || null,
      });
      window.location.assign(res.data.auth_url);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to start Shopify connect', { variant: 'error' });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (form.platform === 'shopify' && isEdit && !form.api_key) {
        const shopifyResult = await fetchShopifyBlogs(true);
        const blogs = shopifyResult.blogs;
        const connected = shopifyResult.connected;
        setTestResult({
          success: connected,
          message: connected
            ? `Connected to Shopify (${blogs.length} blog${blogs.length === 1 ? '' : 's'} found)`
            : 'Shopify is not connected yet. Start OAuth with Connect Shopify, or use manual token fallback.',
        });
        return;
      }

      const payload = {
        platform: form.platform,
        api_url: form.api_url || null,
        username: form.username || null,
        app_password: form.app_password || null,
        api_key: form.api_key || null,
      };
      const res = await api.post('/sites/test-connection', payload);
      setTestResult(res.data);
      if (form.platform === 'shopify') {
        const blogs = res.data?.blogs || [];
        setShopifyBlogs(blogs);
        if (blogs.length > 0) {
          setForm((prev) => (
            prev.default_blog_id
              ? prev
              : { ...prev, default_blog_id: blogs[0].id }
          ));
        }
      }
    } catch {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (data.platform === 'copy') {
      // Copy sites only need name, url, platform
      delete data.api_url;
      delete data.username;
      delete data.app_password;
      delete data.api_key;
      delete data.default_blog_id;
    } else if (data.platform === 'wordpress') {
      delete data.api_key;
      delete data.default_blog_id;
    } else if (data.platform === 'shopify') {
      delete data.username;
      delete data.app_password;
      if (!data.default_blog_id) delete data.default_blog_id;
    } else {
      delete data.username;
      delete data.app_password;
      delete data.default_blog_id;
    }

    if (isEdit) {
      if (!data.app_password) delete data.app_password;
      if (!data.api_key) delete data.api_key;
      delete data.platform;
    }
    saveMutation.mutate(data);
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const isComingSoon = COMING_SOON_PLATFORMS.includes(form.platform);
  const isCopy = form.platform === 'copy';
  const isWP = form.platform === 'wordpress';
  const isShopify = form.platform === 'shopify';
  const blogOptions = shopifyBlogs.length > 0 ? shopifyBlogs : (testResult?.blogs || []);
  const inferredShopifyApiUrl = deriveShopifyAdminApiUrl(form.url);
  const canStartShopifyOAuth = Boolean(
    isShopify
    && form.name?.trim()
    && form.url?.trim()
    && (form.api_url?.trim() || inferredShopifyApiUrl)
  );

  const canTest = (
    !isComingSoon
    && !isCopy
    && (
      (isWP && form.api_url && form.username && form.app_password)
      || (isShopify && form.api_url && (form.api_key || isEdit))
    )
  );

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/sites')} sx={{ mb: 2 }}>
        Back to Sites
      </Button>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: 3,
          position: 'relative',
          display: 'inline-block',
          pb: 1,
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 60,
            height: 4,
            backgroundColor: 'primary.main',
          },
        }}
      >
        {isEdit ? 'Edit Site' : 'Add Site'}
      </Typography>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                select
                label="Platform"
                required
                fullWidth
                value={form.platform}
                onChange={update('platform')}
                disabled={isEdit}
                helperText={isEdit ? 'Platform cannot be changed after creation' : ''}
              >
                {PLATFORMS.map(p => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
              </TextField>

              {isComingSoon ? (
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'warning.main',
                    backgroundColor: 'rgba(176, 141, 87, 0.06)',
                    p: 3,
                    textAlign: 'center',
                  }}
                >
                  <RocketLaunch sx={{ fontSize: 48, color: 'warning.main', mb: 1.5, opacity: 0.8 }} />
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                    {form.platform === 'wix' ? 'Wix' : 'Platform'} Integration Coming Soon
                  </Typography>
                  <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 480, mx: 'auto' }}>
                    Direct publishing to {form.platform === 'wix' ? 'Wix' : 'this platform'} is on our roadmap.
                    In the meantime, you can generate full articles using the Test panel on any template
                    and copy them straight into your site.
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/prompts')}
                    sx={{ fontWeight: 700, letterSpacing: '0.03em' }}
                  >
                    Go to Templates
                  </Button>
                </Box>
              ) : isCopy ? (
                <>
                  <Alert
                    severity="info"
                    icon={<ContentPasteGo />}
                    sx={{
                      borderColor: '#4A7C6F',
                      '& .MuiAlert-icon': { color: '#4A7C6F' },
                    }}
                  >
                    <strong>Copy & Paste workflow:</strong> Generate content with Acta AI, then copy it to
                    your site manually. Posts are saved and tracked here — you can mark them as published
                    once they're live. No API credentials needed.
                  </Alert>
                  <TextField label="Site Name" required fullWidth value={form.name} onChange={update('name')} placeholder="My Squarespace Blog" />
                  <TextField label="Blog URL" required fullWidth value={form.url} onChange={update('url')} placeholder="https://yourblog.com" helperText="The public URL of your blog (used for &quot;View Live&quot; links)" />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button type="submit" variant="contained" startIcon={<Save />} disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Site' : 'Add Site'}
                    </Button>
                  </Box>
                </>
              ) : (
                <>
                  <TextField label="Site Name" required fullWidth value={form.name} onChange={update('name')} />
                  <TextField
                    label="Site URL"
                    required
                    fullWidth
                    value={form.url}
                    onChange={update('url')}
                    placeholder={isShopify ? 'https://your-store.myshopify.com' : 'https://yourblog.com'}
                  />
                  <TextField
                    label={isShopify ? 'Shopify Admin API URL' : 'REST API URL'}
                    required
                    fullWidth
                    value={form.api_url}
                    onChange={update('api_url')}
                    placeholder={isShopify ? 'https://your-store.myshopify.com/admin/api/2026-01' : 'https://yourblog.com/wp-json'}
                    helperText={isShopify && inferredShopifyApiUrl ? `Auto-filled from store URL: ${inferredShopifyApiUrl}` : ''}
                  />

                  {isWP && (
                    <>
                      <TextField label="Username" required={!isEdit} fullWidth value={form.username} onChange={update('username')} />
                      <TextField
                        label={isEdit ? 'App Password (leave blank to keep current)' : 'App Password'}
                        required={!isEdit}
                        fullWidth
                        type="password"
                        value={form.app_password}
                        onChange={update('app_password')}
                      />
                    </>
                  )}

                  {isShopify && (
                    <>
                      {shopifyConnected !== null && (
                        <Alert severity={shopifyConnected ? 'success' : 'info'}>
                          {shopifyConnected
                            ? `Shopify OAuth is connected (${blogOptions.length} blog${blogOptions.length === 1 ? '' : 's'} available).`
                            : 'Shopify OAuth is not connected yet. Use Connect Shopify to complete one-click auth.'}
                        </Alert>
                      )}
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Button variant="contained" onClick={handleConnectShopify} disabled={!canStartShopifyOAuth}>
                          {isEdit ? 'Connect Shopify (OAuth)' : 'Save & Connect Shopify (OAuth)'}
                        </Button>
                        {isEdit && (
                          <Button variant="outlined" onClick={() => fetchShopifyBlogs(true)} disabled={loadingBlogs}>
                            {loadingBlogs ? 'Loading Blogs...' : 'Load Blogs'}
                          </Button>
                        )}
                      </Box>
                      <TextField
                        label={isEdit ? 'Manual Admin API Access Token (fallback, optional)' : 'Manual Admin API Access Token (fallback)'}
                        required={false}
                        fullWidth
                        type="password"
                        value={form.api_key}
                        onChange={update('api_key')}
                        helperText="Advanced fallback only. OAuth is the primary and recommended connection flow."
                      />
                      <TextField
                        select
                        label="Default Blog"
                        fullWidth
                        value={form.default_blog_id}
                        onChange={update('default_blog_id')}
                        helperText="Select the Shopify blog where posts should be published."
                      >
                        <MenuItem value="">Select a blog</MenuItem>
                        {blogOptions.map((blog) => (
                          <MenuItem key={blog.id} value={blog.id}>{blog.title}</MenuItem>
                        ))}
                      </TextField>
                    </>
                  )}

                  {testResult && (
                    <Alert severity={testResult.success ? 'success' : 'error'}>
                      {testResult.message}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={handleTest} disabled={testing || !canTest}>
                      {testing ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button type="submit" variant="contained" startIcon={<Save />} disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Site' : 'Add Site'}
                    </Button>
                  </Box>
                </>
              )}
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
