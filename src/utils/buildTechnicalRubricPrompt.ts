/**
 * Builds the AI prompt for technical rubric scoring.
 *
 * Evaluates 4 criteria (scale 1–5 each):
 *   - understanding          : Depth of conceptual understanding demonstrated
 *   - technicalAccuracy      : Correctness of technical details, terms, and facts
 *   - problemSolving         : Logical reasoning and approach to solving the problem
 *   - technicalCommunication : Clarity and precision when explaining technical concepts
 *
 * Also requests an overall confidence (0–1) so the caller can decide
 * whether to trigger a retry.
 */
export const buildTechnicalRubricPrompt = (
  pertanyaan: string,
  jawaban: string,
  retryHint?: string,
): string => {
  return `Role:
You are a technical interview evaluator assessing the quality of a candidate's answer.

Task:
Score the answer using the 4 rubric criteria below. Each criterion is rated 1–5.

Rubric:
- understanding          (1-5): Depth of conceptual understanding demonstrated in the answer.
- technicalAccuracy      (1-5): Correctness of technical details, terminology, and facts.
- problemSolving         (1-5): Quality of logical reasoning and approach to solving the problem.
- technicalCommunication (1-5): Clarity and precision when explaining technical concepts.
${
  retryHint
    ? `
Additional instruction:
${retryHint}

`
    : ""
}
Data:
Question: ${pertanyaan}
Answer: ${jawaban}

Format:
Return ONLY a JSON object with no other text:
{
  "understanding": 0-5,
  "technicalAccuracy": 0-5,
  "problemSolving": 0-5,
  "technicalCommunication": 0-5,
  "confidence": 0-1,
  "reason": "brief justification in one sentence"
}`;
};
