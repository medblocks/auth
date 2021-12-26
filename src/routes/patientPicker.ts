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


const createHydraSession = (
  requestedScope: string[] = [],
  context,
  launch
): ConsentRequestSession => {
  return {
    id_token: {
      userdata: context,
      launch,
    },
    access_token: {
      scope: requestedScope,
      organization_id: 'medblocks',
      patient_id: 'sidharth',
      realm_access: {
        roles: requestedScope,
      },
    },
  }
}

export const getPatientPicker = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log({req})                
  // Parses the URL query
  // The challenge is used to fetch information about the consent request from ORY Hydra.
  const challenge = req.params.challenge as string
  const launch = req.params.launch as string

  console.log('patientpicker',{challenge,launch},req.csrfToken())   //F1nO5k1S-iiosONWU2A_iLqzNmcj_FR24ACE

  if (!challenge) {
    console.error('Expected challenge to be set')
    next(new Error('Expected challenge to be set.'))
    return
  }

  hydraAdmin
    .getConsentRequest(challenge)
    // This will be called if the HTTP request was successful
    .then(({ data: body }) => {
      
      console.log('showing patients')

      console.log('get patients',{ body })
      res.render('patientpicker', {
        csrfToken: req.csrfToken(),
        challenge: challenge,
        launch:launch,
        action:` ${config.baseUrl}/patientpicker/${challenge}/${launch}`,
        
      })
    })
    // This will handle any error that happens when making HTTP calls to hydra
    .catch(next)
}

export const postPatientPicker = (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  console.log('entered the post patientpicker')
  // The challenge is now a hidden input field, so let's take it from the request body instead
  console.log(req.body) 
  const challenge = req.body.challenge
  const launch = req.body.launch
  const csrf = req.body.csrfToken

  console.log('post patientpicker',{challenge,launch,csrf})

  let patient = req.body.patient
  const decodedLaunch = Buffer.from(launch, 'base64')
    

  // Seems like the user authenticated! Let's tell hydra...
  hydraAdmin
    .getConsentRequest(challenge)
    // This will be called if the HTTP request was successful
    .then(({ data: body }) => {
      // console.log('launch',JSON.parse(decodedLaunch.toString()))
      const acceptConsentRequest = {
        grant_scope: body.requested_scope,
        grant_access_token_audience: body.requested_access_token_audience,
        session: createHydraSession(
          body.requested_scope,
          body.context,
          {...JSON.parse(decodedLaunch.toString()),patient}
        ),
      }

      // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
      // are requested accidentally.

      // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.

      // The session allows us to set session data for id and access tokens. Let's add the email if it is included.

      return hydraAdmin
        .acceptConsentRequest(challenge, acceptConsentRequest)
    })
    .then(({ data: body }) => {
      // All we need to do now is to redirect the user back to hydra!
      res.redirect(String(body.redirect_to))
    })
    // This will handle any error that happens when making HTTP calls to hydra
    .catch(next)
}
