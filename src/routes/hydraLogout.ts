import { NextFunction, Request, Response } from 'express'
import { AdminApi, Configuration } from '@oryd/hydra-client'
import config from '../config'

const hydraAdmin = new AdminApi(
  new Configuration({
    basePath: config.hydra.admin,
  })
)

export default (req: Request, res: Response, next: NextFunction) => {
  const challenge = String(req.body.login_challenge)
  if (!challenge) {
    console.error('Expected consent_challenge to be set')
    next(new Error('Expected a login challenge to be set but received none.'))
    return
  }
  hydraAdmin
    .acceptLogoutRequest(challenge)
    .then(async ({ data: body }) => {
      res.redirect(String(body.redirect_to))
    })
    .catch(next)
}
