# Acta AI Security Testing Guide

This document outlines a comprehensive security testing approach for the Acta AI application before production deployment.

## Overview

Security testing should address the following areas:
1. Authentication and authorization
2. API security
3. Data validation
4. Dependency vulnerabilities
5. Infrastructure security
6. OWASP Top 10 vulnerabilities
7. SSL/TLS configuration

## 1. Authentication Security Testing

### JWT Token Security

```bash
# Test JWT token expiration
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"password123"}' \
  | jq -r '.access_token' > token.txt

# Wait until after token should expire (based on ACCESS_TOKEN_EXPIRE_MINUTES)
sleep 1800  # Wait 30 minutes if ACCESS_TOKEN_EXPIRE_MINUTES=30

# Try to use expired token
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $(cat token.txt)"
# Should return 401 Unauthorized
```

### Password Policies

- Verify minimum password length and complexity requirements
- Test account lockout after multiple failed login attempts
- Verify password reset functionality

## 2. API Security Testing

### Endpoint Authorization

```bash
# Test accessing protected endpoint without authentication
curl -X GET http://localhost:8000/api/templates
# Should return 401 Unauthorized

# Test accessing admin endpoint with regular user token
curl -X GET http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $(cat user_token.txt)"
# Should return 403 Forbidden
```

### Rate Limiting

Use a tool like Apache Bench to test API rate limiting:

```bash
# Install Apache Bench (ab)
apt-get install apache2-utils

# Test rate limiting (100 requests with 10 concurrent connections)
ab -n 100 -c 10 -H "Authorization: Bearer $(cat token.txt)" http://localhost:8000/api/templates/
```

## 3. Data Validation Testing

### Input Validation

Test for SQL injection, XSS, and other injection attacks:

```bash
# Test SQL injection in login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com\' OR 1=1; --","password":"anything"}'
# Should fail with validation error, not 500 error

# Test XSS in template name
curl -X POST http://localhost:8000/api/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat token.txt)" \
  -d '{"name":"<script>alert(1)</script>","system_prompt":"test","topic_generation_prompt":"test","content_generation_prompt":"test"}'
# Response should have escaped script tags
```

## 4. Dependency Vulnerability Scanning

### Backend Dependencies

```bash
# Install safety for Python dependency checking
pip install safety

# Scan Python dependencies
cd backend && safety check -r requirements.txt

# For more comprehensive scanning, use Snyk
npm install -g snyk
snyk test --file=requirements.txt
```

### Frontend Dependencies

```bash
# Scan NPM dependencies
cd frontend && npm audit

# For more comprehensive scanning, use Snyk
cd frontend && snyk test
```

## 5. Infrastructure Security Testing

### Docker Security

```bash
# Install Docker Bench Security
git clone https://github.com/docker/docker-bench-security.git
cd docker-bench-security
sudo sh docker-bench-security.sh

# Install Trivy for container scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image acta-ai-backend
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image acta-ai-frontend
```

### Network Security

```bash
# Check open ports
sudo nmap -sT -p- localhost

# Check SSL/TLS configuration
docker run --rm -t ssllabs/ssllabs-scan:stable -grade -quiet acta-ai.yourdomain.com
```

## 6. OWASP Top 10 Testing

Use OWASP ZAP (Zed Attack Proxy) for automated security scanning:

```bash
# Run ZAP in Docker with automated scan
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://acta-ai.yourdomain.com
```

For a more thorough test:

1. Install ZAP Desktop: https://www.zaproxy.org/download/
2. Run automated scan against your application
3. Review and address findings

## 7. SSL/TLS Configuration Testing

Test your SSL/TLS configuration with SSLyze:

```bash
# Install SSLyze
pip install sslyze

# Run SSL/TLS test
sslyze --regular acta-ai.yourdomain.com:443
```

Alternatively, use the SSL Labs online test:
https://www.ssllabs.com/ssltest/analyze.html?d=acta-ai.yourdomain.com

## 8. Security Headers Testing

Check security headers implementation:

```bash
# Install and use Security Headers Scanner
pip install security-headers-check

# Test headers
security-headers-check https://acta-ai.yourdomain.com
```

## 9. Penetration Testing with Practical Tools

### Install and use Nikto:

```bash
# Install Nikto
apt-get install nikto

# Run scan
nikto -h https://acta-ai.yourdomain.com
```

### Specific API Endpoint Testing:

```bash
# Test for CSRF vulnerabilities
curl -X POST http://localhost:8000/api/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat token.txt)" \
  -H "Origin: https://malicious-site.com" \
  -d '{"name":"test","system_prompt":"test","topic_generation_prompt":"test","content_generation_prompt":"test"}'
# Should be rejected if CSRF protection is active
```

## 10. Continuous Security Testing

Implement continuous security testing in your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow for security scanning
name: Security Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run dependency vulnerability scan
        run: |
          pip install safety
          cd backend && safety check -r requirements.txt
          cd ../frontend && npm audit
      
      - name: Run Docker image scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'acta-ai-backend:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'
```

## Security Testing Checklist

- [ ] Authentication and JWT token testing completed
- [ ] API authorization testing performed
- [ ] Input validation and injection testing done
- [ ] Dependency vulnerabilities scanned and resolved
- [ ] Docker and infrastructure security validated
- [ ] OWASP Top 10 scan performed
- [ ] SSL/TLS configuration checked
- [ ] Security headers verified
- [ ] Rate limiting tested
- [ ] CSRF/CORS protections validated
- [ ] Continuous security testing implemented

## Remediation Guidance

For each security issue found:

1. Document the issue with severity and impact
2. Prioritize based on risk level
3. Fix the highest priority issues before production
4. Create a remediation plan for remaining issues
5. Retest after fixes to verify resolution

## Additional Resources

- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) 