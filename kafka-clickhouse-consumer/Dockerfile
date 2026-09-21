FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy consumer script
COPY kafka_to_clickhouse.py .

# Make script executable
RUN chmod +x kafka_to_clickhouse.py

CMD ["python", "-u", "kafka_to_clickhouse.py"]
