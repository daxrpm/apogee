# Build stage - install dependencies and build docs
FROM python:3.12-slim AS builder

WORKDIR /app

# Install git (required by mkdocs-shadcn) and uv
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/* && \
    pip install uv

# Copy only what's needed for the build
COPY pyproject.toml ./
COPY mkdocs.yml ./
COPY content/ ./content/

# Install dependencies and build the site
RUN uv pip install --system mkdocs mkdocs-shadcn pymdown-extensions

# Initialize a dummy git repo for mkdocs-shadcn git timestamps
RUN git init && git config user.email "build@local" && git config user.name "Build"
RUN git add -A && git commit -m "build" --allow-empty

RUN mkdocs build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy the built static site to nginx
COPY --from=builder /app/site /usr/share/nginx/html

# Custom nginx config for SPA-like routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
