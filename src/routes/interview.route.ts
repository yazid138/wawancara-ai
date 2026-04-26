import { Router } from "express";

const router = Router();

router.get('/:id/questions')
router.get('/:id/current')
router.get('/:id/next')
router.get('/:id/finish')
router.get('/:id/result')

export default router