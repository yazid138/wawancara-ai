import { Server, Socket } from "socket.io";
import interviewService from "@/services/interview.service";
import scoringService from "@/services/scoring.service";
import followUpService from "@/services/followUp.service";
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

      // ── INTRO: jawaban bebas, tanpa scoring ─────────────────────────────
      if (currentQuestion.id === -1) {
        await interviewService.createUserChat(interviewId, answer);
        io.to(roomName).emit("answer-saved", { questionId: -1, answer });

        const nextQuestion = await interviewService.getNextQuestion(interviewId);
        if (!nextQuestion) {
          await interviewService.finishInterview(interviewId);
          interviewService.processResume(interviewId).catch(console.error);
          return io.to(roomName).emit("interview-finished", { message: "Interview selesai" });
        }
        return io.to(roomName).emit("new-question", nextQuestion);
      }

      // ── FOLLOW-UP: jawaban untuk follow-up question ──────────────────────
      // Dideteksi lewat flag isFollowUp di Question table.
      // Menggunakan socket event yang sama (submit-answer) — tidak perlu event baru.
      if (currentQuestion.isFollowUp) {
        const result = await followUpService.submitFollowUpAnswer(
          currentQuestion.id,
          answer,
          interviewId,
          userId,
        );

        // Chat history sudah disimpan di dalam submitFollowUpAnswer,
        // emit answer-saved agar FE update bubble chat.
        io.to(roomName).emit("answer-saved", {
          answer: result.answer,
          questionId: currentQuestion.id,
        });

        // Emit score yang diperbarui via answer-scored (event yang sudah ada)
        if (result.updatedScore) {
          io.to(roomName).emit("answer-scored", {
            answerId: result.updatedScore.answerId,
            questionId: currentQuestion.parentAnswerId ?? currentQuestion.id,
            score: {
              finalScore: result.updatedScore.finalScore,
              feedback: `Skor diperbarui setelah follow-up: ${Math.round(result.updatedScore.finalScore)}/100`,
              type: result.updatedScore.type,
            },
          });
        }

        // Lanjut ke soal utama berikutnya
        const nextMain = await interviewService.getNextQuestion(interviewId);
        if (!nextMain) {
          await interviewService.finishInterview(interviewId);
          interviewService.processResume(interviewId).catch(console.error);
          return io.to(roomName).emit("interview-finished", { message: "Interview selesai" });
        }
        return io.to(roomName).emit("new-question", nextMain);
      }

      // ── SOAL UTAMA: TECHNICAL / SOFTSKILL / GENERAL ──────────────────────
      const savedAnswer = await interviewService.createAnswer({
        content: answer,
        questionId: currentQuestion.id,
        interviewId,
        userId,
      });

      await interviewService.createUserChat(interviewId, answer, currentQuestion.id);

      // Scoring (background, non-blocking)
      try {
        if (currentQuestion.type === QuestionType.TECHNICAL) {
          scoringService.scoreTechnicalAnswer(savedAnswer.id)
            .then((score) => {
              if (score) {
                io.to(roomName).emit("answer-scored", {
                  answerId: savedAnswer.id,
                  questionId: currentQuestion.id,
                  score,
                });
              }
            })
            .catch((err) => {
              fs.appendFileSync(
                "scoring.log",
                `ERROR: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:TECHNICAL, answerId:${savedAnswer.id}, message:${err.message}\n${err.stack}\n`
              );
              console.error("Background scoring error (TECHNICAL):", err);
            });
        }

        if (currentQuestion.type === QuestionType.SOFTSKILL) {
          scoringService.scoreSoftSkillAnswer(savedAnswer.id)
            .then((score) => {
              if (score) {
                io.to(roomName).emit("answer-scored", {
                  answerId: savedAnswer.id,
                  questionId: currentQuestion.id,
                  score,
                });
              }
            })
            .catch((err) => {
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

      // Emit jawaban tersimpan ke FE segera
      io.to(roomName).emit("answer-saved", { answer: savedAnswer, questionId: currentQuestion.id });

      // ── Follow-up check (inline, bukan background) ───────────────────────
      // Untuk TECHNICAL/SOFTSKILL: tunggu scoring selesai (~3s), cek apakah
      // perlu follow-up. Jika ya, emit follow-up sebagai new-question.
      // Jika tidak, langsung emit soal utama berikutnya.
      // FE tidak perlu event baru — semua lewat new-question yang sudah ada.
      if (
        currentQuestion.type === QuestionType.TECHNICAL ||
        currentQuestion.type === QuestionType.SOFTSKILL
      ) {
        await new Promise<void>((r) => setTimeout(r, 3500));
        const followUpResult = await followUpService.generateFollowUp(interviewId, savedAnswer.id);

        if (followUpResult.generated && followUpResult.followUpQuestion) {
          // Emit follow-up sebagai new-question — FE tidak perlu event baru
          return io.to(roomName).emit("new-question", {
            id: followUpResult.followUpQuestion.id,
            content: followUpResult.followUpQuestion.content,
            type: currentQuestion.type,
            isFollowUp: true,
            followUpReason: followUpResult.followUpQuestion.reason,
          });
        }

      }

      // Emit soal berikutnya (utama)
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

  // SKIP QUESTION (timeout dari FE)
  socket.on("skip-question", async (data: { interviewId: number; questionId: number }) => {
    try {
      const { interviewId, questionId } = data;
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

      // Hanya skip jika questionId valid (bukan intro)
      if (questionId && questionId !== -1) {
        const already = await interviewService.hasAnsweredQuestion(interviewId, questionId);
        if (!already) {
          await interviewService.skipQuestion({ interviewId, questionId, userId });
        }
      }

      const nextQuestion = await interviewService.getNextQuestion(interviewId);
      if (!nextQuestion) {
        await interviewService.finishInterview(interviewId);
        interviewService.processResume(interviewId).catch(console.error);
        return io.to(roomName).emit("interview-finished", { message: "Interview selesai" });
      }

      io.to(roomName).emit("question-skipped", { skippedQuestionId: questionId });
      io.to(roomName).emit("new-question", nextQuestion);
    } catch (error: any) {
      socket.emit("error", { message: error.message || "Failed to skip question" });
    }
  });
}
