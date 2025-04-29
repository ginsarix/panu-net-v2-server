import express from 'express';
import routes from './routes/routes';
import { errorHandler } from './middleware/errorHandler';
import sequelize from './config/database';
import User from './models/User';
import Redis from 'ioredis';
import { RedisStore } from 'connect-redis';
import session from 'express-session';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const redisClient = new Redis({
  host: 'localhost',
  port: 6379,
});

const redisStore = new RedisStore({
  client: redisClient,
  prefix: "myapp:",
});

app.use(express.json());
app.use(
  session({
    store: redisStore,
    secret: process.env.REDIS_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true in prod
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use('/api', routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API server is running on http://localhost:${PORT}`);
});

const createDummy = async () => {
  const user = await User.create({
    username: 'johndoe',
    email: 'john@example.com',
    password: await bcrypt.hash('johndoepwd', 12),
  });
  console.log('User created:', user);
}

const initSequelize = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('Database synced successfully.');

    await createDummy();
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

await initSequelize();
