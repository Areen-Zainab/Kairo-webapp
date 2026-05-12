# ────────────────Backend Dockerfile ────────────────
# Using Debian Bookworm for better compatibility with Python/ML libs
FROM node:20-bookworm

# 1. Install system dependencies
# ffmpeg: for audio processing
# python3: for AI agents
# build-essential: for native node/python modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    build-essential \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# 2. Set working directory
WORKDIR /app

# 3. Handle Python Dependencies (from root)
# We do this first as it takes the longest (heavy ML libraries)
COPY requirements.txt ./
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
# Note: This will be slow on the first build
RUN pip install --no-cache-dir -r requirements.txt

# 4. Handle Node.js Dependencies (from backend folder)
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

# 5. Copy Backend Source and Prisma
COPY backend/ ./
# Copy AI layer from root to be accessible by backend (used via child_process)
COPY ai-layer/ /app/ai-layer/

# 6. Generate Prisma Client
RUN npx prisma generate

# 7. Environment & Execution
# We expect the .env.docker to be mounted or provided via Compose
ENV PORT=5000
EXPOSE 5000

# Start the server
CMD ["node", "src/server.js"]
