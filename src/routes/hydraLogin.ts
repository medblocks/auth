import { NextFunction, Request, Response } from 'express'
import url from 'url'
import { AdminApi, Configuration } from '@oryd/hydra-client'
import { Configuration as KratosConfig, V0alpha2Api } from '@ory/kratos-client'
import crypto from 'crypto'
import config from '../config'

const hydraAdmin = new AdminApi(
  new Configuration({
    basePath: config.hydra.admin,
  })
)

const kratos = new V0alpha2Api(
  new KratosConfig({ basePath: config.kratos.public })
)

const redirectToLogin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session) {
    next(Error('Unable to used express-session'))
    return
  }

  // 3. Initiate login flow with ORY Kratos:
  //
  //   - `prompt=login` forces a new login from kratos regardless of browser sessions.
  //      This is important because we are letting Hydra handle sessions
  //   - `redirect_to` ensures that when we redirect back to this url,
  //      we will have both the initial ORY Hydra Login Challenge and the ORY Kratos Login Request ID in
  //      the URL query parameters.
  console.log(
    'Initiating ORY Kratos Login flow because neither a ORY Kratos Login Request nor a valid ORY Kratos Session was found.'
  )

  const state = crypto.randomBytes(48).toString('hex')
  req.session.hydraLoginState = state
  req.session.save(error => {
    if (error) {
      console.error(error)
      next(error)
      return
    }

    // console.debug('Return to: ', {
    // url: req.url,
    // base: configBaseUrl,
    // prot: `${req.protocol}://${req.headers.host}`,
    // 'kratos.browser': config.kratos.browser,
    // })
    const query = url.parse(req.url, true).query

    // The challenge is used to fetch information about the login request from ORY Hydra.
    const challenge = String(query.login_challenge)
    const returnTo = new URL(config.baseUrl + '/postLogin')
    console.log({ baseUrl: config.baseUrl, returnTo })
    returnTo.searchParams.set('hydra_login_state', state)
    returnTo.searchParams.set('login_challenge', challenge)
    const redirectTo = new URL(
      config.kratos.browser + '/self-service/login/browser'
    )
    redirectTo.searchParams.set('refresh', 'true')
    redirectTo.searchParams.set('return_to', returnTo.toString())

    console.debug(`redirectTo: "${redirectTo.toString()}"`, redirectTo)
    return res.redirect(redirectTo.toString())
  })
}

export const postLogin = async (req: Request, res: Response, next: NextFunction) => {
  const query = url.parse(req.url, true).query

  // The challenge is used to fetch information about the login request from ORY Hydra.

  //TODO Need to figure out way to get remember_me state from login.

  const challenge = String(query.login_challenge)
  const kratosSessionCookie = req.cookies.ory_kratos_session
  if (!kratosSessionCookie) {
    console.log("No Kratos Cookie found")
    return redirectToLogin(req, res, next)
  }
  const hydraLoginState = req.query.hydra_login_state
  req.headers['host'] = config.kratos.public.split('/')[2]
  if (hydraLoginState !== req.session.hydraLoginState) {
    console.log("Login state not equal to one previously set")
    console.log(req.session.hydraLoginState)
    return redirectToLogin(req, res, next)
  }
  try {
    const session = await kratos.toSession(undefined, req.header('Cookie'))
    const { data } = session
    const hydraResponse = await hydraAdmin.acceptLoginRequest(challenge, { subject: data.identity.id, context: data.identity, remember: true })
    return res.redirect(hydraResponse.data.redirect_to)
  }
  catch (e) {
    next(e)
  }

}
export default (req: Request, res: Response, next: NextFunction) => {
  const query = url.parse(req.url, true).query
  // The challenge is used to fetch information about the login request from ORY Hydra.
  const challenge = String(query.login_challenge)
  if (!challenge) {
    console.error("Expected consent_challenge to be set")
    next(new Error('Expected a login challenge to be set but received none.'))
    return
  }

  hydraAdmin
    .getLoginRequest(challenge)
    .then(async ({ data: body }) => {
      // If hydra was already able to authenticate the user, skip will be true and we do not need to re-authenticate
      // the user.
      if (body.skip) {
        console.log("skipping login request")
        console.log({ body })
        // You can apply logic here, for example update the number of times the user logged in.
        // ...

        // Now it's time to grant the login request. You could also deny the request if something went terribly wrong
        // (e.g. your arch-enemy logging in...)
        return hydraAdmin
          .acceptLoginRequest(challenge, {
            // All we need to do is to confirm that we indeed want to log in the user.
            remember: true,
            subject: String(body.subject)
          })
          .then(({ data: body }) => {
            // All we need to do now is to redirect the user back to hydra!
            res.redirect(String(body.redirect_to))
          })
      } else {
        console.log("not skipping login request")
        console.log({ body })
        return redirectToLogin(req, res, next)
      }

      // If authentication can't be skipped we MUST show the login UI.
      //   res.render('login', {
      //     csrfToken: req.csrfToken(),
      //     challenge: challenge,
      //     action: urljoin(process.env.BASE_URL || '', '/login'),
      //     hint: body.oidc_context?.login_hint || ''
      //   })
    })
    // This will handle any error that happens when making HTTP calls to hydra
    .catch(next)
}