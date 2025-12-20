// ** import lib
import { Hono } from 'hono'

// ** import routes
import { signedUrlRoute } from './signed-url'
import { confirmRoute } from './confirm'

const upload = new Hono()

upload.route('/', signedUrlRoute)
upload.route('/', confirmRoute)

export { upload as uploadRoute }

