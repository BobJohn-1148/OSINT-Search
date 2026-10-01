/**
 * Plays a demo script on a single timer chain: one pending timeout at a time, cleared on restart and on unmount, so
 * the demo itself can never leave a timer running. Restarting changes the run key, which is what lets the results view
 * start a fresh, silent baseline for the new run.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { demoIdle, type DemoFrame, type DemoState, replay } from "./osint-results-demo-stream";

export interface DemoPlayer {
  readonly state: DemoState;
  readonly runKey: string;
  readonly playing: boolean;
  readonly elapsed: number;
  readonly log: readonly string[];
  readonly play: () => void;
  readonly restart: () => void;
  /** Jump straight to the end with no animation (a finished, historical view). */
  readonly finish: () => void;
}

export function useDemoPlayer(frames: readonly DemoFrame[], autoplay: boolean): DemoPlayer {
  const [state, setState] = useState<DemoState>(demoIdle);
  const [runNumber, setRunNumber] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState<readonly string[]>([]);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const run = useCallback(
    (next: number) => {
      stop();
      setState(demoIdle);
      setLog([]);
      setElapsed(0);
      setRunNumber(next);
      setPlaying(true);
      startedAt.current = performance.now();
      const step = (index: number): void => {
        const frame = frames.at(index);
        if (!frame) {
          setPlaying(false);
          timer.current = null;
          return;
        }
        const wait = Math.max(0, frame.at - (performance.now() - startedAt.current));
        timer.current = window.setTimeout(() => {
          setState((current) => frame.apply(current));
          setElapsed(frame.at);
          setLog((current) => [...current.slice(-7), `${(frame.at / 1000).toFixed(1)} s · ${frame.note}`]);
          step(index + 1);
        }, wait);
      };
      step(0);
    },
    [frames, stop]
  );

  const restart = useCallback(() => run(runNumber + 1), [run, runNumber]);
  const play = useCallback(() => {
    if (!playing) {
      run(runNumber + 1);
    }
  }, [playing, run, runNumber]);
  const finish = useCallback(() => {
    stop();
    const end = frames.at(-1)?.at ?? 0;
    setRunNumber((current) => current + 1);
    setState(replay(frames, end));
    setLog(["Showing the finished run (no animation)."]);
    setElapsed(end);
    setPlaying(false);
  }, [frames, stop]);

  useEffect(() => {
    // started from a timer callback (not the effect body) so autoplay does not render twice before the first paint
    const kickoff = autoplay ? window.setTimeout(() => run(1), 0) : null;
    return () => {
      if (kickoff !== null) {
        window.clearTimeout(kickoff);
      }
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once on mount; later runs are started by the buttons
  }, []);

  return { state, runKey: `demo-${runNumber}`, playing, elapsed, log, play, restart, finish };
}
