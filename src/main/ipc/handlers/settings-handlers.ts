/**
 * Settings handlers keep renderer preferences on the typed IPC path so even
 * harmless local state follows the same schema discipline as later sensitive
 * configuration. If the renderer wrote SQLite directly, preload isolation would
 * be mostly decorative.
 */
import type { SettingsRepository } from "../../../db/repositories/settings-repository.js";
import type {
  SettingsGetRequest,
  SettingsGetResponse,
  SettingsSetRequest,
  SettingsSetResponse
} from "../../../shared/schemas/settings.js";

export function createSettingsHandlers(settingsRepository: SettingsRepository) {
  return {
    "settings:get": (request: SettingsGetRequest): SettingsGetResponse => ({
      key: request.key,
      value: settingsRepository.get(request.key)
    }),
    "settings:set": (request: SettingsSetRequest): SettingsSetResponse => {
      settingsRepository.set(request.key, request.value);
      return { key: request.key, value: request.value };
    }
  };
}
