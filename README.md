# Acta AI - WordPress Autoblogger

Acta AI is an automated content generation and publishing system for WordPress sites. It uses AI to generate high-quality blog posts and publishes them to your WordPress site on a schedule you define.

## Features

- **User Authentication**: Secure login and registration system
- **WordPress Integration**: Connect to any WordPress site with REST API access
- **AI-Powered Content**: Generate blog posts using OpenAI's GPT models
- **Customizable Prompts**: Create and refine your own prompt templates
- **Flexible Scheduling**: Set up daily, weekly, or monthly posting schedules
- **Content Review**: Option to review posts before publishing
- **Categories & Tags**: Automatically assign WordPress categories and tags

## Tech Stack

- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Authentication**: JWT tokens
- **Scheduling**: APScheduler
- **AI**: OpenAI API
- **Frontend**: React (separate repository)
- **CI/CD**: GitHub Actions

## Development

## Installation Instructions

### Prerequisites

- Python 3.11+
- PostgreSQL
- OpenAI API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/acta-ai.git
cd acta-ai
```

2. Set up a virtual environment:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Create a `.env` file:

```bash
cp .env.example .env
```

5. Edit the `.env` file with your configuration:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/actaai
SECRET_KEY=your_secret_key
OPENAI_API_KEY=your_openai_api_key
CORS_ORIGINS=http://localhost:3000
```

6. Run the application:

```bash
uvicorn app.main:app --reload
```

7. Access the API documentation at http://localhost:8000/docs

### Using Docker

You can also run the application using Docker:

```bash
docker-compose up -d
```

## Configuration Options

- **DATABASE_URL**: Connection string for the PostgreSQL database.
- **SECRET_KEY**: Secret key for JWT authentication.
- **OPENAI_API_KEY**: API key for OpenAI.
- **CORS_ORIGINS**: Allowed origins for CORS.

## Usage Examples

1. **Register a new user account**: Use the `/register` endpoint.
2. **Add your WordPress site credentials**: Use the `/sites` endpoint.
3. **Create prompt templates for your content**: Use the `/prompts` endpoint.
4. **Set up a posting schedule**: Use the `/schedules` endpoint.
5. **Monitor and manage your posts**: Use the `/posts` endpoint.

## API Documentation

The API provides the following endpoints:

- **/register**: Register a new user.
- **/login**: Authenticate a user and receive a JWT token.
- **/sites**: Manage WordPress site connections.
- **/prompts**: Create and manage prompt templates.
- **/schedules**: Set up and manage content schedules.
- **/posts**: View and manage generated blog posts.

Access the full API documentation at http://localhost:8000/docs

## Usage

1. Register a new user account
2. Add your WordPress site credentials
3. Create prompt templates for your content
4. Set up a posting schedule
5. Monitor and manage your posts

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for instructions on deploying to Digital Ocean.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## CI/CD

The project uses GitHub Actions for continuous integration and deployment:

- **Backend CI/CD**: Automatically runs tests and linting on the backend code
- **Frontend CI**: Runs tests, linting, and builds the frontend application
- **Automated Deployment**: Deploys to production when changes are pushed to the main branch

To run the tests locally:

```bash
# Run backend tests
docker-compose -f docker-compose.test.yml up --build

# Run linting
./scripts/lint.sh
```

For more details on the CI/CD setup, see the [workflows documentation](.github/workflows/README.md). 