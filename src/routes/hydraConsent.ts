import { Request, Response, NextFunction } from 'express'
import {
  AdminApi,
  Configuration,
  ConsentRequestSession,
} from '@oryd/hydra-client'
import config from '../config'


const hydraAdmin = new AdminApi(
  new Configuration({
    basePath: config.hydra.admin,
  })
)

const getLaunch = (url) => {
  const launch = new URL(url).searchParams.get('launch')
  if (launch) {
    const decodedLaunch = Buffer.from(launch, 'base64')
    return JSON.parse(decodedLaunch.toString())
  }
}

const createHydraSession = (
  requestedScope: string[] = [],
  context,
  client_id,
  launch
): ConsentRequestSession => {
  console.log("Setting hydra consent")
  console.log({ context, launch })
  return {
    id_token: {
      userdata: context,
      launch,
      user_id: context?.traits?.email,
      aud: client_id

    },
    access_token: {
      scope: requestedScope,
      organization_id: 'medblocks',
      patient_id: 'sidharth',
      aud: client_id
    },
  }
}

declare module "express"{
  interface Request{
    csrfToken: () => string
  }
}

export const hydraGetConsent = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Parses the URL query
  // The challenge is used to fetch information about the consent request from ORY Hydra.
  const challenge = req.query.consent_challenge as string

  if (!challenge) {
    console.error('Expected consent_challenge to be set')
    next(new Error('Expected consent_challenge to be set.'))
    return
  }

  hydraAdmin
    .getConsentRequest(challenge)
    // This will be called if the HTTP request was successful
    .then(({ data: body }) => {
      console.log('consent', body.request_url)

      // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
      if (body.skip) {
        // You can apply logic here, for example grant another scope, or do whatever...
        console.log('skipping consent request')
        console.log({ body })
        // Now it's time to grant the consent request. You could also deny the request if something went terribly wrong

        const prompt = new URL(body.request_url).searchParams.get('prompt')
        const launch = new URL(body.request_url).searchParams.get('launch')
        const scopeLaunchPatient =
          body.requested_scope.includes('launch/patient')
        const decodedLaunch =
          launch && JSON.parse(Buffer.from(launch, 'base64').toString())

        if (scopeLaunchPatient) {
          if (decodedLaunch && !decodedLaunch.patient) {
            if (prompt === 'none') {
              console.log('client has launch/patient scope ')
              console.log(
                'client has launch/patient scope , but contains no patient'
              )
              return hydraAdmin
                .rejectConsentRequest(challenge, {
                  error: 'login_required',
                  error_description: 'client has launch/patient scope but contains no patient. Patient selection cannot have prompt=none',
                })
                .then(({ data: body }) => {
                  // All we need to do now is to redirect the user back to hydra!
                  console.log('consent redirectURL', body.redirect_to)
                  res.redirect(String(body.redirect_to))
                })
            }
            else {
              console.log('Hello', { challenge, launch })
              res.redirect(`${config.baseUrl}/patientpicker/${challenge}/${launch}`)
            }
          }
        }
        console.log("generating session")
        const acceptConsentRequest = {
          grant_scope: body.requested_scope,
          grant_access_token_audience: body.requested_access_token_audience,
          session: createHydraSession(
            body.requested_scope,
            body.context,
            body.client.client_id,
            getLaunch(body.request_url)
          ),
        }

        // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
        // are requested accidentally.

        // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.

        // The session allows us to set session data for id and access tokens. Let's add the email if it is included.

        return hydraAdmin
          .acceptConsentRequest(challenge, acceptConsentRequest)
          .then(({ data: body }) => {
            // All we need to do now is to redirect the user back to hydra!
            res.redirect(String(body.redirect_to))
          })
      }
      console.log('not skipping consent request')
      console.log({ body })
      // If consent can't be skipped we MUST show the consent UI.
      const context = body.context as any
      const name = context?.traits?.name?.first
      console.log('context', body.context)
      console.log({ body })
      res.render('consent', {
        csrfToken: req.csrfToken(),
        challenge: challenge,
        action: config.baseUrl + '/hydraconsent',
        // We have a bunch of data available from the response, check out the API docs to find what these values mean
        // and what additional data you have available.
        requested_scope: body.requested_scope,
        user: name,
        client: body.client?.client_name || body.client?.client_id,
        logo_uri: body.client.logo_uri
      })
    })
    // This will handle any error that happens when making HTTP calls to hydra
    .catch(next)
}

export const hydraPostConsent = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  const challenge = req.body.challenge

  // Let's see if the user decided to accept or reject the consent request..
  if (req.body.submit !== 'Allow access') {
    // Looks like the consent request was denied by the user
    const rejectConsentRequest = {
      error: 'access_denied',
      error_description: 'The resource owner denied the request',
    } as any

    return (
      hydraAdmin
        .rejectConsentRequest(challenge, rejectConsentRequest)
        .then(({ data: body }) => {
          // All we need to do now is to redirect the browser back to hydra!
          res.redirect(String(body.redirect_to))
        })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next)
    )
  }

  let grantScope = req.body.grant_scope
  if (!Array.isArray(grantScope)) {
    grantScope = [grantScope]
  }

  // Seems like the user authenticated! Let's tell hydra...
  hydraAdmin
    .getConsentRequest(challenge)
    // This will be called if the HTTP request was successful
    .then(({ data: body }) => {
      // console.log('launch',JSON.parse(decodedLaunch.toString()))
      const acceptConsentRequest = {} as any
      // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
      // are requested accidentally.
      acceptConsentRequest.grant_scope = grantScope

      // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
      acceptConsentRequest.grant_access_token_audience =
        body.requested_access_token_audience

      // This tells hydra to remember this consent request and allow the same client to request the same
      // scopes from the same user, without showing the UI, in the future.
      acceptConsentRequest.remember = true

      // When this "remember" sesion expires, in seconds. Set this to 0 so it will never expire.
      acceptConsentRequest.remember_for = 0

      // The session allows us to set session data for id and access tokens. Let's add the email if it is included.
      acceptConsentRequest.session = createHydraSession(
        body.requested_scope,
        body.context,
        body.client.client_id,
        getLaunch(body.request_url)
      )
      console.log({ acceptConsentRequest })
      return hydraAdmin.acceptConsentRequest(challenge, acceptConsentRequest)
    })
    .then(({ data: body }) => {
      // All we need to do now is to redirect the user back to hydra!
      res.redirect(String(body.redirect_to))
    })
    // This will handle any error that happens when making HTTP calls to hydra
    .catch(next)
}
