# CI/CD Workflows for Acta AI

This directory contains GitHub Actions workflows for continuous integration and deployment of the Acta AI application.

## Workflows

### 1. Backend CI/CD (`ci.yml`)

This workflow runs whenever code is pushed to the `main` or `develop` branches, or when pull requests are opened against these branches.

It consists of three jobs:

- **Test**: Runs the backend tests using Docker Compose with the test configuration.
  - Uses `docker-compose.test.yml` to set up a PostgreSQL database and run the tests.
  - Automatically cleans up containers after tests complete.

- **Lint**: Checks the code quality of the backend.
  - Runs flake8 to catch syntax errors and undefined names.
  - Checks code formatting with black.
  - Verifies import order with isort.

- **Deploy**: Deploys the application to production when code is pushed to the `main` branch.
  - Only runs if the test and lint jobs pass.
  - Uses SSH to connect to the production server.
  - Currently contains placeholder commands that need to be customized.

### 2. Frontend CI (`frontend-ci.yml`)

This workflow runs when changes are made to files in the `frontend` directory.

It includes:

- Installing Node.js dependencies
- Running linting checks
- Executing frontend tests
- Building the frontend application

## Required Secrets

For the deployment job to work, you need to set up the following secrets in your GitHub repository:

- `SSH_PRIVATE_KEY`: The SSH private key for connecting to your production server
- `SSH_USER`: The username for SSH login
- `SSH_HOST`: The hostname or IP address of your production server

## Customizing Deployment

To customize the deployment process, edit the "Deploy to production" step in the `ci.yml` file. Replace the placeholder command with your actual deployment commands.

Example:
```yaml
- name: Deploy to production
  run: |
    ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd /path/to/acta-ai && git pull && docker-compose up -d --build"
```

## Local Testing

You can test the backend workflow locally by running:

```bash
docker-compose -f docker-compose.test.yml up --build
``` 