import { Server, Socket } from "socket.io";
import interviewService from "@/services/interview.service";
import scoringService from "@/services/scoring.service";
import { Status, QuestionType } from "@/prisma/enums";
import fs from "fs";

export default function setupInterviewSocket(io: Server, socket: Socket) {
  // JOIN INTERVIEW
  socket.on("join-interview", async (interviewId: number) => {
    try {
      const userId = socket.data.user.id;
      const interview = await interviewService.getInterviewById(interviewId);

      if (!interview) {
        socket.emit("error", { message: "Interview tidak ditemukan" });
        return;
      }
      
      if (interview.userId !== userId) {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }

      const roomName = `interview_${interviewId}`;
      socket.join(roomName);
      console.log(`User ${userId} joined room ${roomName}`);

      socket.emit("joined-interview", { interviewId });
    } catch (error: any) {
      socket.emit("error", { message: error.message || "Failed to join interview" });
    }
  });

  // SUBMIT ANSWER
  socket.on("submit-answer", async (data: { interviewId: number; answer: string; questionId?: number }) => {
    try {
      const { interviewId, answer, questionId } = data;
      const userId = socket.data.user.id;

      const interview = await interviewService.getInterviewById(interviewId);
      if (!interview) {
        return socket.emit("error", { message: "Interview tidak ditemukan" });
      }

      if (interview.status === Status.FINISH) {
        return socket.emit("error", { message: "Interview sudah selesai" });
      }

      const roomName = `interview_${interviewId}`;
      if (!socket.rooms.has(roomName)) {
        return socket.emit("error", { message: "You have not joined this interview room" });
      }

      let currentQuestion = null as any;
      if (questionId && questionId !== -1) {
        currentQuestion = await interviewService.getQuestionById(questionId);
        if (!currentQuestion) {
          return socket.emit("error", { message: "Pertanyaan tidak ditemukan" });
        }

        const already = await interviewService.hasAnsweredQuestion(interviewId, questionId);
        if (already) {
          return socket.emit("error", { message: "Pertanyaan sudah dijawab" });
        }
      } else if (questionId === -1) {
        currentQuestion = { id: -1, type: "INTRO" };
      } else {
        currentQuestion = await interviewService.getNextQuestion(interviewId);
        if (!currentQuestion) {
          await interviewService.finishInterview(interviewId);
          interviewService.processResume(interviewId).catch(console.error);
          return io.to(roomName).emit("interview-finished", { message: "Interview selesai" });
        }
      }

      let savedAnswer: { id: number; createdAt: Date; updatedAt: Date; userId: number; interviewId: number; questionId: number; content: string; };
      if (currentQuestion.id === -1) {
        await interviewService.createUserChat(interviewId, answer);
        io.to(roomName).emit("answer-saved", { questionId: -1, answer });
      } else {
        savedAnswer = await interviewService.createAnswer({
          content: answer,
          questionId: currentQuestion.id,
          interviewId,
          userId,
        });

        await interviewService.createUserChat(interviewId, answer);

        // Async Scoring
        try {
          if (currentQuestion.type === QuestionType.TECHNICAL) {
            scoringService.scoreTechnicalAnswer(savedAnswer.id).catch((err) => {
              fs.appendFileSync(
                "scoring.log",
                `ERROR: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:TECHNICAL, answerId:${savedAnswer.id}, message:${err.message}\n${err.stack}\n`
              );
              console.error("Background scoring error (TECHNICAL):", err);
            });
          }

          if (currentQuestion.type === QuestionType.SOFTSKILL) {
            scoringService.scoreSoftSkillAnswer(savedAnswer.id).catch((err) => {
              fs.appendFileSync(
                "scoring.log",
                `ERROR: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:SOFTSKILL, answerId:${savedAnswer.id}, message:${err.message}\n${err.stack}\n`
              );
              console.error("Background scoring error (SOFTSKILL):", err);
            });
          }
        } catch (err) {
          console.error("Scoring error:", err);
        }

        io.to(roomName).emit("answer-saved", { answer: savedAnswer, questionId: currentQuestion.id });
      }

      const nextQuestion = await interviewService.getNextQuestion(interviewId);
      if (!nextQuestion) {
        await interviewService.finishInterview(interviewId);
        interviewService.processResume(interviewId).catch(console.error);
        return io.to(roomName).emit("interview-finished", { message: "Interview selesai" });
      }

      io.to(roomName).emit("new-question", nextQuestion);

    } catch (error: any) {
      socket.emit("error", { message: error.message || "Failed to submit answer" });
    }
  });
}
