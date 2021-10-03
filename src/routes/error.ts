import { NextFunction, Request, Response } from 'express'
import config from '../config'
import { Configuration, V0alpha2Api } from '@ory/kratos-client'
import { isString } from '../helpers/sdk'
import { AxiosError } from 'axios'

// Uses the ORY Kratos NodeJS SDK:
const kratos = new V0alpha2Api(
  new Configuration({ basePath: config.kratos.public })
)

// A simple express handler that shows the error screen.
export default (req: Request, res: Response, next: NextFunction) => {
  const error = req.query.id
  console.trace(req.query)
  console.trace(req.url)
  console.trace("On error page")
  if (!error || !isString(error)) {
    // No error was send, redirecting back to home.
    console.trace("No error found")
    res.redirect(config.baseUrl)
    return
  }

  kratos
    .getSelfServiceError(error)
    .then(({ status, data: body }) => {
      if ('error' in body) {
        res.status(500).render('error', {
          message: JSON.stringify(body.error, null, 2),
        })
        console.trace("Got back error from keator")
        return Promise.resolve()
      }
      console.trace("Got back something else from keator")
      return Promise.reject(
        `expected errorContainer to contain "errors" but got ${JSON.stringify(
          body
        )}`
      )
    })
    .catch((err: AxiosError) => {
      if (!err.response) {
        console.trace("Axios error")
        next(err)
        return
      }

      if (err.response.status === 404) {
        console.trace("Error non found")
        // The error could not be found, redirect back to home.
        res.redirect(config.baseUrl)
        return
      }
      console.trace("Next on error")
      next(err)
    })
}
