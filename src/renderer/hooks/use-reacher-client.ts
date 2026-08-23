/**
 * Renderer components use this hook instead of the raw preload bridge so IPC
 * calling style stays replaceable when richer loading and error handling arrive.
 * If components reached for window.reacher directly, every route would have to
 * relearn the same boundary rules.
 */
import { useCallback } from "react";
import type { IpcChannel, IpcRequest, IpcResponse } from "../../shared/ipc";
import type { Result } from "../../shared/result";
import { invokeReacher } from "../ipc-client";

export function useReacherClient() {
  const invoke = useCallback(
    <TChannel extends IpcChannel>(
      channel: TChannel,
      request: IpcRequest<TChannel>
    ): Promise<Result<IpcResponse<TChannel>>> => invokeReacher(channel, request),
    []
  );

  return { invoke };
}
