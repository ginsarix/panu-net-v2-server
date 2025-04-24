import express, { Request, Response } from 'express';
import routes from "./routes/routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use('/api/sample', routes);

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', message: 'API is running' });
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`API server is running on http://localhost:${PORT}`);
});