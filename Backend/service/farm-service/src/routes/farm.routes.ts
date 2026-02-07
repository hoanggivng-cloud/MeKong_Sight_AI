import { Router } from 'express';
import { FarmController } from '../controllers/farm.controller';
import { authMiddleware } from '@mekong/shared';

const router = Router();
const farmController = new FarmController();

router.get('/my', authMiddleware, (req, res) => farmController.getMyFarms(req, res));
router.post('/', authMiddleware, (req, res) => farmController.createFarm(req, res));
router.get('/:id', authMiddleware, (req, res) => farmController.getFarmDetails(req, res));

// Alerts
router.delete('/:id', authMiddleware, (req, res) => farmController.deleteFarm(req, res));
router.get('/alerts/all', authMiddleware, (req, res) => farmController.getAlerts(req, res));
router.put('/alerts/:id/acknowledge', authMiddleware, (req, res) => farmController.acknowledgeAlert(req, res));

export default router;
