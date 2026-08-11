/**
 * Image and username handlers stay thin so upload/search and WSL orchestration
 * cannot bypass the shared service. If IPC owned parsing, browser fallback and
 * fixed-argv username sweeps would be harder to audit together.
 */
import type {
  SearchImageRequest,
  SearchImageResponse,
  UsernameSweepRequest,
  UsernameSweepResponse
} from "../../../shared/schemas/image-username.js";
import type { ImageUsernameService } from "../../image-username/image-username-service.js";

export function createImageUsernameHandlers(imageUsernameService: ImageUsernameService) {
  return {
    "search:image": (request: SearchImageRequest): Promise<SearchImageResponse> =>
      imageUsernameService.searchImage(request),
    "search:usernameSweep": (request: UsernameSweepRequest): Promise<UsernameSweepResponse> =>
      imageUsernameService.usernameSweep(request)
  };
}
