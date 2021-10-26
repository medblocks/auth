import { NextFunction, Request, Response } from 'express'
import { AdminApi, Configuration } from '@oryd/hydra-client'
import url from 'url'
import config from '../config'

const hydraAdmin = new AdminApi(
  new Configuration({
    basePath: config.hydra.admin,
  })
)

export default (req: Request, res: Response, next: NextFunction) => {
  const query = url.parse(req.url, true).query

  // The challenge is used to fetch information about the logout request from ORY Hydra.
  const challenge = String(query.logout_challenge)
  if (!challenge) {
    next(new Error('Expected a logout challenge to be set but received none.'))
    return
  }

  hydraAdmin
    .getLogoutRequest(challenge)
    // This will be called if the HTTP request was successful
    .then(() => {
      // Here we have access to e.g. response.subject, response.sid, ...
     return hydraAdmin
        .acceptLogoutRequest(challenge)
        .then(({ data: body }) => {
          // All we need to do now is to redirect the user back to hydra!
          res.redirect(String(body.redirect_to))
        })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next)
      // The most secure way to perform a logout request is by asking the user if he/she really want to log out.
    })
    // This will handle any error that happens when making HTTP calls to hydra
    .catch(next)
}
