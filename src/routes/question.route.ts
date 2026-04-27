import {Router} from 'express';
import QuestionController from '@/controller/question.controller';

const router = Router();

router.get('/', QuestionController.getAllQuestions);
router.get('/:id', QuestionController.getQuestionById);
router.post('/', QuestionController.createQuestion);
router.put('/:id', QuestionController.updateQuestion);
router.delete('/:id', QuestionController.deleteQuestion);

export default router;

