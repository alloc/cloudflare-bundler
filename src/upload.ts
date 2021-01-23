import axios from 'axios'
import { UploadConfig } from './config'

export async function uploadScript(code: string, config: UploadConfig) {
  if (!config.authToken) return
  const api = axios.create({
    baseURL: 'https://api.cloudflare.com/client/v4',
    headers: { authorization: 'Bearer ' + config.authToken },
  })

  const scriptsUri = `/accounts/${config.accountId}/workers/scripts`

  /**
   * Upload the script.
   * @see https://api.cloudflare.com/#worker-script-upload-worker
   */
  const scriptUri = `${scriptsUri}/${config.scriptId}`
  await api.put(scriptUri, code, {
    headers: {
      'content-type': 'application/javascript',
    },
  })

  /**
   * Enable the script.
   * @see https://community.cloudflare.com/t/uploading-worker-via-v4-api-failed-to-update-route/236774/7
   */
  return api.post(`${scriptUri}/subdomain`, { enabled: true })
}
