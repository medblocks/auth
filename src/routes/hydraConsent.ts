import { Request, Response, NextFunction } from "express"
import { AdminApi, Configuration } from '@oryd/hydra-client'

const hydraAdmin = new AdminApi(
    new Configuration({
        basePath: 'http://127.0.0.1:4445',
    })
)

const createHydraSession = (
    requestedScope: string[] = [],
    context
) => {
    return {
        id_token: {
            userdata: context
        }
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
        next(new Error('Expected consent_challenge to be set.'))
        return
    }

    hydraAdmin
        .getConsentRequest(challenge)
        // This will be called if the HTTP request was successful
        .then(({ data: body }) => {
            // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
            if (body.skip) {
                // You can apply logic here, for example grant another scope, or do whatever...

                // Now it's time to grant the consent request. You could also deny the request if something went terribly wrong
                console.log(body.context)
                const acceptConsentRequest = {
                    grant_scope: body.requested_scope,
                    grant_access_token_audience: body.requested_access_token_audience,
                    session: createHydraSession(
                        body.requested_scope,
                        body.context
                    )
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

            // If consent can't be skipped we MUST show the consent UI.
            res.render('consent', {
                csrfToken: req.csrfToken(),
                challenge: challenge,
                // We have a bunch of data available from the response, check out the API docs to find what these values mean
                // and what additional data you have available.
                requested_scope: body.requested_scope,
                user: body.subject,
                client: body.client,
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
        const rejectConsentRequest = { error: 'access_denied', error_description: 'The resource owner denied the request' } as any

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
            const acceptConsentRequest = {} as any
            // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
            // are requested accidentally.
            acceptConsentRequest.grant_scope = grantScope

            // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
            acceptConsentRequest.grant_access_token_audience =
                body.requested_access_token_audience

            // This tells hydra to remember this consent request and allow the same client to request the same
            // scopes from the same user, without showing the UI, in the future.
            acceptConsentRequest.remember = Boolean(req.body.remember)

            // When this "remember" sesion expires, in seconds. Set this to 0 so it will never expire.
            acceptConsentRequest.remember_for = 3600

            // The session allows us to set session data for id and access tokens. Let's add the email if it is included.
            acceptConsentRequest.session = createHydraSession(
                body.requested_scope,
                body.context
            )

            return hydraAdmin.acceptConsentRequest(challenge, acceptConsentRequest)
        })
        .then(({ data: body }) => {
            // All we need to do now is to redirect the user back to hydra!
            res.redirect(String(body.redirect_to))
        })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next)
}