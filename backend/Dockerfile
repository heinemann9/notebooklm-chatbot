FROM python:3.12-slim

WORKDIR /app

# Xvfb + Playwright system dependencies + CJK fonts
RUN apt-get update && apt-get install -y \
    xvfb \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
    libasound2 libxshmfence1 libx11-xcb1 libxcb1 \
    libxext6 libxfixes3 libxi6 libxrender1 libxtst6 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY . .

EXPOSE 8000

# Start Xvfb (virtual display) in background, then run uvicorn
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x800x24 -nolisten tcp & DISPLAY=:99 uvicorn app.main:app --host 0.0.0.0 --port 8000"]
