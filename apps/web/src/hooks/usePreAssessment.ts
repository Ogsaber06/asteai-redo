// Ported unchanged from deeptech_frontend src/hooks/usePreAssessment.ts.
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Part 1 of every interview: the EQ / Resilience / Grit questions the AI asks before
 * the domain interview, inside the same websocket. The server drives it with three
 * text frames:
 *
 *   { type: "assessment", state: "started", total, answer_seconds }
 *   { type: "assessment_question", index, total, answer_seconds }   (before each question's audio)
 *   { type: "assessment", state: "listening", seconds_left }        (answer was silence: speak again)
 *   { type: "assessment", state: "completed" }                      (after the hand-over line)
 *
 * When Part 1 is switched off or already done for this interview none of them arrive,
 * and the page behaves exactly as before.
 *
 * What the pages need from this hook:
 * - Part 1 clips are not interview turns, so turn counters and the "first clip is the
 *   opening line" logic must skip them.
 * - An answer may only be recorded once its question has finished playing, so speech
 *   during the introduction does not become the answer to question 1.
 * - Answers are longer than domain turns (up to `answer_seconds`), and allow a longer
 *   thinking pause before the recorder decides the candidate has finished.
 *
 * Candidates never see any score; this only drives the "Part 1 · Question n of 6" view.
 */

/** Silence that ends a Part 1 answer. Story-style answers have long pauses. */
export const PART_ONE_SILENCE_MS = 6000;
const DEFAULT_ANSWER_SECONDS = 90;

export interface PreAssessmentView {
  /** Part 1 is running. */
  active: boolean;
  /** Part 1 ran in this session and has finished: the page is in Part 2. */
  done: boolean;
  /** 1-based question number, 0 before the first question. */
  index: number;
  total: number;
  /** `Date.now()` when the current answer window closes, or null while a question plays. */
  answerEndsAt: number | null;
}

export type PreAssessmentEvent = "started" | "question" | "listening" | "completed";

const INITIAL: PreAssessmentView = { active: false, done: false, index: 0, total: 6, answerEndsAt: null };

export function usePreAssessment() {
  const [view, setView] = useState<PreAssessmentView>(INITIAL);
  const activeRef = useRef(false);
  /** A question's audio has finished playing: its answer may be recorded. */
  const armedRef = useRef(false);
  /** An `assessment_question` frame arrived and its audio has not started yet. */
  const questionPendingRef = useRef(false);
  const answerSecondsRef = useRef(DEFAULT_ANSWER_SECONDS);

  /**
   * Feed every parsed text frame here first. Returns what it was, or null when the
   * frame is not a Part 1 frame and the page should handle it as before.
   */
  const handleFrame = useCallback((frame: unknown): PreAssessmentEvent | null => {
    if (!frame || typeof frame !== "object") return null;
    const msg = frame as Record<string, unknown>;

    if (msg.type === "assessment_question") {
      answerSecondsRef.current = Number(msg.answer_seconds) || answerSecondsRef.current;
      questionPendingRef.current = true;
      armedRef.current = false;
      setView(v => ({
        ...v,
        active: true,
        index: Number(msg.index) || v.index + 1,
        total: Number(msg.total) || v.total,
        answerEndsAt: null,
      }));
      return "question";
    }

    if (msg.type !== "assessment") return null;

    if (msg.state === "started") {
      activeRef.current = true;
      armedRef.current = false;
      questionPendingRef.current = false;
      answerSecondsRef.current = Number(msg.answer_seconds) || DEFAULT_ANSWER_SECONDS;
      setView({ ...INITIAL, active: true, total: Number(msg.total) || INITIAL.total });
      return "started";
    }

    if (msg.state === "listening") {
      if (!activeRef.current) return "listening";
      armedRef.current = true;
      const left = Number(msg.seconds_left);
      const seconds = Number.isFinite(left) && left > 0
        ? Math.min(left, answerSecondsRef.current)
        : answerSecondsRef.current;
      setView(v => ({ ...v, answerEndsAt: Date.now() + seconds * 1000 }));
      return "listening";
    }

    if (msg.state === "completed") {
      activeRef.current = false;
      armedRef.current = false;
      questionPendingRef.current = false;
      setView(v => ({ ...v, active: false, done: true, answerEndsAt: null }));
      return "completed";
    }

    return null;
  }, []);

  /**
   * Call when an AI clip starts playing. Returns whether it belongs to Part 1 and
   * whether it is a question (whose end opens the answer window).
   */
  const onClipStart = useCallback(() => {
    const partOne = activeRef.current;
    const question = partOne && questionPendingRef.current;
    if (question) questionPendingRef.current = false;
    return { partOne, question };
  }, []);

  /** Call when a Part 1 question clip has finished playing. */
  const openAnswerWindow = useCallback(() => {
    armedRef.current = true;
    setView(v => ({ ...v, answerEndsAt: Date.now() + answerSecondsRef.current * 1000 }));
  }, []);

  /** Call when an answer has been sent: nothing more is recorded until the next question. */
  const onAnswerSent = useCallback(() => {
    if (!activeRef.current) return;
    armedRef.current = false;
    setView(v => ({ ...v, answerEndsAt: null }));
  }, []);

  /** False during Part 1 while no answer window is open. */
  const canRecord = useCallback(() => !activeRef.current || armedRef.current, []);

  const maxRecordingMs = useCallback(
    (fallbackMs: number) => (activeRef.current ? answerSecondsRef.current * 1000 : fallbackMs),
    [],
  );

  const silenceMs = useCallback(
    (fallbackMs: number) => (activeRef.current ? Math.max(fallbackMs, PART_ONE_SILENCE_MS) : fallbackMs),
    [],
  );

  return useMemo(() => ({
    view,
    activeRef,
    handleFrame,
    onClipStart,
    openAnswerWindow,
    onAnswerSent,
    canRecord,
    maxRecordingMs,
    silenceMs,
  }), [view, handleFrame, onClipStart, openAnswerWindow, onAnswerSent, canRecord, maxRecordingMs, silenceMs]);
}

export type PreAssessment = ReturnType<typeof usePreAssessment>;
