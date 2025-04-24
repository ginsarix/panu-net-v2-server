import {Request, Response} from 'express';

export const getSample = async (req: Request, res: Response) => {
    try {
        const data = { id: 1, name: 'Sample Item' };
        res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch sample data');
    }
};

export const postSample = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }
        const newItem = { id: 2, name };
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Failed to create sample item');
        res.status(500).json({ error: 'Failed to create sample item' });
    }
};