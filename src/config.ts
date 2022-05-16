import { config } from 'dotenv'

config({ debug: true })


export const SECURITY_MODE_STANDALONE = 'cookie'
export const SECURITY_MODE_JWT = 'jwt'

const baseUrl = process.env.BASE_URL || '/'

let securityMode = SECURITY_MODE_STANDALONE
let publicUrl = process.env.KRATOS_PUBLIC_URL || ""
switch ((process.env.SECURITY_MODE || '').toLowerCase()) {
  case 'jwt':
  case 'oathkeeper':
    securityMode = SECURITY_MODE_JWT
    break
  case 'cookie':
  case 'standalone':
  default:
    securityMode = SECURITY_MODE_STANDALONE
}

export default {
  hydra: {
    admin: (process.env.HYDRA_ADMIN_URL || '').replace(/\/+$/, ''),
    public: (process.env.HYDRA_PUBLIC_URL || '').replace(/\/+$/, ''),
  },
  logoUrl: process.env.LOGO_URL || 'https://www.kadencewp.com/wp-content/uploads/2020/10/alogo-2.svg',
  kratos: {
    browser: `${baseUrl.replace(/\/+$/, '')}/.ory/kratos`,
    admin: (process.env.KRATOS_ADMIN_URL || '').replace(/\/+$/, ''),
    public: publicUrl.replace(/\/+$/, ''),
  },
  baseUrl: baseUrl.replace(/\/+$/, ''),
  jwksUrl: process.env.JWKS_URL || '/',

  securityMode,
  SECURITY_MODE_JWT,
  SECURITY_MODE_STANDALONE,

  https: {
    enabled: process.env.hasOwnProperty('TLS_KEY_PATH') && process.env.hasOwnProperty('TLS_CERT_PATH'),
    certificatePath: process.env.TLS_CERT_PATH || '',
    keyPath: process.env.TLS_KEY_PATH || '',
  },
}
