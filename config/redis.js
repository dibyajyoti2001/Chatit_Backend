import { createClient } from 'redis';
import "dotenv/config";

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('connect', () => {
  console.log('✅ Redis Connected');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Not Connected, Error:', err);
});

await redisClient.connect(); // Important: connect on load

export default redisClient;
